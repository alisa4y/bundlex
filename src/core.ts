import { mapFactory, throttle } from "vaco"
import {
  WatcherBundle,
  WatcherBundleData,
  InfoExtractor,
  Bundler,
  Listener,
  EventNames,
  Bundle,
  Info,
} from "./data"
import { watch, FSWatcher } from "fs"
import { join } from "path"
import { onProcessTermination } from "ontermination"
import { isAbsolute } from "path"

// --------------------  bundlers  --------------------
export function createBundler(
  extractor: InfoExtractor,
  bundler: Bundler
): Bundle {
  return async (path: string) =>
    bundler(await getAllInfos(getAbsPath(path), extractor))
}
async function getAllInfos(
  path: string,
  extractor: (p: string) => Promise<Info>,
  seenPath = new Set<string>()
): Promise<Info[]> {
  if (seenPath.has(path)) return []

  seenPath.add(path)

  const info = await extractor(path)

  return [
    info,
    ...(
      await Promise.all(
        info.imports.map(p => getAllInfos(p, extractor, seenPath))
      )
    ).flat(),
  ]
}

// --------------------  watch bundler  --------------------
export function createWatcherBundler(
  extractor: InfoExtractor,
  bundler: Bundler
): WatcherBundle {
  const onChangeListeners = [] as Listener[]
  const allWatchers: FSWatcher[] = []
  const closeAllWatchers = () => allWatchers.forEach(w => w.close())
  const getBundleData = mapFactory(async (path: string) => {
    const info = await extractor(path)
    const data: WatcherBundleData = {
      info,
      imports: info.imports.map(getBundleData),
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
              data.imports = newInfo.imports.map(getBundleData)
              ;(await Promise.all(removedImports.map(getBundleData))).forEach(
                b => {
                  b.usedBy.delete(data)

                  if (b.usedBy.size === 0) {
                    b.watcher.close()
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
    path = getAbsPath(path)
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
  transpiler.close = closeAllWatchers

  onProcessTermination(closeAllWatchers)

  return transpiler
}
async function getAllImports(
  bData: WatcherBundleData,
  seenBundles = new Set<WatcherBundleData>()
): Promise<WatcherBundleData[]> {
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
  bData: WatcherBundleData,
  seenBundles = new Set<WatcherBundleData>()
): WatcherBundleData[] {
  if (seenBundles.has(bData)) return []

  seenBundles.add(bData)

  const results = Array.from(bData.usedBy).flatMap(b =>
    findTopBundlesData(b, seenBundles)
  )

  results.push(bData)

  return results
}

// --------------------  tools  --------------------

function getAbsPath(path: string): string {
  return isAbsolute(path) ? path : join(process.cwd(), path)
}
