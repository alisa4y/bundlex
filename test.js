const { readFileSync } = require("fs")

const r = /import\s+([\S\s]*?)from\s*(?:"|')(.*?)(?:"|')/
const r2 = /\s*?\{[^}]*\}\s*/

const file = readFileSync("./test/multiLine.js")
console.log(r2.exec(r.exec(file.toString())[1]))
