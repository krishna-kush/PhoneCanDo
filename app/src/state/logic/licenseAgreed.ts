// The license agreement an install keeps in its prefs (state/app/prefs.ts):
// the version agreed to and when, stored as one JSON value. A value that
// does not read back counts as never agreed, so the license gate
// (ui/terms/) asks again instead of letting it pass. This install only:
// never synced (settingsSync/keys.ts) and never sent. Pure (zero RN imports).

export type LicenseAgreed = {
  /** The license version agreed to, as LICENSE's first line names it ("1.1"). */
  version: string;
  /** When, as an ISO timestamp. */
  at: string;
};

/** Agreeing to [version] at [now]. */
export function licenseAgreement(version: string, now: Date): LicenseAgreed {
  return { version, at: now.toISOString() };
}

/** The stored value read back; null when there is none or it is not an agreement. */
export function readLicenseAgreed(raw: string | null | undefined): LicenseAgreed | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { version, at } = value as Record<string, unknown>;
    return typeof version === 'string' && version !== '' && typeof at === 'string' ? { version, at } : null;
  } catch {
    return null;
  }
}
