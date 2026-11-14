// What our films read from the repo instead of writing down, so they stay
// true when it changes: every agent kind's label, from its manifest
// (agents/<type>/<id>/agent.json) as the website's cards read it, the
// default kind first, then the rest by name. Node only.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Facts = {
  /** Every agent kind's label, the default kind first. */
  agents: string[];
};

type Manifest = { id: string; label: string; default?: boolean };

function agentLabels(repo: string): string[] {
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

export const collectFacts = (repo: string): Facts => ({ agents: agentLabels(repo) });
