// Every agent kind's label, read from its manifest (agents/<type>/<id>/
// agent.json) as the website's cards are: the default kind first, then the
// rest by name. Node only; the page gets it from the server (render/serve.ts).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Manifest = { id: string; label: string; default?: boolean };

export function agentLabels(repo: string): string[] {
  const kinds: Manifest[] = [];
  for (const type of ['native', 'image']) {
    const dir = join(repo, 'agents', type);
    for (const id of readdirSync(dir)) {
      try {
        kinds.push(JSON.parse(readFileSync(join(dir, id, 'agent.json'), 'utf8')) as Manifest);
      } catch {
        // A folder without a manifest is not a kind.
      }
    }
  }
  return kinds
    .sort((a, b) => Number(Boolean(b.default)) - Number(Boolean(a.default)) || a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
    .map((k) => k.label);
}
