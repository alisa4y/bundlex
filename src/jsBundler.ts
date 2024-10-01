import { Info } from "./data"
import { existsSync } from "fs"
import { readFile, stat } from "fs/promises"
import { compose, mapFactory, retry, curry } from "vaco"
import { extname, dirname, join } from "path"
import ts from "typescript"

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

        const linkPath = await fixPath(linkStr.content.slice(1, -1), path)
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
async function fixPath(path: string, refPath: string): Promise<string> {
  let p: string
  const dir = dirname(refPath)

  if (path[0] === ".") p = join(dir, path)
  else if (existsSync(path) && (await stat(path)).isFile()) p = path
  else {
    const modulePath = join(findNodeModules(dir), path)

    if (existsSync(modulePath) && (await stat(modulePath)).isFile())
      p = modulePath
    else
      try {
        p = await findModuleEntryPath(modulePath)
      } catch (e) {
        console.error("Got error in finding path required by file: " + refPath)
        throw e
      }
  }

  if (existsSync(p)) {
    if ((await stat(p)).isDirectory()) {
      const ext = extname(refPath)

      if (ext === ".ts") {
        const tsIndexFile = join(p, "index.ts")

        if (existsSync(tsIndexFile)) return tsIndexFile
      }

      return join(p, "index.js")
    }
  } else {
    if (!p.endsWith(".ts") || !p.endsWith(".js")) {
      const tsFile = p + ".ts"

      if (existsSync(tsFile)) return tsFile

      return p + ".js"
    }
  }

  return p
}

async function findModuleEntryPath(path: string): Promise<string> {
  const packageJsonPath = join(path, "package.json")

  if (!existsSync(packageJsonPath))
    throw new Error("no package.json found at path: " + path)

  const { main, browser, module, unpkg, jsdelivr } = JSON.parse(
    (await read(packageJsonPath)) as string
  )
  const entry = main || browser || module || unpkg || jsdelivr
  const filePath = join(path, entry)

  if (existsSync(filePath)) return filePath

  throw new Error(
    "no entry file found in package.json, path: " + packageJsonPath
  )
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
