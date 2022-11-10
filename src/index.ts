import { shield, factory, timeout } from "flowco"
import { asyncReplaceMultiPattern } from "arep"
import { watch } from "fs"
import { readFile, access } from "fs/promises"
import { basename, dirname, extname, join } from "path"

interface IOptions {
  minify: boolean
  watch: boolean
}

const defaultOptions: IOptions = {
  // cache: true,
  minify: false,
  watch: false,
}
const genId = (function () {
  let i = 0
  return () => "id" + i++
})()
const ids = factory(() => genId())
async function findNodeModules(dir: string): Promise<string> {
  try {
    const path = join(dir, "node_modules")
    await access(path)
    return path
  } catch (e) {
    const newDir = dirname(dir)
    if (newDir !== dir) {
      return findNodeModules(newDir)
    } else {
      throw Error("couldn't find node_module for dir " + dir)
    }
  }
}
async function figurePath(dir: string, path: string) {
  if (path[0] === ".") {
    path = join(dir, path)
    if (extname(path) === "") path += ".js"
    return path
  } else if (path[0] === "/") {
    path = join(process.cwd(), path)
    return path
  } else {
    path = join(await findNodeModules(dir), path)
    return await readFile(join(path, "package.json"), "utf8").then(json =>
      join(path, JSON.parse(json).main)
    )
  }
}
function wrapFile(file: string, exports: string, id: string) {
  return `function(__exports={}, module={}) {${
    file + "\n" + exports
  } \n   ${id}=()=>__exports;  return __exports}`
}
const Rgxs = {
  impFrom: /import\s+(.*)\s+from\s*(?:"|')(.*?)(?:"|')/g,
  expFrom: /export\s+\*\s+from\s+(?:"|')(.*?)(?:"|')/g,
  exp: /export\s+(?:const|let|var|function)?\s*([^\s(]+)?\s*/g,
  expB: /export\s*\{(.*)\}/g,
  expDef: /export\s*default\s*/g,
  req: /require\((?:"|'|`)(.*)(?:"|'|`)\)/g,
  exports: /([\s;({[]|^)(?:module\.)?exports/g,
}
const impRgx = [
  /\s*\*\s+as\s+(\w+)\s*/y, // import * as name from "path"
  /\s*\{.*\}\s*/y, // import {name} from "path"
  /\s*\w+\s*/y, // import name from "path"
]
interface IFileNode {
  id: string
  path: string
  content: string
  imports: IFileNode[]
  usedBy: Set<IFileNode>
  watcher?: ReturnType<typeof watch>
  onChange?: () => void
}
async function transformFile(path: string): Promise<IFileNode> {
  const importsString: Set<string> = new Set()
  let exports = ""
  let imports = []
  let fileData = await readFile(path, "utf8")
  if (fileData === "") {
    let count = 10
    while (count--) {
      await timeout(50)
      fileData = await readFile(path, "utf8")
      if (fileData !== "") break
    }
    if (fileData === "") console.log("file is empty, can't read it", path)
  }
  let file = fileData
  switch (extname(path)) {
    case ".json":
      fileData = `export default ${fileData}`
    default:
      file = await asyncReplaceMultiPattern(fileData, [
        {
          regexp: Rgxs.impFrom,
          callback: async (m, ims, p) => {
            const imPath = await figurePath(dirname(path), p)
            importsString.add(imPath)
            let strIndex = 0
            let ret = ""
            const handlers = [
              (m: string, name: string) =>
                (ret += `const ${name} = ${ids[imPath]}()\n`),
              (m: string) =>
                (ret += `const ${m.replace("as", ":")} = ${ids[imPath]}()\n`),
              (m: string) => (ret += `const ${m} = ${ids[imPath]}().default\n`),
            ]
            while (strIndex < ims.length) {
              impRgx.some((r, i) => {
                r.lastIndex = strIndex
                const retExec = r.exec(ims)
                if (retExec) {
                  handlers[i].apply(null, retExec)
                  strIndex = r.lastIndex
                  return true
                }
                return false
              })
              if (ims[strIndex] === ",") strIndex++
              else break
            }
            return ret
          },
        },
        {
          regexp: Rgxs.expDef,
          callback: m => {
            return "__exports.default ="
          },
        },
        {
          regexp: Rgxs.expFrom,
          callback: async (m, p) => {
            const imPath = await figurePath(dirname(path), p)
            importsString.add(imPath)
            const name = basename(p, ".js")
            exports += `Object.assign(__exports,${name});`
            return `const ${name} = ${ids[imPath]}()\n`
          },
        },
        {
          regexp: Rgxs.exp,
          callback: (m, name) => {
            if (name === "*") return m
            exports += `__exports.${name} = ${name};`
            return m.slice(7)
          },
        },
        {
          regexp: Rgxs.expB,
          callback: (m, p) => {
            const exs = p.split(",")
            exs.forEach(ex => {
              let [name, nick] = ex.trim().split("as")
              exports += `__exports.${nick} = ${name};`
            })
            return ""
          },
        },
        {
          regexp: Rgxs.req,
          callback: async (m, p) => {
            const imPath = await figurePath(dirname(path), p)
            importsString.add(imPath)
            return `${ids[imPath]}()\n`
          },
        },
        {
          regexp: Rgxs.exports,
          callback: (m, g) => (g ? g : "") + "__exports",
        },
      ])
      imports = await Promise.all(
        [...importsString].map(imPath => files[imPath])
      )
  }
  const obj: IFileNode = {
    id: ids[path],
    path,
    imports,
    content: wrapFile(file, exports, ids[path]),
    usedBy: new Set(),
  }
  imports.forEach(o => o.usedBy.add(obj))
  return obj
}
const files = factory(transformFile)

function getAllImports(imports: IFileNode[]): Set<IFileNode> {
  return new Set([
    ...imports,
    ...imports.map(({ imports }) => [...getAllImports(imports)]).flat(),
  ])
}

function bundle({ imports, content, id }: IFileNode) {
  return (
    [...getAllImports(imports)]
      .map(v => `let ${v.id} = ${v.content}`)
      .join("\n") + `\nlet ${id};(${content})()`
  )
}
type ImHandler = (bundle: string) => void
export async function impundler(
  path: string,
  options: IOptions | ImHandler,
  onChange?: ImHandler
) {
  if (typeof options === "function") {
    onChange = options
  }
  options = { ...defaultOptions, ...options }
  const entry = await files[path]
  onChange(bundle(entry))
  if (options.watch) {
    entry.onChange = () => {
      watchAllImports(entry)
      onChange(bundle(entry))
    }
    watchImport(entry)
  }
  return entry
}
function watchAllImports(o: IFileNode) {
  o.imports.forEach(im => {
    watchImport(im)
    watchAllImports(im)
  })
}
function updateParents(im: IFileNode) {
  im.usedBy.forEach(p => {
    p.onChange?.()
    updateParents(p)
  })
}
const handleChange = shield(async (im: IFileNode) => {
  im.imports.forEach(o => o.usedBy.delete(im))
  Object.assign(im, await transformFile(im.path))
  im.onChange?.()
  updateParents(im)
}, 200)
function watchImport(im: IFileNode) {
  im.watcher ??= watch(
    im.path,
    eventType => eventType === "change" && handleChange(im)
  )
}
