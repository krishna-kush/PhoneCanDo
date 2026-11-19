// What the runner puts in a machine's HOME before an agent's first start,
// for the full channel: the kind's config (what agents.gradle packages into
// assets/agents/<id>/config/ and ConfigSeeder copies into its config dir)
// and the kit's scripts (KitFiles, into .phonecando/bin/, mode 755). Pure:
// `list(dir)` gives a folder's files, relative, recursively.
import { join } from 'node:path';
import { matchesGlob } from '../../../../agents/kit/cli/manifests.mjs';

/** agents.gradle's kitScripts. */
export const KIT_SCRIPTS = ['phonecando-event', 'phonecando-open', 'phonecando-inbox'];
// What agents.gradle leaves out of every config, and of every shared part.
const CONFIG_EXCLUDES = ['**/node_modules/**'];
const PART_EXCLUDES = ['**/node_modules/**', 'part.json', '*.mjs', 'tools.json'];

/**
 * Every file to put in the machine: [{from (absolute), to (guest path), exec}].
 * `entry` is a kind from manifests.mjs; `configDir` and `kitBin` come from
 * kit-cli render-launch; `repo` is the repo root.
 */
export function seedPlan({ entry, configDir, kitBin, repo, list }) {
  const plan = KIT_SCRIPTS.map((name) => ({ from: join(repo, 'agents/kit/scripts', name), to: `${kitBin}/${name}`, exec: true }));
  const config = entry.manifest.config;
  if (!config?.dir || !configDir) return plan;
  const keep = (rel, excludes) => !excludes.some((glob) => matchesGlob(rel, glob));
  const dir = join(entry.dir, config.dir);
  for (const rel of list(dir).filter((r) => keep(r, CONFIG_EXCLUDES))) {
    plan.push({ from: join(dir, rel), to: `${configDir}/${rel}`, exec: false });
  }
  for (const part of entry.parts) {
    for (const rel of list(part.dir).filter((r) => keep(r, PART_EXCLUDES))) {
      plan.push({ from: join(part.dir, rel), to: `${configDir}/${part.into}/${rel}`, exec: false });
    }
  }
  return plan;
}
