// pnpm facts: reads the repo's facts (collect.ts) into facts.gen.json, the
// one copy the picture (in the browser) and the sound (in Node) both read.
// Every script runs it first, so the file is never stale; git ignores it.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectFacts } from './collect.ts';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const out = fileURLToPath(new URL('./facts.gen.json', import.meta.url));
writeFileSync(out, `${JSON.stringify(collectFacts(repo), null, 2)}\n`);
