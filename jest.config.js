/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  verbose: true,
  rootDir: "test",
  preset: "ts-jest",
  testEnvironment: "node",
  testRegex: `.*\.spec\.ts`,
}
