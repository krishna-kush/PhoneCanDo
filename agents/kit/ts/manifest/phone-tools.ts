// The setting that trusts our phone tools (phoneToolsTrust). Our tools never
// wait on an agent's own approval prompt: the phone-control lock is their
// check. A kind that loads them as an MCP server asks about each call in its
// own screen unless a setting trusts our "phonecando" server (never its shell
// or file tools), so the manifest says where that setting is: `in` "argv"
// (engine.launch.argv) or a file in config.dir, and `has`, text that must be
// there. Every bundled MCP kind names it; a user-added kind may leave it out
// (manifests saved on phones before it keep loading), and with no config
// folder of its own it can only trust in argv. kit/cli/manifests.mjs checks
// that a config file holds `has`.
import { fields, isObject, relPath, text, type Add, type Json } from './primitives.ts';
import { MAX, MCP_PHONE_TOOLS, TRUST_IN_ARGV } from './rules.ts';

const PATH = '/phoneToolsTrust';

export function checkPhoneToolsTrust(add: Add, m: Json, user: boolean) {
  const mcp = MCP_PHONE_TOOLS.includes(m.phoneTools as string);
  if (!('phoneToolsTrust' in m)) {
    if (mcp && !user) add(PATH, 'required', 'a kind with MCP phone tools trusts our phonecando server (phoneToolsTrust)');
    return;
  }
  if (!mcp) add(PATH, 'forbidden', 'phoneToolsTrust goes with phoneTools mcp:argv or mcp:config');
  if (!fields(add, PATH, m.phoneToolsTrust, ['in', 'has'], ['in', 'has'])) return;
  const trust = m.phoneToolsTrust as Json;
  text(add, `${PATH}/has`, trust.has, MAX.trustHas);
  if (trust.in === TRUST_IN_ARGV) {
    if (typeof trust.has === 'string' && trust.has !== '' && !argvHas(m, trust.has)) {
      add(`${PATH}/has`, 'mismatch', `engine.launch.argv holds no ${JSON.stringify(trust.has)}`);
    }
    return;
  }
  relPath(add, `${PATH}/in`, trust.in);
  if (user) add(`${PATH}/in`, 'forbidden', 'a user-added kind has no config folder: its trust is in argv');
  else if (!isObject(m.config) || !('dir' in m.config)) {
    add('/config/dir', 'required', 'phoneToolsTrust.in names a file in config.dir');
  }
}

// Whether any launch arg, a conditional's included, holds [has].
function argvHas(m: Json, has: string): boolean {
  const launch = isObject(m.engine) && isObject(m.engine.launch) ? m.engine.launch : null;
  if (!launch || !Array.isArray(launch.argv)) return false;
  return launch.argv.some((item) => {
    if (typeof item === 'string') return item.includes(has);
    return isObject(item) && Array.isArray(item.args) && item.args.some((a) => typeof a === 'string' && a.includes(has));
  });
}
