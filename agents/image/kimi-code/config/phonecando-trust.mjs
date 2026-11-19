// Seeded by PhoneCanDo into the agent's own Kimi folder (KIMI_CODE_HOME) and
// run by its launch, with the phone tools on, before Kimi starts: lets our
// phonecando server's tools run without Kimi's approval prompt, since the
// phone-control lock is their check. It appends one rule to that folder's
// config.toml (Kimi takes permission rules from no other file), only when
// the file holds none for our server yet, and touches nothing else there:
//
//   [[permission.rules]]
//   decision = "allow"
//   pattern = "mcp__phonecando__*"
//
// A file that sets permission rules in a form the appended table would clash
// with (an inline `rules = [...]`, `permission = {...}`, a `[permission.rules]`
// table) is left as it is, and so is a link.
// Usage: node phonecando-trust.mjs <config.toml>
import { chmodSync, lstatSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const PATTERN = "mcp__phonecando__*"
export const RULE = `[[permission.rules]]\ndecision = "allow"\npattern = "${PATTERN}"\n`

const KEY = (name) => `\\s*(?:${name}|"${name}"|'${name}')\\s*`
const TABLE = new RegExp(`^\\s*\\[(?!\\[)([^\\]]*)\\]`)
const PERMISSION_TABLE = new RegExp(`^${KEY("permission")}$`)
const RULES_TABLE = new RegExp(`^${KEY("permission")}\\.${KEY("rules")}$`)
const ROOT_PERMISSION_KEY = new RegExp(`^${KEY("permission")}[=.]`)
const PERMISSION_RULES_KEY = new RegExp(`^${KEY("rules")}[=.]`)

// The file's text with our rule appended, or null when it stays as it is
// (it names our pattern already, or appending could clash).
export function withTrust(text) {
  if (text.includes(PATTERN)) return null
  let table = ""
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[\[/.test(line)) {
      table = "[["
      continue
    }
    const header = TABLE.exec(line)
    if (header) {
      table = header[1]
      if (RULES_TABLE.test(table)) return null
      continue
    }
    if (table === "" && ROOT_PERMISSION_KEY.test(line)) return null
    if (PERMISSION_TABLE.test(table) && PERMISSION_RULES_KEY.test(line)) return null
  }
  if (text.trim() === "") return RULE
  return `${text}${text.endsWith("\n") ? "" : "\n"}\n${RULE}`
}

function main(file) {
  let text = ""
  let mode
  try {
    const stat = lstatSync(file)
    if (!stat.isFile()) return
    mode = stat.mode & 0o7777
    text = readFileSync(file, "utf8")
  } catch (error) {
    if (error?.code !== "ENOENT") return
  }
  const next = withTrust(text)
  if (next === null) return
  const tmp = `${file}.tmp`
  writeFileSync(tmp, next, mode === undefined ? undefined : { mode })
  if (mode !== undefined) chmodSync(tmp, mode)
  renameSync(tmp, file)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file] = process.argv.slice(2)
  if (!file) process.exit(64)
  main(file)
}
