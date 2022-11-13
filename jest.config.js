/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  verbose: true,
  rootDir: "test",
  preset: "ts-jest",
  testEnvironment: "node",
  testRegex: `.*\.spec\.ts`,
}
