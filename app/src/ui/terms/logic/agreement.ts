// Whether this install still has to agree: whenever the version it agreed to
// is not the one this build carries (LICENSE_VERSION), so on the first
// launch, for anyone who used the app before we asked (nothing stored) and
// once more after each new license version. Pure (zero RN imports).

/** Still to agree: [stored] (the version agreed to here, null when never) is not [current]. */
export function needsAgreement(stored: string | null, current: string): boolean {
  return stored !== current;
}

/** Asked again: this install agreed to another version before (else it is the first time). */
export function isReAsk(stored: string | null, current: string): boolean {
  return stored != null && needsAgreement(stored, current);
}

/**
 * The license sheet asks on its own: not agreed to [current], first launch's
 * setup has run ([setUp]) and the first shift's hello is not waiting
 * ([helloPending]), since the hello sheet asks at the end of onboarding.
 */
export function asksOnItsOwn(o: { stored: string | null; current: string; setUp: boolean; helloPending: boolean }): boolean {
  return needsAgreement(o.stored, o.current) && o.setUp && !o.helloPending;
}
