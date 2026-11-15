// Shared fakes for the agents gate's tests: what io/agents.mjs reads.
const INPUTS = 'a'.repeat(64);
const SHA_E = 'e'.repeat(64);
const SHA_U = 'f'.repeat(64);

/** One current opencode payload, from a GitHub build. */
export function okPayload() {
  return {
    id: 'opencode',
    version: '2.0.26-android-phonecando.1',
    inputs: INPUTS,
    stamp: {
      libs: [
        { name: 'liboc-engine.so', file: { size: 10, sha256: SHA_E } },
        { name: 'liboc-opentui.so', file: { size: 2, sha256: SHA_U } },
      ],
      sums: `${SHA_E}  liboc-engine.so\n${SHA_U}  liboc-opentui.so\n`,
      inputs: INPUTS,
      source: 'github run 7 abc1234',
    },
  };
}

/** io/agents.mjs's reader over `payloads`. */
export const fakeAgents = (payloads = [okPayload()]) => ({ payloads: () => payloads });
