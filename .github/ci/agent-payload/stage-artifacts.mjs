#!/usr/bin/env node
// android.yml's release job: stages the native agent payloads a manual run
// fetched from an agent-payload.yml run, and says per channel which payloads
// the APK audit must find.
//
//   node .github/ci/agent-payload/stage-artifacts.mjs <artifacts-dir> <channel>...
//
// Each kind the channels ship is looked up in <artifacts-dir>/<prefix>-payload-arm64/
// (download-artifact with a pattern puts each artifact in its own folder). A
// kind whose libs are all there and non-empty is staged (stage.mjs --staged,
// linkage guard included) and "required"; any other is "optional": payloads
// are not in the repository, and the audit skips the gate of one not staged.
// Writes payloads=<json> ({ channel: { id: mode } }, the kinds each channel
// ships) to $GITHUB_OUTPUT and one line per kind to the job summary.
import { appendFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, forChannel, nativeManifests } from '../../../agents/kit/cli/manifests.mjs';
import { defaultDest, stagePayload } from '../../../agents/kit/native/stage.mjs';

const [dir, ...channels] = process.argv.slice(2);
if (!dir || !channels.length) {
  console.error('usage: node .github/ci/agent-payload/stage-artifacts.mjs <artifacts-dir> <channel>...');
  process.exit(2);
}
const append = (file, line) => {
  console.log(line);
  if (file) appendFileSync(file, `${line}\n`);
};

const kinds = nativeManifests(REPO_ROOT).filter((k) => channels.some((ch) => k.manifest.channels.includes(ch)));
const modes = {};
for (const { id, manifest } of kinds) {
  const artifact = `${manifest.prefix}-payload-arm64`;
  const from = join(dir, artifact);
  const names = manifest.payload.libs.map((lib) => lib.name);
  const present = (name) => existsSync(join(from, name)) && statSync(join(from, name)).size > 0;
  modes[id] = 'optional';
  if (existsSync(from)) {
    if (names.every(present)) {
      stagePayload({ manifest, from, dest: defaultDest(REPO_ROOT, id), staged: true });
      modes[id] = 'required';
    } else {
      console.log(`::warning title=${id} payload::${artifact} has no non-empty ${names.join(' + ')}; building without ${id}`);
    }
  }
  const shown = modes[id] === 'required' ? 'staged' : 'not staged (not in the repository)';
  append(process.env.GITHUB_STEP_SUMMARY, `${id} payload: **${shown}**`);
}

const payloads = Object.fromEntries(
  channels.map((ch) => [ch, Object.fromEntries(forChannel(kinds, ch).map((k) => [k.id, modes[k.id]]))]),
);
append(process.env.GITHUB_OUTPUT, `payloads=${JSON.stringify(payloads)}`);
