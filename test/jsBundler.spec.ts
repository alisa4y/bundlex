import {
  createBundler,
  jsBundle,
  jsWatchBundle,
  extractor,
  bundler,
} from "../src"
import { writeFile, readFile } from "fs/promises"
import { timeout } from "vaco"
import { transpileJSX } from "jsxpiler"
import { join } from "path"
import { writeFileSync } from "fs"
// --------------------  tests  --------------------
describe("extractor", () => {
  it("detects require paths", async () => {
    const info = await extractor("./test/common/multiReq.js")
    const links = ["core", "enc-base64", "md5", "evpkdf", "cipher-core"].map(
      p => p + ".js"
    )

    expect(info.imports.every((imp, i) => imp.endsWith(links[i]))).toBe(true)
  })
  it("ignores strings in backticks", async () => {
    const info = await extractor("./test/common/backTickReq.js")

    expect(info.imports.length).toBe(0)
  })
})
describe("jsBundler", () => {
  beforeAll(done => {
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
  it("bundles javascript file into one big file", async () => {
    const result = await jsBundle("./test/modules/m1.js")
    expect(eval(result)).toEqual("hi ali")
  })
  it("can import default export", async () => {
    const result = await jsBundle("./test/modules/getDef.js")
    eval(result)
  })
  it("can bundle commonjs file", async () => {
    const result = await jsBundle("./test/common/b.js")
    eval(result)
  })
  it("returns module.exports in bundling ", async () => {
    const result = await jsBundle("./test/common/m.js")
    const exp = eval(result)
    expect(exp.data).toEqual("data of m.js")
  })
  it("can bundle from node_modules", async () => {
    const result = await jsBundle("./test/modules/m3.js")
    eval(result)
  })
  it("can ignore comments", async () => {
    const result = await jsBundle("./test/comment.js")
    expect(() => eval(result)).not.toThrow()
  })
  it("can bundle browser module for example js-cookie", async () => {
    const result = await jsBundle("./test/js-cookie.js")
    expect(() => eval(result)).not.toThrow()
  })

  it("test multiline import to bundle", async () => {
    const result = await jsBundle("./test/multiLine.js")
    expect(() => eval(result)).not.toThrow()
  })
  it("can bundle typescript too", async () => {
    const result = await jsBundle("./test/tsModules/m2.ts")
    expect(() => eval(result)).not.toThrow()
  })
  it("can import file by importing its name without extension", async () => {
    const result = await jsBundle("./test/nameImport.ts")
    const { doingAdd } = eval(result)
    expect(doingAdd).toEqual("2 + 4 = 6")
  })
  it("can import file by importing its name even if it is index file without format", async () => {
    const result = await jsBundle("./test/indexImport.ts")
    const { doingAdd } = eval(result)
    expect(doingAdd).toEqual("2 + 4 = 6")
  })
  it("can import folder by importing its folder path and nothing more", async () => {
    const result = await jsBundle("./test/folderImport.ts")
    const { doingAdd } = eval(result)
    expect(doingAdd).toEqual("2 + 4 = 6")
  })
  it("if a module is not found it will throw error", async () => {
    await expect(async () => {
      const result = await jsBundle("./test/native.js")
      const getCookie = eval(result)

      getCookie().replaceAll(/\r?\n/g, "")
    }).rejects.toThrow()
  })
  it("can handle circular dependency", async () => {
    const result = await jsBundle("./test/circular_dependency/a.js")
    const { a } = eval(result)

    expect(a).toEqual("AB")
  })
  it("won't throw error on empty files ", async () => {
    await expect(jsBundle("./test/emptyFile.js")).resolves.not.toThrow()
  })
})
describe("watch jsBundle", () => {
  afterAll(() => {
    jsWatchBundle.close()
  })
  it("can set change listenr to update itself for changes", async () => {
    expect(eval(await jsWatchBundle("./test/modules/m1.js"))).toEqual("hi ali")

    await writeFile(
      "./test/modules/m1.js",
      `import { greet } from "./m2.js"
      return greet("batman")`
    )
    await timeout(10)

    expect(eval(await jsWatchBundle("./test/modules/m1.js"))).toEqual(
      "hi batman"
    )

    await writeFile(
      "./test/modules/m2.js",
      `export function greet(name) {
        return "hello " + name
      }`
    )
    await timeout(10)

    expect(eval(await jsWatchBundle("./test/modules/m1.js"))).toEqual(
      "hello batman"
    )
    await writeFile(
      "./test/modules/m1.js",
      `import { greet } from "./m2.js"
      return greet("world")`
    )
    await timeout(10)

    // the watcher has throttle time
    expect(eval(await jsWatchBundle("./test/modules/m1.js"))).toEqual(
      "hello batman"
    )

    await timeout(600)
    await writeFile(
      "./test/modules/m1.js",
      `import { greet } from "./m2.js"
      return greet("world")`
    )
    await timeout(10)

    expect(eval(await jsWatchBundle("./test/modules/m1.js"))).toEqual(
      "hello world"
    )
  })
  it("can add listener to listen when a file changes and give its path", done => {
    writeFileSync("./test/change_test/f1.js", `export const msg = "hello"`)
    jsWatchBundle("./test/change_test/f1.js").then(result => {
      try {
        expect(eval(result).msg).toEqual("hello")
      } catch (e) {
        done(e)
      }
      jsWatchBundle.on("change", async path => {
        expect(path).toEqual(join(process.cwd(), "./test/change_test/f1.js"))

        const result = await jsWatchBundle("./test/change_test/f1.js")

        expect(eval(result).msg).toEqual("hello world")
        done()
      })
      writeFile("./test/change_test/f1.js", `export const msg = "hello world"`)
    })
  })
})
describe("testing modifying bundler", () => {
  test("add json hook to handle json file", async () => {
    const newExtractor = async (path: string) => {
      if (path.endsWith(".json")) {
        return {
          imports: [],
          path,
          content:
            "exports.__esModule=true\nexports.default = " +
            (await readFile(path)),
        }
      }
      return extractor(path)
    }
    const newBundler = createBundler(newExtractor, bundler)

    expect(async () => {
      eval(await newBundler("./test/modules/readJson.js"))
    }).not.toThrow()
    expect(async () => {
      eval(await jsBundle("./test/modules/readJson.js"))
    }).rejects.toThrow()
  })
  test("handling jsx files", async () => {
    const newExtractor = async (path: string) => {
      const info = await extractor(path)
      return { ...info, content: transpileJSX(info.content) }
    }
    const newBundler = createBundler(newExtractor, bundler)
    const result = await newBundler("./test/jsx/index.jsx")

    const { App } = eval(result)
    expect(App({ fname: "ali", lname: "safari" })).toEqual(`<main>
      <h1>
      greetings ali safari
    </h1>
    </main>`)
  })
})
describe("fixing some bugs on real life projects", () => {
  it("bundle correctly", async () => {
    const code = await jsBundle("./test/quote.js")
    expect(() => eval(code)).not.toThrow
  })
  it("can bundle grafy class", async () => {
    const code = await jsBundle("./test/classTest.js")

    expect(() => eval(code)).not.toThrow
  })
})
