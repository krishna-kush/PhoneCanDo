// Engine seam: screens reach expo-file-system only through here (AGENTS.md:
// app/src/engine is the only importer of native modules).
import { Directory, Paths } from 'expo-file-system';

/** Names of the folders directly inside `path` (absolute), sorted. Throws when unreadable. */
export function listSubfolders(path: string): string[] {
  const names: string[] = [];
  for (const item of new Directory(`file://${path}`).list()) {
    if (item instanceof Directory) names.push(item.name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

/** Free bytes on the app's data storage; null when Android won't say. */
export function freeDiskBytes(): number | null {
  try {
    const free = Paths.availableDiskSpace;
    return Number.isFinite(free) && free > 0 ? free : null;
  } catch {
    return null;
  }
}
