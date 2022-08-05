import { impundler } from "../src/index.js"
import { writeFileSync } from "fs"
import { timeout } from "js-tools"

const expected = [
  "hello world",
  "hello ali",
  "hi ali",
  "hi world",
  "hello world",
]
const changes = [
  () =>
    writeFileSync(
      "./test/modules/m1.js",
      `import { greet } from "./m2.js"
      console.assert(greet("ali") === expect, "watching change file failed")`
    ),
  () =>
    writeFileSync(
      "./test/modules/m2.js",
      `export function greet(name) {
        return "hi " + name
      }`
    ),
  () =>
    writeFileSync(
      "./test/modules/m1.js",
      `import { greet } from "./m2.js"
      console.assert(greet("world") === expect, "watching change file failed")`
    ),
  () =>
    writeFileSync(
      "./test/modules/m2.js",
      `export function greet(name) {
        return "hello " + name
      }`
    ),
]
let count = 0
impundler("./test/modules/m1.js", { watch: true }, async m => {
  let expect = expected[count++]
  eval(m)
  let f = changes.shift()
  if (f) {
    await timeout(250)
    f()
  } else {
    process.exit()
  }
})

impundler("./test/modules/m3.js", m => {
  // writeFileSync("./bundle.js", m, "utf8")
  eval(m)
})
impundler("./test/common/b.js", m => {
  eval(m)
})
