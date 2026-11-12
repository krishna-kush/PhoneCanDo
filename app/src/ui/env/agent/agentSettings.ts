// An agent's settings rows (AgentPage): which apply to its kind, and the
// short line beside each, saying what is behind it or that it needs a look.
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import type { Env, Image } from '../../../engine/linux/types';
import type { LocalModel } from '../../../engine/models/types';
import type { InstallRun } from '../../../state/flows/logic/installRun';
import { formatBytes } from '../logic/format';
import { envTitle } from '../logic/titles';

export type RowDetail = { text: string; alert: boolean };

/**
 * Whether the agent has a model setting: its kind can use a local model, on
 * a phone that can run one (or one is set already, so it can be unset).
 */
export function hasModelSetting(agent: Agent, deviceSupported: boolean): boolean {
  return agentKind(agent.kind).models.length > 0 && (deviceSupported || agent.model != null);
}

export function modelDetail(agent: Agent, models: readonly Pick<LocalModel, 'id' | 'name'>[]): RowDetail {
  if (agent.model == null) return { text: 'its own setup', alert: false };
  const model = models.find((m) => m.id === agent.model);
  return model ? { text: model.name, alert: false } : { text: 'model missing', alert: true };
}

/** "N agents" first when others use the machine too. */
export function machineDetail(
  image: Image | undefined,
  env: Env | undefined,
  missingTools: number,
  /** Every agent on the machine, this one included. */
  agentsOnMachine: number,
): RowDetail {
  if (!image) return { text: 'missing', alert: true };
  if (image.state === 'failed') return { text: 'setup stopped', alert: true };
  if (image.state !== 'ready') return { text: image.state === 'creating' ? 'setting up' : image.state, alert: false };
  if (missingTools > 0) return { text: missingTools === 1 ? '1 tool missing' : `${missingTools} tools missing`, alert: true };
  const size = image.sizeBytes > 0 ? formatBytes(image.sizeBytes) : null;
  const shared = agentsOnMachine > 1 ? `${agentsOnMachine} agents` : null;
  const text = [shared, env ? envTitle(env.source) : null, size].filter(Boolean).join(' · ');
  return { text: text || 'ready', alert: false };
}

export function installDetail(agent: Agent, run: InstallRun | undefined): RowDetail {
  if (run?.status === 'running') return { text: 'installing…', alert: false };
  if (run?.status === 'failed') return { text: 'install stopped', alert: true };
  if (agent.needsInstall) return { text: 'not installed', alert: true };
  return { text: agent.installedVersion ? `v${agent.installedVersion}` : 'installed', alert: false };
}
