import { dirname, basename } from "path"
let str = "C:\\Dev\\web\\js-bundler\\test\\modules\\node_modules"
for (let index = 0; index < 10; index++) {
  console.log(basename(str))
  str = dirname(str).trim()
  if (!str) break
  console.log(str, str.length)
}
