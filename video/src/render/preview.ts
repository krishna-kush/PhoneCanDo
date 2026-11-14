// pnpm preview [--port 4800]
//
// Serves the page for a person: open the address it prints to scrub and
// play the video in a browser, with its sound once `pnpm sound` has run.
// Edits show on a reload. Ctrl+C stops it.

import { parseArgs } from 'node:util';
import { serve } from './serve.ts';

const { values } = parseArgs({ options: { port: { type: 'string', default: '4800' } } });
const server = await serve(Number(values.port));
for (const f of ['16x9', '9x16', '1x1']) console.log(`${f}: ${server.origin}/video/src/picture/index.html?format=${f}`);
console.log('Space plays, arrows step a beat (Shift: a bar). Ctrl+C stops.');
