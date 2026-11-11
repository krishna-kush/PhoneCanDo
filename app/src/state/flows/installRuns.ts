// Each agent's last install or update run (installAgent.ts), by agent id,
// so the agent page and Home follow a run they did not start; and
// which installed agents a machine reset left without their system
// packages, so the agent page offers "Reinstall <agent>". In memory only:
// after a restart the agent's record says enough (needsInstall, its
// installed version).
import { create } from 'zustand';
import type { AgentId } from '../../engine/agents/records';
import { applyInstallEvent, type InstallEvent, type InstallRun } from './logic/installRun';

type InstallRuns = { runs: Record<AgentId, InstallRun>; reinstall: Record<AgentId, true> };

const useInstallRuns = create<InstallRuns>(() => ({ runs: {}, reinstall: {} }));

export function setInstallRun(agentId: AgentId, run: InstallRun): void {
  useInstallRuns.setState((s) => ({ runs: { ...s.runs, [agentId]: run } }));
}

export function applyInstall(agentId: AgentId, e: InstallEvent): void {
  useInstallRuns.setState((s) => {
    const run = s.runs[agentId];
    return run ? { runs: { ...s.runs, [agentId]: applyInstallEvent(run, e) } } : s;
  });
}

export function useInstallRun(agentId: AgentId): InstallRun | undefined {
  return useInstallRuns((s) => s.runs[agentId]);
}

/** A reset took the system packages this installed agent needs. */
export function offerAgentReinstall(agentId: AgentId): void {
  useInstallRuns.setState((s) => ({ reinstall: { ...s.reinstall, [agentId]: true } }));
}

/** The offer was used or dismissed. */
export function forgetAgentReinstall(agentId: AgentId): void {
  useInstallRuns.setState((s) => {
    if (!s.reinstall[agentId]) return s;
    const { [agentId]: _gone, ...reinstall } = s.reinstall;
    return { reinstall };
  });
}

export function useAgentReinstallOffered(agentId: AgentId): boolean {
  return useInstallRuns((s) => s.reinstall[agentId] === true);
}
