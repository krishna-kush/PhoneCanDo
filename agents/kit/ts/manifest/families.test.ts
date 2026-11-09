// The kit's package families are lre-api's PackageFamily ids, name for name:
// a manifest's install.families and packages keys, and a runtime's families,
// meet the family lre detects in the image. Reads lre's source, so a family
// added there fails here until the kit (rules.ts, both schemas, kit-manifest's
// PackageFamilies and kit-render's PackageCommands) knows it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { FAMILIES } from './rules.ts';

const OS_INFO = new URL('../../../../lre/api/src/main/kotlin/com/phonecando/lre/api/OsInfo.kt', import.meta.url);

/** The ids of `enum class PackageFamily(val id: String) { APT("apt"), ... }`. */
function lreFamilies(source: string): string[] {
  const body = /enum\s+class\s+PackageFamily\b[^{]*\{([^}]*)\}/.exec(source)?.[1];
  assert.ok(body, 'no enum class PackageFamily in OsInfo.kt');
  return [...body.matchAll(/\b[A-Z][A-Z0-9_]*\s*\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]);
}

describe('package families', () => {
  it("are lre-api's PackageFamily ids", () => {
    const lre = lreFamilies(readFileSync(OS_INFO, 'utf8'));
    assert.ok(lre.length > 0);
    assert.deepEqual([...FAMILIES].sort(), [...lre].sort());
  });
});
