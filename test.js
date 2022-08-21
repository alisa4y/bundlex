const r = /\s*\{.*\}\s*/y
r.lastIndex = 1
const str = "{ greet }"

console.log(r.exec(str))
