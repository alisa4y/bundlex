import { Info } from "./data"
import { existsSync } from "fs"
import { readFile, stat } from "fs/promises"
import {
  compose,
  mapFactory,
  removeDuplicates,
  retry,
  separateArray,
  curry,
} from "vaco"
import { extname, dirname, join } from "path"
import ts from "typescript"

// --------------------  constants  --------------------
let id = 0
const idGen = mapFactory((path: string) => "id" + id++)
const stringRgxs: RegExp = joinRgxs([/'[^\\]*'/, /"[^\\]*"/, /`[^\\]*`/])
const commentRgxs: RegExp = joinRgxs([/\/\/.*/, /\/\*[\s\S]*?\*\//])
const ignoreConverter: Converter["converter"] = m => ({
  type: "ignore",
  content: m,
})
const linkRgx: RegExp = joinRgxs([
  /(?<=(?<!\w|\$)from)\s*(?:"|')(.*?)(?:"|')/,
  /(?<!\w|\$)require\((?:"|'|`)(.*)(?:"|'|`)\)/,
])
const impRgx = [
  /\s+\*\s+as\s+(\w+)/y, // import * as name from "path"
  /\s+\{[^}]*\}/y, // import {name} from "path"
  /\s+\w+/y, // import name from "path"
]
const importHandlers = [
  (m: string, name: string) => `${name}`,
  (m: string) => `${m.replaceAll(" as ", ": ")}`,
  (m: string) => `{default: ${m}}`,
]
const reExportHandlers: ((
  m: string,
  name: string
) => ExportName | ExportName[])[] = [
  (m: string, nick: string) => ({ name: "", nick: "." + nick }),
  (m: string) => getExportsName(m.trim().slice(1, -1)),
]
const commentParser = curry(parse, {
  regex: commentRgxs,
  converter: ignoreConverter,
})
const stringParser = curry(parse, {
  regex: stringRgxs,
  converter: ignoreConverter,
})
const linkParser = curry(parse, {
  regex: linkRgx,
  converter: (m, g1, g2) => ({
    type: "link",
    content: g1 || g2,
  }),
} as Converter)
const converters: Converter[] = [
  {
    regex: /(?<=\s|^)export\s+default\s+/g,
    converter: () => ({ type: "ignore", content: "exports.default = " }),
  },
  {
    regex: /(?<=\s|^)export\s+\*\s+from\s*(?:"|')(.*?)(?:"|')/g,
    converter: (m, g1) => [
      {
        type: "reExportAll",
      },
      { type: "link", content: g1 },
    ],
  },
  {
    regex: /(?<!\w|\$)import\s+([\S\s]*?)from/g,
    converter: m => ({
      type: "import",
      content: parseRgxs(
        m.slice(6),
        importHandlers.map((h, i) => ({ rgx: impRgx[i], handler: h }))
      ),
    }),
  },
  {
    regex: /(?<!\w|\$)export\s+([\S\s]*?)from/g,
    converter: m => ({
      type: "reExport",
      content: parseRgxs(
        m,
        reExportHandlers.map((h, i) => ({ rgx: impRgx[i], handler: h }))
      ).flat(),
    }),
  },
  {
    regex: /(?<!\w|\$)export\s+\{([^}]*)\}/g,
    converter: (m, g) => ({
      type: "export",
      content: getExportsName(g),
    }),
  },
  {
    regex:
      /(?:[\s]|^)export\s+(?:const|let|var|(?:async\s+)?function|class)\s*([^\s(]+)?\s*/g,
    converter: (m, g) => [
      { type: "ignore", content: m.slice(7) },
      { type: "export", content: [{ name: g, nick: g }] },
    ],
  },
]
const parsers = converters.reverse().map(converter => curry(parse, converter))
const mainParse = compose(...parsers, stringParser, linkParser, commentParser)
const read = retry(readFile, 250, 2000)

// --------------------  extractor  --------------------
export async function extractor(path: string): Promise<Info> {
  let content = (await read(path, "utf-8")) as string
  const ext = extname(path)

  if (ext === ".ts") content = transpileTs(content)

  const ps = mainParse([
    { type: "text", content: content.replace(/[`'"]use strict[`'"];?/, "") },
  ])

  await Promise.all(
    ps.map(async p => {
      if (p.type === "link") p.content = await fixPath(p.content, path)
    })
  )

  return {
    path,
    content: compile(ps),
    imports: removeDuplicates(
      ps.filter(p => p.type === "link").map(p => p.content)
    ),
  }
}
function transpileTs(content: string): string {
  return ts.transpile(content, {
    module: ts.ModuleKind.Node16,
    removeComments: true,
    esModuleInterop: true,
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
  return `function ${id}(module={exports:{}}) {\nconst exports = module.exports;\n${id}=()=> module.exports;\n\n${file}\n\treturn module.exports}`
}

// --------------------  compiler  --------------------
function compile(ps: Parser[]): string {
  const { matches: allExports, nonMatches } = separateArray(
    groupTypes(ps),
    ({ type }) => type.startsWith("export")
  )

  return (
    nonMatches
      .map((p, i) => {
        switch (p.type) {
          case "importGroup":
            return p.import.content
              .map(v => `const ${v} = ${idGen(p.link.content)}()`)
              .join("\n")
          case "link":
            return `${idGen(p.content)}()`

          default:
            return (p as any).content
        }
      })
      .join("") +
    (allExports.length === 0
      ? ""
      : `\nObject.assign(exports, {${(
          allExports as (
            | Parser.Export
            | Extract<CmopilerNodes, { type: "exportGroup" }>
          )[]
        )
          .map(p => {
            if (p.type === "export")
              return p.content
                .map(({ nick, name }) =>
                  nick === name ? nick : `${nick}: ${name}`
                )
                .join(", ")
            else if (p.export.type === "reExport")
              return p.export.content
                .map(
                  ({ nick, name }) =>
                    `${nick}: ${idGen(p.link.content)}()` + name
                )
                .join(",")
            else return `...${idGen(p.link.content)}()`
          })
          .join(", ")}})\n`)
  )
}
function groupTypes(ps: Parser[]): CmopilerNodes[] {
  const results: CmopilerNodes[] = []

  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]

    if (p.type === "reExport" || p.type === "reExportAll") {
      const link = getNextLink(ps, i)
      i++

      results.push({
        type: "exportGroup",
        export: p,
        link,
      })
    } else if (p.type === "import") {
      const link = getNextLink(ps, i)
      i++

      results.push({
        type: "importGroup",
        import: p,
        link,
      })
    } else results.push(p)
  }

  return results
}
function getNextLink(ps: Parser[], index: number): Parser.link {
  const link = ps[index + 1]

  if (link.type !== "link") throw new Error("expected link after import")

  return link
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
  else {
    const modulePath = join(findNodeModules(dir), path)

    if (existsSync(modulePath) && (await stat(modulePath)).isFile())
      p = modulePath
    else p = await findModuleEntryPath(modulePath)
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
    (await read(packageJsonPath, "utf8")) as string
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
function getExportsName(expression: string): ExportName[] {
  return expression.split(",").map(s => {
    let [name, nick] = s.split(" as ")
    nick ??= name

    return { name, nick }
  })
}
function parseRgxs<T>(
  str: string,
  handlers: { rgx: RegExp; handler: (...args: any) => T }[]
): T[] {
  let strIndex = 0
  const results: T[] = []

  while (strIndex < str.length) {
    handlers.some(({ rgx, handler }, i) => {
      rgx.lastIndex = strIndex
      const retExec = rgx.exec(str)

      if (retExec) {
        results.push(handler.apply(null, retExec))

        strIndex = rgx.lastIndex

        return true
      }

      return false
    })

    if (str[strIndex] === ",") strIndex++
    else break
  }

  return results
}
function joinRgxs(rgxs: RegExp[]): RegExp {
  return new RegExp(rgxs.map(rgx => rgx.source).join("|"), "g")
}

// --------------------  types  --------------------
type Converter = {
  regex: RegExp
  converter: (...args: string[]) => Parser | Parser[]
}
namespace Parser {
  export type Igonre = {
    type: "ignore"
    content: string
  }
  export type Text = {
    type: "text"
    content: string
  }
  export type link = {
    type: "link"
    content: string
  }
  export type Import = {
    type: "import"
    content: string[]
    // => content.forEach(name => const name = id1())
  }
  export type ReExport = {
    type: "reExport"
    content: ExportName[]
    // => Object.assign(exports, {nick: id1().name, nick2: id1().name2})
  }
  export type ReExportAll = {
    type: "reExportAll"
    // => Object.assign(exports,  id1())
  }
  export type Export = {
    type: "export"
    content: ExportName[]
    // => Object.assign(exports, {nick: name, nick2: name2})
  }
}
type ExportName = {
  name: string
  nick: string
}
type Parser =
  | Parser.Igonre
  | Parser.Text
  | Parser.link
  | Parser.Import
  | Parser.ReExport
  | Parser.Export
  | Parser.ReExportAll

type CmopilerNodes =
  | Parser.Igonre
  | Parser.Text
  | Parser.link
  | Parser.Export
  | {
      type: "exportGroup"
      export: Parser.ReExport | Parser.ReExportAll
      link: Parser.link
    }
  | { type: "importGroup"; import: Parser.Import; link: Parser.link }
