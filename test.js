import { RO, timeout } from "js-tools"
import { readFile } from "fs/promises"
// import { readFile } from "fs"

process.on("beforeExit", () => {
  console.log("a")
})
process.on("beforeExit", () => {
  console.log("b")
})
setTimeout(() => {}, 10000)
