import { FSWatcher } from "fs"

// --------------------  types  --------------------
export type Bundle = {
  (path: string): Promise<string>
  on: (EventName: EventNames, listener: Listener) => void
}
const v: Bundle = {} as any as Bundle

export type Info = {
  imports: string[]
  path: string
  content: string
}
export type BundleData = {
  info: Info
  imports: Set<Promise<BundleData>>
  usedBy: Set<BundleData>
  watcher: FSWatcher
}
export type InfoExtractor = (path: string) => Promise<Info>
export type Bundler = (contents: Info[]) => string
export type EventNames = "change"
export type Listener = (path: string) => void
