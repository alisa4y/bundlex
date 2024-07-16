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
import { removeDuplicate } from "./tools"
import { join } from "path"
import { onProcessTermination } from "ontermination"

// --------------------  constants  --------------------
const allWatchers: FSWatcher[] = []

// --------------------  main  --------------------
export function createBundler(
  extractor: InfoExtractor,
  _bundler: Bundler
): Bundle {
  const flags: { [key in EventNames]: boolean } = { change: false }
  const onChangeListeners = [] as Listener[]
  const getBundleData = mapFactory(async (path: string) => {
    const info = await extractor(path)
    const data = {
      info,
      imports: new Set(info.imports.map(getBundleData)),
      usedBy: new Set(),
    } as BundleData

    if (flags.change) {
      data.watcher = watch(
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

          const changedBundles = findTopBundlesData(data, bundler.collection)

          changedBundles.forEach(b => bundler.collection.delete(b.info.path))
          changedBundles.forEach(b =>
            onChangeListeners.forEach(f => f(b.info.path))
          )
        }, 500)
      )

      allWatchers.push(data.watcher)
    }

    data.imports.forEach(i =>
      i.then(d => {
        d.usedBy.add(data)
      })
    )

    return data
  })
  const bundler = mapFactory(async (path: string) => {
    const data = await getBundleData(path)

    return _bundler(
      removeDuplicate((await getAllImports(data)).map(v => v.info))
    )
  })

  const transpiler = async (path: string) => {
    if (path[0] === ".") path = join(process.cwd(), path)

    return bundler(path)
  }
  transpiler.on = (event: EventNames, listener: Listener) => {
    switch (event) {
      case "change":
        if (flags.change === false) {
          flags.change = true

          getBundleData.collection.clear()
          bundler.collection.clear()
        }

        onChangeListeners.push(listener)

        break
      default:
    }
  }

  return transpiler
}
async function getAllImports(
  bData: BundleData,
  seenInfos = new Set<BundleData>()
): Promise<BundleData[]> {
  if (seenInfos.has(bData)) return []

  seenInfos.add(bData)

  return [
    bData,
    ...(
      await Promise.all(
        (
          await Promise.all(Array.from(bData.imports))
        ).map(b => getAllImports(b, seenInfos))
      )
    ).flat(),
  ]
}
function findTopBundlesData(
  bData: BundleData,
  bundleCollection: Map<string, any>,
  seenBundles = new Set<BundleData>()
): BundleData[] {
  if (seenBundles.has(bData)) return []

  seenBundles.add(bData)

  const results = Array.from(bData.usedBy).flatMap(b =>
    findTopBundlesData(b, bundleCollection, seenBundles)
  )

  if (bundleCollection.has(bData.info.path)) results.push(bData)

  return results
}

// --------------------  cleaning  --------------------
onProcessTermination(() => {
  console.log("closing all watchers in bundler")
  allWatchers.forEach(w => w.close())
})
