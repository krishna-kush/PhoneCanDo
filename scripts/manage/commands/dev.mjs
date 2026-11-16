// The dev loop: prebuild, debug builds on the phone, checks, generated
// assets and the website.
import { join } from 'node:path';
import { channelArg } from '../args.mjs';
import { die } from '../errors.mjs';
import { APP, SCRIPTS, WEB } from '../paths.mjs';
import { sh } from '../run.mjs';

export function prebuild(args) {
  sh(['pnpm', args.includes('--clean') ? 'prebuild:clean' : 'prebuild'], { cwd: APP });
}

export function android(args) {
  sh(['pnpm', `android:${channelArg(args)}`], { cwd: APP });
}

export function check() {
  sh(['npx', 'tsc', '--noEmit', '-p', '.'], { cwd: APP });
  sh(['pnpm', 'check:vectors'], { cwd: APP });
}

export function logos() {
  sh(['node', join(SCRIPTS, 'make-logos.mjs')]);
}

export function xterm() {
  sh(['node', 'scripts/inline-xterm.js'], { cwd: APP });
}

export function web(args) {
  if (!['dev', 'build', 'preview'].includes(args[0])) die('usage: manage web dev|build|preview');
  sh(['pnpm', args[0]], { cwd: WEB });
}
