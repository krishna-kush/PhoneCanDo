// opencode keeps sessions and server projects in SQLite files under
// ~/.local/share/opencode (upstream path). The project list has no delete
// API, so wiping those files is the only way to clear stale rows. Call it
// with the engine stopped.
export async function wipeData(homeDir: string): Promise<number> {
  const { Directory } = await import('expo-file-system');
  const dir = new Directory(`file://${homeDir}/.local/share/opencode`);
  let removed = 0;
  for (const entry of dir.list()) {
    const name = entry.name ?? '';
    if (
      name.startsWith('opencode-') &&
      (name.endsWith('.db') || name.endsWith('.db-shm') || name.endsWith('.db-wal'))
    ) {
      try {
        entry.delete();
        removed++;
      } catch {
        // locked or gone — restart will surface it
      }
    }
  }
  return removed;
}
