import { mapFactory, throttle } from "vaco"
import {
  Bundle,
  BundleData,
  InfoExtractor,
  Bundler,
  Listener,
  EventNames,
} from "./data"
import { watch, FSWatcher } from "fs"
import { join } from "path"
import { onProcessTermination } from "ontermination"

// --------------------  constants  --------------------
const allWatchers: FSWatcher[] = []

// --------------------  main  --------------------
export function createBundler(
  extractor: InfoExtractor,
  bundler: Bundler
): Bundle {
  const onChangeListeners = [] as Listener[]
  const getBundleData = mapFactory(async (path: string) => {
    const info = await extractor(path)
    const data: BundleData = {
      info,
      imports: new Set(info.imports.map(getBundleData)),
      usedBy: new Set(),
      watcher: watch(
        path,
        throttle(async eventType => {
          switch (eventType) {
            case "change":
              // import
              const newInfo = await extractor(path)
              const removedImports = info.imports.filter(
                imp => !newInfo.imports.includes(imp)
              )
              const addedImports = newInfo.imports.filter(
                imp => !info.imports.includes(imp)
              )
              data.info = newInfo
              data.imports = new Set(newInfo.imports.map(getBundleData))
              ;(await Promise.all(removedImports.map(getBundleData))).forEach(
                b => {
                  b.usedBy.delete(data)

                  if (b.usedBy.size === 0) {
                    ;(b.watcher as FSWatcher).close()
                    getBundleData.collection.delete(b.info.path)
                  }
                }
              )
              ;(await Promise.all(addedImports.map(getBundleData))).forEach(
                b => {
                  b.usedBy.add(data)
                }
              )

              break
            case "rename":
              getBundleData.collection.delete(info.path)
              break
          }

          if (onChangeListeners.length > 0)
            findTopBundlesData(data).forEach(b => {
              onChangeListeners.forEach(f => {
                f(b.info.path)
              })
            })
        }, 500)
      ),
    }

    allWatchers.push(data.watcher)
    data.imports.forEach(async importedBundle => {
      ;(await importedBundle).usedBy.add(data)
    })

    return data
  })
  const transpiler = async (path: string) => {
    if (path[0] === ".") path = join(process.cwd(), path)

    const data = await getBundleData(path)

    return bundler((await getAllImports(data)).map(v => v.info))
  }
  transpiler.on = (event: EventNames, listener: Listener) => {
    switch (event) {
      case "change":
        onChangeListeners.push(listener)

        break
      default:
    }
  }

  return transpiler
}
async function getAllImports(
  bData: BundleData,
  seenBundles = new Set<BundleData>()
): Promise<BundleData[]> {
  if (seenBundles.has(bData)) return []

  seenBundles.add(bData)

  return [
    bData,
    ...(
      await Promise.all(
        (
          await Promise.all(Array.from(bData.imports))
        ).map(b => getAllImports(b, seenBundles))
      )
    ).flat(),
  ]
}
function findTopBundlesData(
  bData: BundleData,
  seenBundles = new Set<BundleData>()
): BundleData[] {
  if (seenBundles.has(bData)) return []

  seenBundles.add(bData)

  const results = Array.from(bData.usedBy).flatMap(b =>
    findTopBundlesData(b, seenBundles)
  )

  results.push(bData)

  return results
}

// --------------------  cleaning  --------------------
onProcessTermination(() => {
  console.log("closing all watchers in bundler")
  allWatchers.forEach(w => w.close())
})
