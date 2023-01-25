const { readFileSync } = require("fs")
const { writeFile } = require("fs/promises")

module.exports = function getCookie() {
  return readFileSync("./test/js-cookie.js", "utf-8")
}
