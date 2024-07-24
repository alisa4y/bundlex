import { createBundler, createWatcherBundler } from "./core"
import { bundler, extractor } from "./jsBundler"

// --------------------  main  --------------------
export { createWatcherBundler, createBundler }
export * from "./jsBundler"
export const jsBundle = createBundler(extractor, bundler)
export const jsWatchBundle = createWatcherBundler(extractor, bundler)
