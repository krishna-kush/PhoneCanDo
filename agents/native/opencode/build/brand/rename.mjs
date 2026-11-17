// The web UI's own name in every language: OpenCode -> PhoneCanDo in the
// strings that name the app itself, in each of packages/app's locale files.
// Strings that name OpenCode's services (OpenCode Zen, Go, Console), its
// server, its free models or its team keep the name: there it is the true
// one. A script, not the brand patch, because these lines are in 60-odd
// files and a pin bump would mean rebasing every one of them.
//
//   bun brand/rename.mjs <opencode checkout> [--check]
//
// Safe to rerun: a string already renamed counts as done. Fails when a key
// below is gone from en.ts or no longer names OpenCode (upstream reworded
// it): look at the new string and update KEYS. --check (ci/upstream.sh)
// counts without writing.
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const KEYS = [
  "provider.connect.apiKey.description",
  "error.chain.mcpFailed",
  "project.settings.name.description",
  "project.settings.extensions.empty.mcps.description",
  "project.settings.extensions.empty.plugins.description",
  "project.settings.extensions.empty.skills.description",
  "settings.general.row.language.description",
  "settings.general.row.colorScheme.description",
  "settings.general.row.theme.description",
  "settings.workspaces.empty.description",
]
const FROM = /OpenCode(?![A-Za-z])/g
const NAMES = /OpenCode(?![A-Za-z])/
const TO = "PhoneCanDo"

const tree = process.argv[2]
const check = process.argv[3] === "--check"
if (!tree) {
  console.error("usage: rename.mjs <opencode checkout> [--check]")
  process.exit(2)
}
const dir = join(tree, "packages/app/src/runtime/i18n")

// The key's string value: "…" or '…', on its line or the next.
const valueOf = (key) => new RegExp(`("${key.replace(/\./g, "\\.")}":\\s*)(["'])((?:\\\\.|(?!\\2).)*)\\2`)

const en = readFileSync(join(dir, "en.ts"), "utf8")
const drift = KEYS.filter((key) => {
  const m = valueOf(key).exec(en)
  return !m || !(NAMES.test(m[3]) || m[3].includes(TO))
})
if (drift.length) {
  console.error(`brand: en.ts no longer has these keys naming OpenCode: ${drift.join(", ")}`)
  process.exit(1)
}

let renamed = 0
let done = 0
let files = 0
for (const name of readdirSync(dir).sort()) {
  if (!/^[a-z]{2,3}\.ts$/.test(name)) continue
  const path = join(dir, name)
  const before = readFileSync(path, "utf8")
  let after = before
  for (const key of KEYS) {
    after = after.replace(valueOf(key), (_all, head, quote, value) => {
      const next = value.replace(FROM, TO)
      if (next !== value) renamed++
      else if (value.includes(TO)) done++
      return `${head}${quote}${next}${quote}`
    })
  }
  if (after !== before) {
    if (!check) writeFileSync(path, after)
    files++
  }
}
const verb = check ? "to rename" : "renamed"
console.log(`brand: ${renamed} strings ${verb} in ${files} locale files (${done} already done)`)
if (renamed + done === 0) {
  console.error("brand: no locale string named OpenCode under the listed keys")
  process.exit(1)
}
