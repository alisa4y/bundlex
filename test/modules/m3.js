import { guard, aim } from "bafu"

const isDividedBy = (x, y) => x % y === 0
expect(isDividedBy(4, 2)).toEqual(true)
const isDividedBy2 = aim(isDividedBy, 2)
expect(isDividedBy2(4)).toEqual(true)

const isEven = guard(() => true, isDividedBy2)

expect(isEven(2)).toEqual(true)
expect(isEven(3)).toEqual(null)
