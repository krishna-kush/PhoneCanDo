// Is every native agent payload full and lite will ship the build of this
// tree's sources? Pure: what io/agents.mjs read in, a gate verdict out. The
// kit decides current or not (agents/kit/native/state.mjs: libs equal to
// their SHA256SUMS, INPUTS equal to this tree's); `./manage release` makes
// them current before this runs, so a refusal here means it was skipped or
// declined.
import { stagedState } from '../../../agents/kit/native/state.mjs';

/**
 * payloads: [{ id, version, inputs, stamp }] (io/agents.mjs)
 * -> { ok, summary, detail, staged } where staged is
 *    [{ id, version, inputs, source }] when every payload is current, else null.
 */
export function payloadsVerdict(payloads) {
  const states = payloads.map((p) => ({ ...p, state: stagedState(p.stamp, p.inputs) }));
  const bad = states.filter((p) => p.state.state !== 'current');
  if (bad.length) {
    const lines = bad.map((p) => `${p.id} is ${p.state.state}: ${p.state.why.join('; ')}`);
    return {
      ok: false,
      summary: `${lines[0]}; ./manage agent status shows where a current one comes from`,
      detail: lines.slice(1),
      staged: null,
    };
  }
  const staged = states.map((p) => ({ id: p.id, version: p.version, inputs: p.inputs, source: p.state.source }));
  return {
    ok: true,
    summary: staged.length
      ? staged.map((p) => `${p.id} ${p.version} (${p.source ?? 'source unknown'})`).join(', ')
      : 'no native agent kind ships',
    detail: [],
    staged,
  };
}

/** The preflight gate: ctx.agents.payloads() is io/agents.mjs's reader (or a fake). */
export function payloadsGate(ctx, state) {
  const verdict = payloadsVerdict(ctx.agents.payloads());
  state.agents = verdict.staged;
  return { id: 'agents', title: 'Agents', overridable: false, ok: verdict.ok, summary: verdict.summary, detail: verdict.detail };
}
