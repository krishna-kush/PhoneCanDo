// A kind whose trust in our server (phoneToolsTrust) lists our tools by
// name, because its CLI has no rule for a whole server, lists every one in
// tools.json; a tool added later would otherwise ask in that kind. Names
// count with a prefix (phonecando_mobile_ping, phonecando__mobile_ping) but
// not as part of a longer name (mobile_open in mobile_open_accessibility).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const AGENTS = fileURLToPath(new URL('../../', import.meta.url));
const TOOLS = JSON.parse(readFileSync(new URL('./tools.json', import.meta.url), 'utf8')).tools.map((t) => t.name);

// Where each kind's trust lives, as text: its launch and ACP argv, or the config file it names.
function trusts() {
  const found = [];
  for (const type of ['native', 'image']) {
    for (const id of readdirSync(join(AGENTS, type))) {
      const file = join(AGENTS, type, id, 'agent.json');
      if (!existsSync(file)) continue;
      const m = JSON.parse(readFileSync(file, 'utf8'));
      const trust = m.phoneToolsTrust;
      if (!trust) continue;
      if (trust.in !== 'argv') {
        found.push({ where: `${id} ${trust.in}`, text: readFileSync(join(AGENTS, type, id, m.config.dir, trust.in), 'utf8') });
        continue;
      }
      for (const block of ['launch', 'acp']) {
        const argv = m.engine?.[block]?.argv;
        if (argv) found.push({ where: `${id} engine.${block}.argv`, text: JSON.stringify(argv) });
      }
    }
  }
  return found;
}

const named = (text, name) => new RegExp(`(?<![A-Za-z0-9])${name}(?![A-Za-z0-9_])`).test(text);

test('a trust that names our tools names all of them', () => {
  const kinds = trusts();
  assert.ok(kinds.length > 0);
  for (const { where, text } of kinds) {
    const some = TOOLS.filter((n) => named(text, n));
    if (some.length === 0) continue;
    assert.deepEqual(TOOLS.filter((n) => !named(text, n)), [], `${where} misses these tools`);
  }
});
