import { shield, factory, replaceMulti, timeout } from "js-tools"
import { watch } from "fs"
import { readFile } from "fs/promises"
import { basename, dirname, extname, join } from "path"

const defaultOptions = {
  // cache: true,
  minify: false,
  watch: false,
}
const genId = (function () {
  let i = 0
  return () => "id" + i++
})()
const ids = factory(() => genId())
async function figurePath(dir, path) {
  if (path[0] === ".") {
    path = join(dir, path)
    if (extname(path) === "") path += ".js"
    return path
  }
  path = join(process.cwd(), "node_modules", path)
  return await readFile(join(path, "package.json"), "utf8").then(json =>
    join(path, JSON.parse(json).main)
  )
}
function wrapFile(file, exports, id) {
  return `function(__exports={}, module={}) {${
    file + "\n" + exports
  } \n   ${id}=()=>__exports;  return __exports}`
}
const Rgxs = {
  impFrom: /import\s+(.*)\s+from\s*(?:"|')(.*?)(?:"|')/g,
  expFrom: /export\s+\*\s+from\s+(?:"|')(.*?)(?:"|')/g,
  exp: /export\s+(?:const|let|var|function)?\s*([^\s(]+)?\s*/g,
  req: /require\((?:"|'|`)(.*)(?:"|'|`)\)/g,
  exports: /([\s;({[]|^)(?:module\.)?exports/g,
}
async function transformFile(path) {
  let imports = new Set()
  let exports = ""
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
  const file = await replaceMulti(fileData, [
    [
      Rgxs.impFrom,
      async (m, ims, p) => {
        const imPath = await figurePath(dirname(path), p)
        imports.add(imPath)
        return `const ${ims} = ${ids[imPath]}()\n`
      },
    ],
    [
      Rgxs.expFrom,
      async (m, p) => {
        const imPath = await figurePath(dirname(path), p)
        imports.add(imPath)
        const name = basename(p, ".js")
        exports += `Object.assign(__exports,${name});`
        return `const ${name} = ${ids[imPath]}()\n`
      },
    ],
    [
      Rgxs.exp,
      (m, name) => {
        if (name === "*") return m
        exports += `__exports.${name} = ${name};`
        return m.slice(7)
      },
    ],
    [
      Rgxs.req,
      async (m, p) => {
        const imPath = await figurePath(dirname(path), p)
        imports.add(imPath)
        return `${ids[imPath]}()\n`
      },
    ],
    [Rgxs.exports, (m, g) => (g ? g : "") + "__exports"],
  ])
  imports = await Promise.all([...imports].map(imPath => files[imPath]))
  const obj = {
    id: ids[path],
    path,
    imports,
    allImports: getAllImports(imports),
    file: wrapFile(file, exports, ids[path]),
    parents: new Set(),
  }
  imports.forEach(im => im.parents.add(obj))
  return obj
}
const files = factory(transformFile)

function getAllImports(imports) {
  return new Set([
    ...imports,
    ...imports.map(({ allImports }) => [...allImports]).flat(),
  ])
}
function bundle({ allImports, file, id }) {
  return (
    [...allImports].map(v => `let ${v.id} = ${v.file} `).join("\n") +
    `\nlet ${id};(${file})()`
  )
}
export async function impundler(path, options, onChange) {
  if (typeof options === "function") {
    onChange = options
    options = {}
  }
  options = { ...defaultOptions, ...options }
  const entry = await files[path]
  onChange(bundle(entry))
  if (options.watch) {
    let { allImports } = entry
    entry.onChange = () => {
      const { allImports: newAllImports } = entry
      newAllImports.forEach(watchImport)
      allImports = newAllImports
      onChange(bundle(entry))
    }
    allImports.forEach(watchImport)
    watchImport(entry)
  }
  return entry
}
function isImportsChanged(imports, newImports) {
  if (imports.length !== newImports.length) return true
  if (imports.every((im, i) => im === newImports[i])) return false
  return imports.any?.(im => !newImports.includes(im))
}
function updateParents(im) {
  im.parents.forEach(p => {
    p.allImports = getAllImports(p.imports)
    p.onChange?.()
    updateParents(p)
  })
}
const handleChange = shield(async im => {
  const { imports } = im
  const {
    imports: newImports,
    file: newFile,
    allImports: newAllImports,
  } = await transformFile(im.path)
  if (isImportsChanged(imports, newImports)) {
    imports.forEach(im => im.parents.delete(im))
    newImports.forEach(im => im.parents.add(im))
    im.imports = newImports
    im.allImports = newAllImports
  }
  im.file = newFile
  im.onChange?.()
  updateParents(im)
}, 200)
function watchImport(im) {
  im.watcher ??= watch(
    im.path,
    eventType => eventType === "change" && handleChange(im)
  )
}
