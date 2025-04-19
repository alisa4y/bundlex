import { Info } from "./data"
import { existsSync } from "fs"
import { readFile, stat } from "fs/promises"
import { compose, mapFactory, retry, curry, catchError } from "vaco"
import { extname, dirname, join, isAbsolute } from "path"
import ts from "typescript"
import Module from "module"

// --------------------  constants  --------------------
// TODO: check string pattern faster, change link rgx to be right side only
let id = 0
const idGen = mapFactory((path: string) => "id" + id++)
const stringRgxs: RegExp = joinRgxs([
  /`(?:\\.|[^\\`])*`/,
  /"(?:\\.|[^\\"])*"/,
  /'(?:\\.|[^\\'])*'/,
])
const linkRgx: RegExp = /(?<!\w|\$)require\(/g

// --------------------  parsers  --------------------
const stringParser = curry(parse, {
  regex: stringRgxs,
  converter: (m => ({
    type: "string",
    content: m,
  })) as Converter["converter"],
})
const linkParser = curry(parse, {
  regex: linkRgx,
  converter: () => ({
    type: "link",
    content: "",
  }),
} as Converter)
const mainParse = compose(linkParser, stringParser)
const read = retry(
  async path => {
    // sometimes reading a path mistakingly giving empty content
    const content = await readFile(path, "utf-8")

    if (content.trim() === "") throw new Error(`File is empty at path: ${path}`)

    return content
  },
  250,
  2000
)

// --------------------  extractor  --------------------
export async function extractor(path: string): Promise<Info> {
  if (!existsSync(path)) throw new Error(`path: "${path}" not exists`)

  const content = transpileTs((await read(path)) as string)
  const ps = mainParse([{ type: "text", content }])
  const imports: string[] = []

  await Promise.all(
    ps.map(async (p, i) => {
      if (p.type === "link") {
        ;(p as any).type = "text"
        const linkStr = ps[i + 1]

        if (linkStr.type !== "string") return

        const requiredPath = linkStr.content.slice(1, -1)

        if (isNodeNativeModule(requiredPath)) {
          console.warn(
            `Native module "${requiredPath}" is required for file at path: ${path}`
          )
          // p.content = `require("${requiredPath}")`
          return
        }

        const linkPath = await fixPath(requiredPath, path)
        linkStr.content = ""
        p.content = idGen(linkPath) + "("

        imports.push(linkPath)
      }
    })
  )

  try {
    return {
      path,
      content: ps.map(({ content }) => content).join(""),
      imports,
    }
  } catch (e) {
    throw new Error(
      `catched error on bundling file: ${path}\n${(e as any).message}`
    )
  }
}
function transpileTs(content: string): string {
  return ts.transpile(content, {
    module: ts.ModuleKind.Node16,
    removeComments: true,
    esModuleInterop: true,
    jsx: ts.JsxEmit.Preserve,
  })
}
function isNodeNativeModule(modulePath: string): boolean {
  // Remove the 'node:' prefix if present (introduced in newer Node versions)
  const corePath = modulePath.startsWith("node:")
    ? modulePath.substring(5)
    : modulePath

  // Check if the core path exists in the list of built-in modules
  return Module.builtinModules.includes(corePath)
}

// --------------------  bundler  --------------------
export function bundler(infos: Info[]): string {
  return (
    infos
      .map(
        ({ content, path }) => `//${path}\n${wrapFile(content, idGen(path))}`
      )
      .join("\n") + `\n${idGen(infos[0].path)}()`
  )
}
function wrapFile(file: string, id: string) {
  return `function ${id}(module={exports:{}}) {\nlet exports = module.exports;\n${id}=()=> module.exports;\n\n${file}\n\treturn module.exports}`
}

