// Seeded by PhoneCanDo into the agent's own Kimi folder (KIMI_CODE_HOME) and
// run by its launch before Kimi starts: puts the phone tools' MCP server
// into that folder's mcp.json, keeping every other server there. Kimi reads
// no variables in mcp.json, so the bridge's URL (its port can change) is
// written each start; the token stays in the environment, named by
// bearerTokenEnvVar, never on disk.
// Usage: node phonecando-mcp.mjs <mcp.json> <bridge URL>/mcp
import { readFileSync, renameSync, writeFileSync } from "node:fs"

const [file, url] = process.argv.slice(2)
if (!file || !url) process.exit(64)

let config = {}
try {
  const read = JSON.parse(readFileSync(file, "utf8"))
  if (read && typeof read === "object" && !Array.isArray(read)) config = read
} catch {
  // None yet, or unreadable: start from an empty one.
}
const servers = config.mcpServers && typeof config.mcpServers === "object" ? config.mcpServers : {}
config.mcpServers = { ...servers, phonecando: { url, bearerTokenEnvVar: "PHONECANDO_BRIDGE_TOKEN" } }

const tmp = `${file}.tmp`
writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n")
renameSync(tmp, file)
