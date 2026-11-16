// image: fetch/stage the image lock.json names (sha256-checked); lock writes
// lock.json from a green run (read-only gh api; you commit the file); build
// makes our own image (docker; on an x86_64 host arm64 runs under qemu-user,
// 15-20 min); stage --local puts it on debug builds only.
import { join } from 'node:path';
import { die } from '../errors.mjs';
import { IMAGE, IMAGE_LOCK, ROOT } from '../paths.mjs';
import { sh } from '../run.mjs';

export function image(args) {
  const line = args.join(' ');
  const valid = ['fetch', 'stage', 'build', 'stage --local'].includes(line) || (args.length === 2 && args[0] === 'lock');
  if (!valid) die('usage: manage image fetch|stage | build|stage --local | lock <run-id>');
  if (args[0] === 'build') sh([join(IMAGE, 'build.sh'), join(ROOT, 'dist', 'images', 'local')]);
  else sh([join(IMAGE_LOCK, `${args[0]}.sh`), ...args.slice(1)]);
}
