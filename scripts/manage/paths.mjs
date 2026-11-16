// Where things are in the repo, for ./manage and its parts.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const APP = join(ROOT, 'app');
export const WEB = join(ROOT, 'web');
export const SCRIPTS = join(ROOT, 'scripts');
export const TCE = join(ROOT, 'tce');
// Agent kinds: agents/<native|image>/<id>/agent.json, the kit's CLI in
// agents/kit/cli/ and the native payloads' build, stamp and staging in
// agents/kit/native/.
export const AGENTS = join(ROOT, 'agents');
export const AGENT_KIT = join(AGENTS, 'kit');
export const NATIVE = join(AGENT_KIT, 'native');
// The baked Default env image: its build and its lock (lock/<action>.sh).
export const IMAGE = join(ROOT, 'lre', 'images', 'default');
export const IMAGE_LOCK = join(IMAGE, 'lock');
