import { FSWatcher } from "fs"

// --------------------  types  --------------------
export type Bundle = (path: string) => Promise<string>
export type WatcherBundle = {
  (path: string): Promise<string>
  on: (EventName: EventNames, listener: Listener) => void
  close: () => void
}
const v: WatcherBundle = {} as any as WatcherBundle

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
export type EventNames = "change"
export type Listener = (path: string) => void
