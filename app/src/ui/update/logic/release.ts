// The newer build's release page on GitHub, where its full notes are:
// read off its APK's own address (manifest.ts only takes ours,
// `…/releases/download/<tag>/<file>`), so it is always the tag that
// downloads. Pure (zero RN imports).

/** `…/releases/download/v1.0.1/x.apk` → `…/releases/tag/v1.0.1`; null for any other address. */
export function releasePageOf(apkUrl: string): string | null {
  const m = /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\/download\/([^/]+)\/[^/]+$/.exec(apkUrl);
  return m ? `${m[1]}/releases/tag/${m[2]}` : null;
}
