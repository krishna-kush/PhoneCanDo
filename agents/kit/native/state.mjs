// Is a staged payload the build of this tree's sources? Pure: stamp.mjs
// readStamp's output and this tree's digest (inputs.mjs) in, a verdict out.
//   current   every lib there, byte-equal to SHA256SUMS, INPUTS equals the
//             tree's: built from these pins, patches and build script
//   outdated  anything else that is staged (a lib missing or changed, no
//             stamp, other sources); `why` says what
//   missing   nothing staged
// Builds are rarely byte-identical, so two current payloads (one built on
// this PC, one by CI) may differ in bytes; INPUTS is what makes both current.
import { INPUTS_RE } from './inputs.mjs';
import { parseSums } from './stamp.mjs';

const short = (sha) => sha.slice(0, 12);

/** -> { state: 'current' | 'outdated' | 'missing', why: string[], source: string | null } */
export function stagedState(staged, treeInputs) {
  const present = staged.libs.filter((lib) => lib.file?.size > 0);
  if (present.length === 0) return { state: 'missing', why: ['nothing staged'], source: null };
  const why = [];
  for (const lib of staged.libs) if (!present.includes(lib)) why.push(`${lib.name} is missing or empty`);
  const sums = staged.sums === null ? null : parseSums(staged.sums);
  if (staged.sums === null) why.push('no SHA256SUMS: staged before payloads were stamped');
  else if (!sums) why.push('SHA256SUMS is not sha256sum output');
  else {
    for (const lib of present) {
      const want = sums.get(lib.name);
      if (want !== lib.file.sha256) {
        why.push(want ? `${lib.name} changed since it was staged (sha256 ${short(lib.file.sha256)}, SHA256SUMS ${short(want)})` : `${lib.name} is not in SHA256SUMS`);
      }
    }
  }
  if (staged.inputs === null) why.push('no INPUTS: built from unknown sources');
  else if (!INPUTS_RE.test(staged.inputs)) why.push('INPUTS is not a sha256 digest');
  else if (staged.inputs !== treeInputs) {
    why.push(`built from other sources (INPUTS ${short(staged.inputs)}, this tree ${short(treeInputs)}): pins, patches or the build script changed since`);
  }
  return { state: why.length ? 'outdated' : 'current', why, source: staged.source };
}
