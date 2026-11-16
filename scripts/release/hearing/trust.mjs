// The code the second opinion's question asks a reviewer to check
// (web/src/data/secondOpinion.ts), one area per point it names. When files
// here change after the commit on trial, the rulings on the site may no
// longer hold, and the preflight says to ask again. A pattern is a path
// prefix (a folder ends in /), or **/name for a file of that name anywhere.

const RUNNER = 'app/modules/phonecando-runner/android/src';
const RUNNER_KT = `${RUNNER}/main/java/com/phonecando/runner`;

export const TRUST_AREAS = [
  {
    name: 'what leaves the phone',
    paths: [
      'tce/',
      'accounts/',
      'app/src/engine/telemetry/',
      'app/src/engine/account/',
      'app/src/engine/share/',
      'app/src/engine/apiHost.ts',
      'app/modules/phonecando-account/',
      `${RUNNER_KT}/Telemetry`,
      `${RUNNER_KT}/share/`,
    ],
  },
  {
    name: 'Accessibility and the screen',
    paths: [
      'pce/',
      `${RUNNER}/uiauto/`,
      `${RUNNER_KT}/bridge/`,
      `${RUNNER_KT}/controllock/`,
      `${RUNNER_KT}/RestrictedSettings.kt`,
      'app/src/ui/accessibility/',
      'agents/shared/phone-tools/',
    ],
  },
  {
    name: 'network and downloaded code',
    paths: [
      'network/',
      'app/modules/phonecando-network/',
      'app/src/engine/updates',
      'agents/native/',
      'agents/image/',
      'lre/proot/',
      'lre/images/default/',
      'lme/llamacpp/',
    ],
  },
  {
    name: 'how the APK is built',
    paths: [
      '.github/workflows/release.yml',
      'scripts/release-android.mjs',
      'scripts/release/',
      'app/plugins/',
      '**/AndroidManifest.xml',
    ],
  },
];

const matches = (file, pattern) =>
  pattern.startsWith('**/') ? file === pattern.slice(3) || file.endsWith(pattern.slice(2)) : file.startsWith(pattern);

/** Changed files -> [{ name, files }] for each trust area they touch, in TRUST_AREAS order. */
export function trustChanges(files, areas = TRUST_AREAS) {
  return areas
    .map((area) => ({ name: area.name, files: files.filter((file) => area.paths.some((p) => matches(file, p))) }))
    .filter((area) => area.files.length > 0);
}
