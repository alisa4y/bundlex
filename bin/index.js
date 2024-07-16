#!/usr/bin/env node

const { writeFile } = require("fs/promises")
const { join } = require("path")
const { jsBundler } = require("../build/index.js")

// --------------------  constants  --------------------
const filename = process.argv[2]
const args = process.argv.slice(3)
const outputPath = "./bundle.js"
const data = {
  watch: false,
  output: join(process.cwd(), outputPath),
}

// --------------------  main  --------------------
async function main() {
  parseArgs(data, ...args)
  await bundle(filename)

  if (data.watch) {
    jsBundler.on("change", bundle)
  } else process.exit()
}
function parseArgs(data, arg, ...args) {
  if (arg === undefined) return

  switch (arg) {
    case "--watch":
    case "-w":
      data.watch = true
      break
    case "--output":
    case "-o":
      const p = args.shift()
      data.output = p.startsWith(".") ? join(process.cwd(), p) : p
      break
    default:
      throw new Error(`unhandled argument
format is: 
npx bundlex [path-to-file] [args]
args are : 
  --watch | -w  // optional
  [[--output | -o] path-to-output]  // default ${outputPath}`)
  }

  if (args.length !== 0) return parseArgs(data, ...args)

  return data
}
async function bundle(path) {
  console.log("bundling...")
  await writeFile(data.output, await jsBundler(path), "utf8")
  console.log("bundled into: " + data.output)
}

// --------------------  main call  --------------------
main()
