import { impundler } from "../src"
import { writeFile } from "fs/promises"
import { timeout } from "vaco"
import { transpileJSX } from "jsxpiler"

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
  it("returns module.exports in bundling ", () => {
    impundler("./test/common/m.js", result => {
      const exp = eval(result)
      expect(exp.data).toEqual("data of m.js")
    })
  })
  it("caches module.exports for future usages", () => {
    impundler("./test/common/m2.js", result => {
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
          bundle?.closeWatcher()
          done()
        }
      }
    )
  })
  it("can ignore comments", done => {
    impundler("./test/comment.js", result => {
      eval(result)
      done()
    })
  })
  it("can bundle browser module for example js-cookie", done => {
    impundler("./test/js-cookie.js", result => {
      done()
    })
  })
  it("test multilen import to bundleu", done => {
    impundler("./test/multiLine.js", result => {
      eval(result)
      done()
    })
  })
  it("can bundle typescript too", done => {
    impundler("./test/tsModules/m2.ts", result => {
      eval(result)
      done()
    })
  })
  it("can import folder by importing its index file", done => {
    impundler("./test/indexImport.ts", result => {
      const { doingAdd } = eval(result)
      expect(doingAdd).toEqual("2 + 4 = 6")
      done()
    })
  })
  it("if a module is not found it will leave it as it is and consider it to be a native module", done => {
    impundler("./test/native.js", code => {
      const getCookie = eval(code)
      expect(getCookie().replaceAll(/\r?\n/g, "")).toEqual(
        `import Cookies from "js-cookie"Cookies.set`
      )
      done()
    })
  })
  it("can handle circular dependency", done => {
    impundler("./test/circular_dependency/a.js", code => {
      const { a } = eval(code)
      expect(a).toEqual("AB")
      done()
    })
  })
  it("will throw error on empty files and can be handled", done => {
    impundler("./test/emptyFile.js", code => {}).catch(e => {
      done()
    })
  })
})
describe("passing plugins", () => {
  it("giving jsx plugin", done => {
    impundler(
      "./test/jsx",
      {
        plugins: {
          ".jsx": code => transpileJSX(code),
        },
      },
      code => {
        const { App } = eval(code)
        expect(App({ fname: "ali", lname: "safari" })).toEqual(`<main>
      <h1>
      greetings ali safari
    </h1>
    </main>`)
        done()
      }
    )
  })
})
describe("fixing some bugs on real life projects", () => {
  it("bundle correctly", done => {
    impundler("./test/quote.js", code => {
      eval(code)
      done()
    })
  })
})
