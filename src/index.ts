import { factory, timeout, debounce } from "vaco"
import { asyncReplaceMultiPattern } from "arep"
import { watch, existsSync } from "fs"
import { readFile, access, readdir, stat } from "fs/promises"
import { basename, dirname, extname, join, parse } from "path"
import ts from "typescript"
import { delete_comments } from "delete_comments"

type IOptions = Partial<{
  bundleNodeModules: boolean
  watch: boolean
  onFileInvalidated: (filename: string, content: string) => void
  onFileDelete: (filename: string) => void
  minify: boolean
  plugins: Record<any, (code: string, filename: string) => string>
}>
const defaultOptions: IOptions = {
  watch: false,
  bundleNodeModules: true,
}
const genId = (function () {
  let i = 0
  return () => "id" + i++
})()
const ids = factory(genId)
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
const jsMatch = /(?<!\.d)\.[tj]sx?$/
async function findFile2(path: string) {
  try {
    const name = basename(path)
    const dir = dirname(path)
    const files = await readdir(dir)
    const found = files.find(
      f => f.startsWith(name) && parse(f).name.length - name.length <= 0
    )
    if (!found) return null

    const possibleFile = join(dir, found)
    if ((await stat(possibleFile)).isDirectory()) {
      if (name !== found) return null // means same start name but different folders
      const childFiles = await readdir(path)
      const indexFiles = childFiles.filter(
        f => parse(f).name === "index" && jsMatch.test(f)
      )
      const indexFile =
        indexFiles.length > 1
          ? indexFiles.find(f => f.endsWith("js"))
          : indexFiles[0]

      if (indexFile) return join(path, indexFile)

      const { main, browser, module, unpkg, jsdelivr } = await readFile(
        join(possibleFile, "package.json"),
        "utf8"
      )
        .then(JSON.parse)
        .catch(e => ({}))

      const entry = main || browser || module || unpkg || jsdelivr
      if (entry === undefined) {
        throw new Error(
          "no index or entry in package.json found for giving path: " + path
        )
      }
      return join(possibleFile, entry)
    }
    return possibleFile
  } catch (e) {
    return null
  }
}
async function findFile(path: string): Promise<string | null> {
  if (extname(path) !== "") return path // specific path returns as it is
  try {
    // if it is folder path try to get the package.json or a default index.js file in that folder
    if ((await stat(path)).isDirectory()) {
      const packageJsonPath = join(path, "package.json")
      if (!existsSync(packageJsonPath)) {
        const childFiles = await readdir(path)
        const indexFiles = childFiles.filter(
          f => parse(f).name === "index" && jsMatch.test(f)
        )
        const indexFile = getRightFile(indexFiles)

        if (indexFile === null)
          throw new Error(
            "no package.json or index file found for giving path: " + path
          )
        return join(path, indexFile)
      }

      const { main, browser, module, unpkg, jsdelivr } = JSON.parse(
        await readFile(packageJsonPath, "utf8")
      )
      const entry = main || browser || module || unpkg || jsdelivr
      return join(path, entry)
    }
  } catch {
    // assumes the path is a file with no extension
    const dir = dirname(path)
    if (basename(dir) === "node_modules" || !existsSync(dir)) return null // assumes it is native
    const bn = basename(path)
    const indexFile = getRightFile(
      (await readdir(dir)).filter(f => parse(f).name === bn)
    )
    if (indexFile !== null) return join(dir, indexFile)
  }
  return null
}
function getRightFile(files: string[]): string | null {
  if (files.length === 1) return files[0]
  if (files.length > 1) return files.find(f => jsMatch.test(f))
  return null
}
async function figurePath(dir: string, path: string, options: IOptions) {
  switch (path[0]) {
    case ".":
      return findFile(join(dir, path))
    case "/":
      return findFile(join(process.cwd(), path))
    default:
      if (options.bundleNodeModules === false) return null
      return findFile(join(await findNodeModules(dir), path))
  }
}
function wrapFile(file: string, exports: string, id: string) {
  return `function(module={exports:{}}) {\nlet exports = module.exports;\n ${id}=()=> module.exports;
  ${file + "\n" + exports} return module.exports}`
}
const Rgxs = {
  quote: /'.*?(?:[^\\]|(?<=\\).)'/g,
  doubleQuote: /".*?(?:[^\\]|(?<=\\).)"/g,
  tilde: /`.*?(?:[^\\]|(?<=\\).)`/g,
  impFrom: /import\s+([\S\s]*?)from\s*(?:"|')(.*?)(?:"|')/g,
  expFrom: /export\s+\*\s+from\s+(?:"|')(.*?)(?:"|')/g,
  exp: /(?:[\s]|^)export\s+(?:const|let|var|function)?\s*([^\s(]+)?\s*/g,
  expB: /(?:[\s]|^)export\s*\{([^}]*)\}/g,
  expDef: /(?:[\s]|^)export\s*default\s*/g,
  req: /require\((?:"|'|`)(.*)(?:"|'|`)\)/g,
}
const impRgx = [
  /\s*\*\s+as\s+(\w+)\s*/y, // import * as name from "path"
  /\s*?\{[^}]*\}\s*/y, // import {name} from "path"
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
  onChangeListeners: Set<(filename: string, content: string) => void>
  loadingStats: Promise<{
    content: string
    imports: IFileNode[]
  }>
}
function removeUseStrict(content: string) {
  return content.replace(/[`'"]use strict[`'"];?/, "")
}
const JS_Filters = [removeUseStrict, delete_comments]
function filterJS(content: string) {
  return JS_Filters.reduce((acc, fn) => fn(acc), content)
}
async function getFileStats(path: string, options: IOptions) {
  const importsString: Set<string> = new Set()
  let exports = ""
  let imports = []
  const content = await getFileContent(path, options.plugins)
  let fileData = filterJS(content)
  let file = fileData
  file = await asyncReplaceMultiPattern(fileData, [
    {
      regexp: Rgxs.impFrom,
      callback: async (m, ims, p) => {
        const imPath = await figurePath(dirname(path), p, options)
        if (imPath === null) return m
        importsString.add(imPath)
        let strIndex = 0
        let ret = ""
        const handlers = [
          (m: string, name: string) =>
            (ret += `const ${name} = ${ids(imPath)}()\n`),
          (m: string) =>
            (ret += `const ${m.replace("as", ":")} = ${ids(imPath)}()\n`),
          (m: string) => (ret += `const ${m} = ${ids(imPath)}().default\n`),
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
      regexp: Rgxs.req,
      callback: async (m, p) => {
        const imPath = await figurePath(dirname(path), p, options)
        if (imPath === null) return m
        importsString.add(imPath)
        return `${ids(imPath)}()\n`
      },
    },
    {
      regexp: Rgxs.expFrom,
      callback: async (m, p) => {
        const imPath = await figurePath(dirname(path), p, options)
        if (imPath === null) return m
        importsString.add(imPath)
        const name = basename(p, ".js")
        exports += `Object.assign(exports,${name});`
        return `const ${name} = ${ids(imPath)}()\n`
      },
    },
    {
      regexp: Rgxs.quote,
      callback: async m => m,
    },
    {
      regexp: Rgxs.doubleQuote,
      callback: async m => m,
    },
    {
      regexp: Rgxs.tilde,
      callback: async m => m,
    },
    {
      regexp: Rgxs.expDef,
      callback: m => {
        return "exports.default ="
      },
    },

    {
      regexp: Rgxs.exp,
      callback: (m, name) => {
        if (name === "*") return m
        exports += `exports.${name} = ${name};`
        return m.slice(7)
      },
    },
    {
      regexp: Rgxs.expB,
      callback: (m, p) => {
        const exs = p.split(",")
        exs.forEach(ex => {
          let [name, nick] = ex.trim().split("as")
          exports += `exports.${nick} = ${name};`
        })
        return ""
      },
    },
  ])
  imports = [...importsString].map(imPath => getFile(imPath, options))
  return {
    content: `//${path}\n` + wrapFile(file, exports, ids(path)),
    imports,
  }
}
async function getFileContent(
  filePath: string,
  plugins?: IOptions["plugins"],
  count = 3
): Promise<string> {
  if (count === 0)
    throw new Error("file is empty or can't read it: " + filePath)
  const content = await readFile(filePath, "utf-8")
  // sometimes for some reasons OS can't read file so after an amount of time it retry to read the file again
  if (content === "") {
    await timeout(70)
    return getFileContent(filePath, plugins, count - 1)
  }
  const ext = extname(filePath)
  const pluginHandler = plugins?.[ext]
  if (pluginHandler) {
    return pluginHandler(content, filePath)
  }
  switch (ext) {
    case ".js":
      return content
    case ".json":
      return `export default ${content}`
    case ".ts":
      return ts.transpile(content, {
        module: ts.ModuleKind.Node16,
        removeComments: true,
        esModuleInterop: true,
      })
    default:
      throw new Error(`not supported format: "${extname(filePath)}"`)
  }
}
function transformFile(path: string, options: IOptions): IFileNode {
  const obj: IFileNode = {
    id: ids(path),
    path,
    imports: [],
    content: "",
    usedBy: new Set(),
    onChangeListeners: new Set(),
    loadingStats: getFileStats(path, options),
  }
  obj.loadingStats
    .then(stats => {
      Object.assign(obj, stats)
      stats.imports.forEach(o => o.usedBy.add(obj))
    })
    .catch(e => {
      handleFileStatsError(e, obj, options)
    })
  return obj
}
const getFile = factory(transformFile)

async function onReady(
  node: IFileNode,
  ancestorsPaths: Set<IFileNode> = new Set()
) {
  await node.loadingStats
  ancestorsPaths.add(node)
  await Promise.all(
    node.imports
      .filter(i => !ancestorsPaths.has(i))
      .map(i => onReady(i, ancestorsPaths))
  )
}
function getAllImports(
  imports: IFileNode[],
  ancestorsNode: Set<IFileNode>
): IFileNode[] {
  for (const n of imports) ancestorsNode.add(n)
  return [
    ...imports,
    ...imports
      .map(({ imports }) =>
        getAllImports(
          imports.filter(i => {
            if (!ancestorsNode.has(i)) {
              ancestorsNode.add(i)
              return true
            }
            return false
          }),
          ancestorsNode
        )
      )
      .flat(),
  ]
}
function bundle(node: IFileNode) {
  const { imports, content, id } = node
  return (
    getAllImports(imports, new Set([node]))
      .map(v => `var ${v.id} = ${v.content}`)
      .join("\n") + `\nvar ${id};(${content})()`
  )
}
type ImHandler = (result: string, bundle: Bundle) => void
export async function impundler(
  path: string,
  options: IOptions | ImHandler,
  onChange?: ImHandler
) {
  if (typeof options === "function") {
    onChange = options
  }
  options = { ...defaultOptions, ...options }
  const absPath = await findFile(toAbsolutePath(path))
  if (absPath === null) throw new Error("couldn't locate path: " + path)
  const entry = getFile(absPath, options)
  await onReady(entry)
  const bundleInstance = new Bundle(entry, options)
  await onChange(bundle(entry), bundleInstance)
  if (options.watch) {
    entry.onChange = () => {
      onChange(bundle(entry), new Bundle(entry, options as IOptions))
    }
    watchAllImports(entry, options)
  }
  return bundleInstance
}
function toAbsolutePath(path: string, dir = process.cwd()) {
  switch (path[0]) {
    case ".":
    case "/":
      return join(dir, path)
    default:
      return path
  }
}
function watchAllImports(
  o: IFileNode,
  options: IOptions,
  seenNodes: Set<IFileNode> = new Set()
) {
  if (seenNodes.has(o)) return
  seenNodes.add(o)
  if (options.onFileInvalidated !== undefined)
    o.onChangeListeners.add(options.onFileInvalidated)
  watchNode(o, options)
  o.imports.forEach(imo => watchAllImports(imo, options, seenNodes))
}
function updateOwners(
  node: IFileNode,
  options: IOptions,
  seenNodes: Set<IFileNode> = new Set()
) {
  node.usedBy.forEach(p => {
    if (seenNodes.has(p)) return
    seenNodes.add(p)
    p.onChangeListeners.forEach(f => f(p.path, p.content))
    p.onChange?.()
    updateOwners(p, options, seenNodes)
  })
}
function handleFileStatsError(e: any, node: IFileNode, options: IOptions) {
  deleteNode(node, options)
}
type WatchHandler = (node: IFileNode, options: IOptions) => void
function watchNode(node: IFileNode, options: IOptions) {
  const handler = debounce((fn: WatchHandler) => fn(node, options), 100)
  node.watcher ??= watch(node.path, eventType =>
    handler(eventType === "change" ? handleChange : deleteNode)
  )
}
async function handleChange(node: IFileNode, options: IOptions) {
  node.imports.forEach(o => o.usedBy.delete(node))
  try {
    Object.assign(node, await getFileStats(node.path, options))
  } catch (e) {
    return handleFileStatsError(e, node, options)
  }
  node.imports.forEach(o => o.usedBy.add(node))
  watchAllImports(node, options)
  if (node.onChange) {
    onReady(node).then(() => {
      node.onChange()
    })
  }
  node.onChangeListeners.forEach(f => f(node.path, node.content))
  updateOwners(node, options)
}

class Bundle {
  constructor(public node: IFileNode, public options: IOptions) {}
  closeWatcher() {
    closeWatcher(this.node)
  }
  unhandle() {
    this.node.onChange = undefined
  }
}
export function closeAllBundles() {
  Object.values(getFile.__store).forEach(n => n.watcher?.close())
}
function closeWatcher(o: IFileNode) {
  o.watcher?.close()
  o.imports.forEach(closeWatcher)
}
function deleteNode(node: IFileNode, options: IOptions) {
  options.onFileDelete?.(node.path)
  node.imports.forEach(imNode => {
    imNode.usedBy.delete(node)
    if (imNode.usedBy.size === 0 && imNode.onChange === undefined)
      deleteNode(imNode, options)
  })
  node.usedBy.forEach(u =>
    u.imports.splice(u.imports.findIndex(v => v === node))
  )
  node.watcher?.close()
  delete getFile.__store[node.path]
}
