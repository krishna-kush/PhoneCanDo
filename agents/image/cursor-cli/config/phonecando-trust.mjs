// Run by the launch, with Cursor's own node, before cursor-agent starts when
// the phone tools are on: trusts our phonecando server's tools in Cursor's
// cli-config.json, so they never wait on Cursor's approval prompt (the
// phone-control lock is their check). Only Mcp() entries for our server go
// in, never Shell, Write or another server, and only the ones missing; every
// other key and entry stays. A file that does not parse is left alone.
// Cursor matches Mcp(server:tool) on the server's identifier, which for a
// plugin's server is plugin-<plugin>-<name> (cursor-agent 2026.11.19), so
// both names are trusted.
// Usage: node phonecando-trust.mjs
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const TRUST = ["Mcp(phonecando:*)", "Mcp(plugin-phonecando-phonecando:*)"]

// Where Cursor keeps it: CURSOR_CONFIG_DIR, else $XDG_CONFIG_HOME/cursor,
// else ~/.cursor.
function configDir() {
  const own = process.env.CURSOR_CONFIG_DIR
  if (own?.trim()) return own
  const xdg = process.env.XDG_CONFIG_HOME
  return xdg?.trim() ? join(xdg, "cursor") : join(homedir(), ".cursor")
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v)

const dir = configDir()
const file = join(dir, "cli-config.json")

let config = {}
let mode = 0o600
if (existsSync(file)) {
  try {
    config = JSON.parse(readFileSync(file, "utf8"))
    mode = statSync(file).mode & 0o777
  } catch {
    process.exit(0)
  }
  if (!isObject(config)) process.exit(0)
}
// A missing file is written as just our trust: Cursor fills in its other
// defaults on its first read (it merges a partial file over them).

if (config.permissions === undefined) config.permissions = {}
const permissions = config.permissions
if (!isObject(permissions)) process.exit(0)
if (permissions.allow === undefined) permissions.allow = []
if (!Array.isArray(permissions.allow)) process.exit(0)

const missing = TRUST.filter((entry) => !permissions.allow.includes(entry))
if (missing.length === 0) process.exit(0)
permissions.allow.push(...missing)

mkdirSync(dir, { recursive: true })
const tmp = `${file}.${process.pid}.phonecando.tmp`
writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", { mode })
renameSync(tmp, file)
