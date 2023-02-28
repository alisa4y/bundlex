#!/usr/bin/env node
const { writeFile } = require("fs/promises")
const { join } = require("path")
const { impundler } = require("../dist/index.js")

const filename = process.argv[2]
const args = process.argv.slice(3)
const outputPath = "./bundle.js"
const data = {
  output: join(process.cwd(), outputPath),
}
main()

function main() {
  parseArgs(data, ...process.argv.slice(3))
  impundler(filename, data, onChange)
}
function parseArgs(data, arg, ...args) {
  switch (arg) {
    case "--watch":
    case "-w":
      data.watch = true
      break
    case "--output":
    case "-o":
      data.output = join(process.cwd(), args.shift())
      break
    case "--config":
    case "-c":
      const options = require(join(process.cwd(), args.shift()))
      Object.assign(data, options)
      break
  }
  if (args.length !== 0) return parseArgs(data, ...args)
  return data
}
async function onChange() {
  await writeFile(data.output, code, "utf8")
  console.log("written into " + data.output)
}
