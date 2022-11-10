import { beforeEach, describe, it } from "mocha"
import * as chai from "chai"
import { impundler } from "../src"
import { writeFile } from "fs/promises"

const { expect } = chai

const expected = [
  "hello world",
  "hello ali",
  "hi ali",
  "hi world",
  "hello world",
]

describe("impundler", () => {
  beforeEach(done => {
    Promise.all([
      writeFile(
        "./test/modules/m1.js",
        `import { greet } from "./m2.js"
        greet("ali")`
      ),
      writeFile(
        "./test/modules/m2.js",
        `export function greet(name) {
          return "hi " + name
        }`
      ),
    ]).then(() => done())
  })
  it("bundles javascript file into one big file", () => {
    impundler("./test/modules/m1.js", result => {
      expect(result === "hello ali")
    })
  })
})
