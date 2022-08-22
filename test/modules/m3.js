import { reduce } from "js-tools"
import data from "./data.json"
import def from "./def.js"

const o = { a: 1, b: 2, c: 3 }
console.assert(def.def, "this is defalut")
console.assert(data.msg, "a message from data")
console.assert(reduce(o, (acc, v) => acc + v, 0) === 6, "expected 6")
