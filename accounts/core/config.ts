// What the server is set up with. Hosts build it from their environment.

/** The accounts server's settings. */
export interface AccountsConfig {
  /**
   * Google OAuth client IDs an ID token may be issued to (its `aud`): our web
   * client, which the app passes as Credential Manager's server client ID.
   * Empty: sign-in is off and nonce/signin answer not_configured.
   */
  clientIds: readonly string[];
}

/** Splits a comma list of client IDs, trimming blanks and duplicates. */
export function parseClientIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0))];
}
