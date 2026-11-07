// GitHub's view of one commit -> one row per check with a decision: 'ok',
// 'warn' or 'block'. Pure: the check runs, workflow runs and commit statuses
// come in as plain objects (io/gh.mjs fetches them; the fixtures are real
// ones), and policy.mjs says which checks gate.

import { WORKFLOWS, matches } from './policy.mjs';

const GOOD = new Set(['success', 'neutral']);
/** Roles whose red, cancelled or unfinished state blocks the release. */
export const GATE_ROLES = new Set(['required gate', 'gate', 'blocking job']);
// Jobs allowed to be red: a gate red only through these warns.
const ALLOWED_RED = new Set(['expected red', 'report-only', 'experimental']);
const RANK = { block: 0, warn: 1, ok: 2 };

/** The conclusion once completed ('success', 'failure', ...), else the status ('queued', 'in_progress', ...). */
export const checkState = (run) => (run.status === 'completed' ? (run.conclusion ?? 'unknown') : run.status);

/**
 * { checkRuns, workflowRuns, statuses } -> { rows, blocks, warns }. A row is
 * { name, workflow, file, suite, state, role, decision, note }; rows that
 * stand for a gate or workflow with no check run have state 'not run',
 * 'running' or 'missing'. Blocking rows sort first.
 */
export function classifyChecks({ checkRuns, workflowRuns, statuses = [] }) {
  const runs = latestRuns(workflowRuns);
  const owners = new Map([...runs].map(([file, run]) => [run.check_suite_id, { file, run }]));
  const actionsSuites = new Set(workflowRuns.map((run) => run.check_suite_id));

  // Check runs of a superseded workflow run drop out; a re-run job keeps its
  // newest attempt. Other apps' checks (no workflow run) stay.
  const latest = new Map();
  for (const check of checkRuns) {
    if (actionsSuites.has(check.suite) && !owners.has(check.suite)) continue;
    const key = `${check.suite}\0${check.name}`;
    if (!latest.has(key) || check.id > latest.get(key).id) latest.set(key, check);
  }

  const rows = [...latest.values()].map((check) => judge(check, owners.get(check.suite)));
  allowExpectedRed(rows);
  rows.push(...absent(runs, rows), ...statuses.map(judgeStatus));
  rows.sort(
    (a, b) =>
      RANK[a.decision] - RANK[b.decision] ||
      Number(GATE_ROLES.has(b.role)) - Number(GATE_ROLES.has(a.role)) ||
      a.workflow.localeCompare(b.workflow) ||
      a.name.localeCompare(b.name),
  );
  return {
    rows,
    blocks: rows.filter((row) => row.decision === 'block'),
    warns: rows.filter((row) => row.decision === 'warn'),
  };
}

const fileOf = (path) => path.split('/').pop();
const newer = (a, b) => a.created_at > b.created_at || (a.created_at === b.created_at && a.id > b.id);

// The newest run of each workflow file: a nightly or manual run on the same
// commit supersedes the push run.
function latestRuns(workflowRuns) {
  const byFile = new Map();
  for (const run of workflowRuns) {
    const file = fileOf(run.path);
    if (!byFile.has(file) || newer(run, byFile.get(file))) byFile.set(file, run);
  }
  return byFile;
}

function judge(check, owner) {
  const policy = (owner && WORKFLOWS[owner.file]) || {};
  const role = roleOf(policy, check.name);
  const state = checkState(check);
  return {
    name: check.name,
    workflow: owner ? owner.run.name : (check.app ?? 'other app'),
    file: owner?.file,
    suite: check.suite,
    state,
    role,
    decision: decide(role, state),
    note: role === 'expected red' ? policy.expectedRed[check.name] : '',
  };
}

function roleOf(policy, name) {
  if (policy.gate === name) return policy.required ? 'required gate' : 'gate';
  if (policy.expectedRed && Object.hasOwn(policy.expectedRed, name)) return 'expected red';
  if (matches(policy.experimental, name)) return 'experimental';
  if (matches(policy.reportOnly, name)) return 'report-only';
  if (policy.jobsBlock) return 'blocking job';
  if (policy.gate) return `in ${policy.gate}`;
  return 'other';
}

function decide(role, state) {
  if (GOOD.has(state)) return 'ok';
  if (!GATE_ROLES.has(role)) return state === 'skipped' ? 'ok' : 'warn';
  // A job is skipped when a job it needs failed (that one blocks) or its own
  // condition is off; a skipped roll-up gate has verified nothing.
  if (state === 'skipped') return role === 'blocking job' ? 'warn' : 'block';
  return 'block';
}

// web-ok rolls up Release downloads, which is red after a version bump until
// that release is published. A gate red only through jobs of its own run that
// may be red warns instead of blocking; any other red or unfinished job in
// that run keeps it blocking.
function allowExpectedRed(rows) {
  for (const gate of rows) {
    if (gate.decision !== 'block' || gate.state !== 'failure' || gate.role === 'blocking job') continue;
    const red = rows.filter((row) => row !== gate && row.suite === gate.suite && row.decision !== 'ok');
    const expected = red.filter((row) => row.role === 'expected red');
    if (expected.length && red.every((row) => ALLOWED_RED.has(row.role))) {
      gate.decision = 'warn';
      gate.note = `red only through ${expected.map((row) => row.name).join(', ')}`;
    }
  }
}

// Rows for gates with no check run: the workflow did not run (path filters),
// is still running (later jobs get their check run only when they start), or
// finished without its gate.
function absent(runs, rows) {
  const out = [];
  for (const [file, policy] of Object.entries(WORKFLOWS)) {
    const run = runs.get(file);
    const row = (name, role, state, decision, note) =>
      out.push({ name, workflow: run?.name ?? file, file, suite: run?.check_suite_id, state, role, decision, note });
    const running = run && run.status !== 'completed';
    if (policy.gate && !rows.some((r) => r.file === file && r.name === policy.gate)) {
      const role = policy.required ? 'required gate' : 'gate';
      if (!run && policy.required) row(policy.gate, role, 'not run', 'block', 'CI has not run for this commit');
      else if (!run) row(policy.gate, role, 'not run', 'warn', 'workflow did not run (path filters)');
      else if (running) row(policy.gate, role, 'running', 'block', `${run.name} has not finished`);
      else row(policy.gate, role, 'missing', 'block', `the ${run.name} run (${run.conclusion}) has no ${policy.gate} job`);
    }
    if (policy.jobsBlock && !run) row('(all jobs)', 'blocking job', 'not run', 'warn', 'workflow did not run (path filters)');
    if (policy.jobsBlock && running) row('(unfinished jobs)', 'blocking job', 'running', 'block', `${run.name} has not finished`);
  }
  return out;
}

function judgeStatus({ context, state }) {
  const decision = state === 'success' ? 'ok' : 'warn';
  return { name: context, workflow: 'commit status', file: undefined, suite: undefined, state, role: 'other', decision, note: '' };
}
