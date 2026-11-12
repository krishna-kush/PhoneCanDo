// What an agent's image must keep out of the guest's environment, from the
// manifests of the kinds on it (the runner's GuestEnvPolicy): a native
// kind's bridge URL and token and every secret it is launched with; an
// image kind nothing, as its agent runs through our launcher and needs the
// bridge. On a machine agents share, the list is the union for all of them,
// whichever agent asks. lre unsets LD_* on top. Every prepareImageForStart
// call passes this list (state/agents.ts prepareAgentImage), so the image's
// launch.conf reads the same whoever asks.
import { nativeRunner } from '../runner';
import type { AgentId } from './records';

export function guestUnset(agentId: AgentId): string[] {
  return nativeRunner().guestUnset(agentId);
}
