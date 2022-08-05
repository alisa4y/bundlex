import { reduce } from "js-tools"

const o = { a: 1, b: 2, c: 3 }

console.assert(reduce(o, (acc, v) => acc + v, 0) === 6, "expected 6")
