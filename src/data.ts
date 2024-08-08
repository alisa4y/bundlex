import { FSWatcher } from "fs"

// --------------------  types  --------------------
export type Bundle = (path: string) => Promise<string>
export type WatchBundle = {
  watch: (
    path: string,
    listener: Listener
  ) => Promise<{
    close: () => void
  }>
  bundle: (path: string) => Promise<string>
  close: () => void
}
export type Info = {
  imports: string[]
  path: string
  content: string
}
export type WatcherBundleData = {
  info: Info
  imports: Promise<WatcherBundleData>[]
  usedBy: Set<WatcherBundleData>
  watcher: FSWatcher
}
export type InfoExtractor = (path: string) => Promise<Info>
export type Bundler = (contents: Info[]) => string
export type Listener = (EventName: EventNames, path: string) => void
export type EventNames = "change"
