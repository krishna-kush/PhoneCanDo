// Which GitHub checks gate a release and which only warn. Keyed by workflow
// file (.github/workflows/<file>); job names are the check names GitHub
// shows, matrix legs included. A string matches a name exactly, a RegExp by
// test(). Pure data: classify.mjs applies it.
//
//   gate          the workflow's roll-up job. Red, cancelled or unfinished
//                 blocks. `required` gates must exist: ci.yml and lint.yml
//                 run on every push, so a missing one means CI has not run.
//                 A missing path-filtered gate warns (its workflow did not
//                 run for this commit; GitHub also skips path filters
//                 silently on pushes of more than 300 files).
//   jobsBlock     no roll-up job (android.yml): every job that ran blocks,
//                 except the expected-red, experimental and report-only ones.
//   expectedRed   red by design at times (name -> why); warns. A gate that is
//                 red only through these and report-only or experimental
//                 jobs of its own run warns too.
//   experimental  matrix legs that report until they have been seen green.
//   reportOnly    continue-on-error jobs.
// Everything else (CodeQL, Security, Scorecard, other apps, commit statuses,
// the jobs a gate rolls up) warns when it is not green.

export const WORKFLOWS = {
  'ci.yml': { gate: 'ci-ok', required: true },
  'lint.yml': { gate: 'lint-ok', required: true, reportOnly: [/report only/] },
  'web.yml': {
    gate: 'web-ok',
    expectedRed: { 'Release downloads': 'red until the release in release.json is published' },
    reportOnly: ['html-validate', 'External links'],
  },
  'pce.yml': { gate: 'pce-ok' },
  'tce.yml': { gate: 'tce-ok', reportOnly: ['capacity (free-plan limits)'] },
  'lre.yml': { gate: 'lre-ok' },
  'lre-image.yml': { gate: 'lre-image-ok' },
  // Tier 2 (prep, tier2 legs) blocks; the Tier 3 rotation only reports.
  'lre-compat.yml': { gate: 'lre-compat-ok', reportOnly: [/^tier3/] },
  'proot.yml': { gate: 'proot-ok' },
  'agents.yml': { gate: 'agents-ok' },
  'lme.yml': { gate: 'lme-ok' },
  'llamacpp.yml': { gate: 'llamacpp-ok' },
  // Every kind with a models block against our llama-server (weekly too).
  'local-models.yml': { gate: 'local-models-ok' },
  'android.yml': {
    jobsBlock: true,
    reportOnly: ['Android lint'],
    experimental: ['Emulator smoke (full, API 36)', 'Emulator smoke (lite, API 29)'],
  },
  // drift (<id>) tries each kind's newest upstream tag: continue-on-error.
  'agent-payload.yml': { reportOnly: [/^drift /] },
  'scorecard.yml': { reportOnly: ['Score summary'] },
};

/** True when `name` matches one of the strings or RegExps in `list`. */
export function matches(list = [], name) {
  return list.some((entry) => (entry instanceof RegExp ? entry.test(name) : entry === name));
}
