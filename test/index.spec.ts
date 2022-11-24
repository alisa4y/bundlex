import { impundler } from "../src"
import { writeFile } from "fs/promises"
import { timeout } from "flowco"

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
        return greet("ali")`
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
      expect(eval(result)).toEqual("hi ali")
    })
  })
  it("can read json file", () => {
    impundler("./test/modules/readJson.js", result => {
      eval(result)
    })
  })
  it("can import default export", () => {
    impundler("./test/modules/getDef.js", result => {
      eval(result)
    })
  })
  it("can bundle commonjs file", () => {
    impundler("./test/common/b.js", result => {
      eval(result)
    })
  })
  it("can bundle from node_modules", () => {
    impundler("./test/modules/m3.js", result => {
      eval(result)
    })
  })
  it("can watch for changes", done => {
    const changes = [
      () =>
        writeFile(
          "./test/modules/m1.js",
          `import { greet } from "./m2.js"
          return greet("batman")`
        ),
      () =>
        writeFile(
          "./test/modules/m2.js",
          `export function greet(name) {
            return "hello " + name
          }`
        ),
      () =>
        writeFile(
          "./test/modules/m1.js",
          `import { greet } from "./m2.js"
          return greet("world")`
        ),
      ,
    ]
    let expects = ["hi ali", "hi batman", "hello batman", "hello world"]
    let index = 0
    impundler(
      "./test/modules/m1.js",
      { watch: true },
      async (result, bundle) => {
        expect(eval(result)).toEqual(expects[index])

        await timeout(350) // the watcher wont execute for 200ms
        changes[index++]?.()
        if (index === changes.length) {
          bundle?.close()
          done()
        }
      }
    )
  })
  it("can ignore comments", () => {
    impundler("./test/comment.js", result => {})
  })
})
