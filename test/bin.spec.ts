import { exec } from "child_process"
import { existsSync, rmSync, readFileSync } from "fs"
import { join } from "path"
import { timeout } from "vaco"

// --------------------  constants  --------------------
const defaultPath = join(process.cwd(), "bundle.js")
const customName = "output.js"
const customPath = join(process.cwd(), "test/cli", customName)
const filePath = `./test/cli/b.js`

// --------------------  tests  --------------------
describe("CLI command tests", () => {
  beforeAll(() => {
    clean()
  })
  it("should run the bundlex command successfully", done => {
    exec("npx bundlex " + filePath, async (error, stdout, stderr) => {
      if (error) {
        done(error) // Pass error to done to fail the test
        return
      }

      await timeout(200)

      const { msg } = eval(readFileSync("./bundle.js").toString())

      expect(stdout).toContain("bundling...")
      expect(msg).toEqual("heey")
      done()
    })
  })
  it("can take output path option", done => {
    exec(
      `npx bundlex ${filePath} --output ${customPath}`,
      async (error, stdout, stderr) => {
        if (error) {
          done(error)
          return
        }

        await timeout(200)

        const { msg } = eval(readFileSync(customPath).toString())

        expect(stdout).toContain("bundling...")
        expect(msg).toEqual("heey")
        done()
      }
    )
  })
  afterAll(() => {
    clean()
  })
})

// --------------------  cleaning  --------------------
function clean(): void {
  if (existsSync(customPath)) {
    rmSync(customPath)
  }
  if (existsSync(defaultPath)) {
    rmSync(defaultPath)
  }
}
