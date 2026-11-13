// Which settings follow a signed-in person to every phone (docs/accounts.md,
// Settings), and the check on a value read back from the account. Never
// synced: the usage-stats switch, Phone control's lock mode, keys and tokens,
// agents. Pure (zero RN imports).

/** The synced settings, as this phone holds them. */
export type SyncedSettings = {
  themeMode: 'system' | 'light' | 'dark';
  extraKeysSticky: boolean;
  updatePromptMuted: boolean;
  /** null: no cap. */
  maxAgents: number | null;
  maxModels: number | null;
};

export type SyncedKey = keyof SyncedSettings;

export const SYNCED_KEYS: readonly SyncedKey[] = ['themeMode', 'extraKeysSticky', 'updatePromptMuted', 'maxAgents', 'maxModels'];

/** The prefs kept in the app's store (state/app/prefs.ts). */
export const PREF_KEYS = ['themeMode', 'extraKeysSticky', 'updatePromptMuted'] as const satisfies readonly SyncedKey[];

/** The run caps, kept natively (engine/runLimits.ts). */
export const CAP_KEYS = ['maxAgents', 'maxModels'] as const satisfies readonly SyncedKey[];

function cap(v: unknown): number | null | undefined {
  if (v === null) return null;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 99 ? v : undefined;
}

/** `value` as `key`'s setting; undefined when it is not one this build understands. */
export function settingValue<K extends SyncedKey>(key: K, value: unknown): SyncedSettings[K] | undefined {
  switch (key) {
    case 'themeMode':
      return (value === 'system' || value === 'light' || value === 'dark' ? value : undefined) as SyncedSettings[K] | undefined;
    case 'extraKeysSticky':
    case 'updatePromptMuted':
      return (typeof value === 'boolean' ? value : undefined) as SyncedSettings[K] | undefined;
    case 'maxAgents':
    case 'maxModels':
      return cap(value) as SyncedSettings[K] | undefined;
  }
  return undefined;
}