// --------------------  parser  --------------------
function parse(handler: Converter, ps: Parser[]): Parser[] {
  return ps.flatMap(p =>
    p.type === "text" ? splitByRegex(p.content, handler) : p
  )
}
function splitByRegex(str: string, { regex, converter }: Converter): Parser[] {
  let result: (Parser | Parser[])[] = []
  let lastIndex = 0
  regex.lastIndex = lastIndex
  let match = regex.exec(str)

  while (match) {
    if (lastIndex < match.index)
      result.push({ type: "text", content: str.slice(lastIndex, match.index) })
    result.push(converter(...match))

    lastIndex = match.index + match[0].length
    regex.lastIndex = lastIndex
    match = regex.exec(str)
  }

  const lastContent = str.slice(lastIndex)

  if (lastContent.length > 0)
    result.push({ type: "text", content: lastContent })

  return result.flat()
}

// --------------------  normalize link  --------------------
async function fixPath(filePath: string, refPath: string): Promise<string> {
  const dir = dirname(refPath)

  if (filePath[0] === ".") {
    const foundFile = await get1stEntryFile(join(dir, filePath))

    if (foundFile === null)
      throw new Error(`Local file not found at path: ${filePath}`)

    return foundFile
  }
  if (
    isAbsolute(filePath) &&
    existsSync(filePath) &&
    (await stat(filePath)).isFile()
  )
    return filePath

  const modulePath = join(findNodeModules(dir), filePath)

  if (existsSync(modulePath) && (await stat(modulePath)).isFile())
    return modulePath

  try {
    return await findModuleEntryPath(modulePath)
  } catch (e) {
    console.error("Got error in finding path required by file: " + refPath)
    throw e
  }
}

async function findModuleEntryPath(path: string): Promise<string> {
  const packageJsonPath = join(path, "package.json")

  if (!existsSync(packageJsonPath))
    throw new Error("no package.json found at path: " + path)

  const [error, packageJsonFile] = await catchError(read, packageJsonPath)
  if (error) {
    throw new Error(
      `failed to read package.json at path: ${packageJsonPath}\n\t error: ${error.message}`
    )
  }

  const [parsedError, parsedPackageJson] = await catchError(
    JSON.parse,
    packageJsonFile
  )
  if (parsedError) {
    throw new Error(
      `failed to parse package.json at path: ${packageJsonPath}\n\t error: ${parsedError.message}`
    )
  }

  const { main, browser, module, unpkg, jsdelivr } = parsedPackageJson
  const entry = main || browser || module || unpkg || jsdelivr

  if (!entry) {
    throw new Error(
      "no entry file found in package.json, path: " + packageJsonPath
    )
  }
  if (typeof entry !== "string") {
    throw new Error(
      "entry file in package.json is not a string, path: " + packageJsonPath
    )
  }

  const entryFile = await get1stEntryFile(join(path, entry))

  if (entryFile === null)
    throw new Error(
      `The entry file at ${entry} found in package.json is not a file, path: ` +
        packageJsonPath
    )

  return entryFile
}
async function get1stEntryFile(entryPath: string): Promise<string | null> {
  const files = [
    entryPath,
    join(entryPath, "index.ts"),
    join(entryPath, "index.js"),
    entryPath + ".ts",
    entryPath + ".js",
  ]

  for (const entryPath of files) {
    if (existsSync(entryPath) && (await stat(entryPath)).isFile()) {
      return entryPath
    }
  }

  return null
}
function findNodeModules(dir: string): string {
  const mainDir = dir

  while (dir !== dirname(dir)) {
    let path = join(dir, "node_modules")

    if (existsSync(path)) return path

    dir = dirname(dir)
  }

  throw new Error(`no node_modules found in path: ${mainDir}`)
}

// --------------------  helpers  --------------------
function joinRgxs(rgxs: RegExp[]): RegExp {
  return new RegExp(rgxs.map(rgx => rgx.source).join("|"), "g")
}

// --------------------  types  --------------------
type Converter = {
  regex: RegExp
  converter: (...args: string[]) => Parser | Parser[]
}
namespace Parser {
  export type String = {
    type: "string"
    content: string
  }
  export type Text = {
    type: "text"
    content: string
  }
  export type Link = {
    type: "link"
    content: string
  }
}
type Parser = Parser.String | Parser.Text | Parser.Link
