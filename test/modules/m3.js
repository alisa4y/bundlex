import { compose, curry } from "vaco"

const isDividedBy = (x, y) => x % y === 0
expect(isDividedBy(4, 2)).toEqual(true)
const is9DividedBy = curry(isDividedBy, 9)
expect(is9DividedBy(3)).toEqual(true)
expect(is9DividedBy(4)).toEqual(false)

const isEven = compose((x => x === true, x => isDividedBy(x, 2)))

expect(isEven(2)).toEqual(true)
expect(isEven(3)).toEqual(false)
