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
describe("CLI command tests", () => {
  beforeAll(() => {
    clean()
  })
  it("should run the bundlex command successfully", async () => {
    try {
      const { stdout, stderr } = await execPromise(`npx bundlex ${filePath}`)

      if (stderr) {
        console.warn("stderr output:", stderr)

        throw new Error(`Command produced unexpected stderr: ${stderr}`)
      }

      expect(stdout).toContain(`bundling file: ${filePath}`)

      expect(existsSync(defaultPath)).toBe(true)
      const bundleContent = readFileSync(defaultPath).toString()
      const { msg } = eval(bundleContent) // eval can still throw
      expect(msg).toEqual("heey")
    } catch (execResult) {
      // Handle errors from exec (rejected Promise)
      const { error, stderr } = execResult as { error: Error; stderr: string }
      console.error("Execution failed. Stderr:", stderr)
      // Fail the test explicitly with the error
      throw error // Re-throwing the error makes Jest fail the test clearly
    }
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

        expect(stdout).toContain("bundling file: ./test/cli/b.js")
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
function execPromise(
  command: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      (error: ExecException | null, stdout: string, stderr: string) => {
        if (error) {
          // Reject with an object containing the error and stderr for more context
          reject({ error, stderr })
          return
        }
        // Resolve with stdout and stderr
        resolve({ stdout, stderr })
      }
    )
  })
}
