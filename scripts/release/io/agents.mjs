// Reads the native agent payloads full and lite will ship, for the release
// preflight: each kind's staged libs and stamp (agents/kit/native/stamp.mjs)
// and this tree's INPUTS (inputs.mjs). Plain data out (agents/payloads.mjs
// decides). `root` is the repo root, so tests point it at a temp dir.
import { nativeManifests } from '../../../agents/kit/cli/manifests.mjs';
import { inputsDigest } from '../../../agents/kit/native/inputs.mjs';
import { defaultDest } from '../../../agents/kit/native/stage.mjs';
import { readStamp } from '../../../agents/kit/native/stamp.mjs';

/** The channels a release ships. */
export const RELEASED = ['full', 'lite'];

/** { payloads() } over the kinds and staged libs under `root`. */
export function makeAgents({ root }) {
  return {
    /** [{ id, version, inputs, stamp }] for every native kind full or lite ships. */
    payloads() {
      return nativeManifests(root)
        .filter((kind) => kind.manifest.channels.some((ch) => RELEASED.includes(ch)))
        .map((kind) => ({
          id: kind.id,
          version: kind.manifest.version,
          inputs: inputsDigest(kind.dir, kind.manifest),
          stamp: readStamp(defaultDest(root, kind.id), kind.manifest),
        }));
    },
  };
}
