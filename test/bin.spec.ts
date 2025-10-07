import { exec, ExecException } from "child_process"
import { existsSync, rmSync, readFileSync } from "fs"
import { join } from "path"
import { timeout } from "vaco"

// --------------------  constants  --------------------
const defaultPath = join(process.cwd(), "bundle.js")
const customName = "output.js"
const customPath = join(process.cwd(), "test/cli", customName)
const filePath = `./test/cli/b.js`

// --------------------  tests  --------------------
jest.setTimeout(20000)
describe.skip("CLI command tests", () => {
  beforeAll(() => {
    clean()
  })
  it("should run the bundlex command successfully", async () => {
    const stdout = await execPromise(`npx bundlex ${filePath}`)

    expect(stdout).toContain(`bundling file: ${filePath}`)
    expect(existsSync(defaultPath)).toBe(true)

    const bundleContent = readFileSync(defaultPath).toString()
    const { msg } = eval(bundleContent) // eval can still throw

    expect(msg).toEqual("heey")
  })
  it("can take output path option", async () => {
    const stdout = await execPromise(
      `npx bundlex ${filePath} --output "${customPath}"`
    )

    expect(stdout).toContain("bundling file: ./test/cli/b.js")
    expect(existsSync(customPath)).toBe(true)

    const { msg } = eval(readFileSync(customPath).toString())

    expect(msg).toEqual("heey")
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
function execPromise(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      (error: ExecException | null, stdout: string, stderr: string) => {
        if (error) {
          reject(error)
          return
        }

        resolve(stdout)
      }
    )
  })
}
