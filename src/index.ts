import { createBundler } from "./core"
import { bundler, extractor } from "./jsBundler"

// --------------------  main  --------------------
export { createBundler }
export * from "./jsBundler"
export const jsBundler = createBundler(extractor, bundler)
