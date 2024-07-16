export function removeDuplicate<T>(ar: T[]): T[] {
  return Array.from(new Set(ar))
}
