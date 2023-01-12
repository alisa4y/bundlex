const { readFileSync } = require("fs")

module.exports = function getCookie() {
  return readFileSync("./test/js-cookie.js", "utf-8")
}
