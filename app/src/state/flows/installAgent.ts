// Installing an agent of an image kind inside its machine, so its engine
// can start: wait until the machine is ready, ask the runner for the kind's
// install script for the machine's package family (the runtimes the kind
// needs, its system packages, its own steps), run it in the image as a job
// (phases, retries, time and bytes so far and the log's last lines land in
// installRuns), then run the kind's version check and record the version.
// The agent's engine refuses to start until that record exists
// (agent_not_installed).
//
// A machine runs one install at a time (the Linux module allows one script
// per image): a run for a machine with one under way waits its turn, shown
// as waiting for its machine. On a machine agents share, the script stops
// first the agents that run the same files: those of the kind, and those
// whose kind needs one of the same runtimes. The runner records the version
// on every agent of the kind in the machine.
//
// It starts by itself right after every creation flow makes such an agent
// (startInstallIfNeeded), and from the agent page: Install or Retry, Update
// agent (the kind's update steps), Reinstall after a machine reset. A run
// never rejects; its record in installRuns says how it went.
import type { Agent, AgentId } from '../../engine/agents/records';
import { installPlan, recordInstall, updatePlan, versionCheck, type InstallPlan } from '../../engine/agents/install';
import { agentKind } from '../../engine/agents/registry';
import { agentById, engineStatus, listAgents } from '../../engine/engines';
import { cancelJob, runGuestCommand, runGuestScript } from '../../engine/linux/native';
import type { Image, ImageId, LinuxJob } from '../../engine/linux/types';
import { agentsOnImage, prepareAgentImage, useAgentsStore } from '../agents';
import { useLinuxStore } from '../linux';
import { followJob } from './followJob';
import { applyInstall, forgetAgentReinstall, setInstallRun } from './installRuns';
import { failureOf } from './logic/errors';
import { InstallError, installFailureOf, scriptFailure } from './logic/installErrors';
import { startRun, type InstallMode } from './logic/installRun';
import { stoppedByInstall } from './logic/machineTenants';
import { waitForTarget } from './waitForTarget';

// A version check prints one line; it never needs long.
const VERSION_TIMEOUT_SEC = 30;

const running = new Map<AgentId, Promise<boolean>>();
// Each machine's last run, queued or under way: the next one waits for it.
const machineTurns = new Map<ImageId, Promise<boolean>>();
// The script job each run has going, so a delete can stop it.
const scriptJobs = new Map<AgentId, string>();

/**
 * After a creation flow made the agent: installs it when its kind has an
 * install it lacks (an agent joining a machine where its kind is installed
 * may have the version recorded already).
 */
export function startInstallIfNeeded(agent: Agent): void {
  if (agentKind(agent.kind).hasInstall && agent.needsInstall) void installAgent(agent.id);
}

/**
 * Installs the agent (or, `update`, runs its kind's update steps, else its
 * install again) and records its version. Resolves true when it ended well,
 * false when it failed; a call while one runs for the agent shares it.
 */
export function installAgent(agentId: AgentId, mode: InstallMode = 'install'): Promise<boolean> {
  const now = running.get(agentId);
  if (now) return now;
  const attempt = inTurn(agentId, mode).finally(() => running.delete(agentId));
  running.set(agentId, attempt);
  return attempt;
}

/** An install or update runs in this machine, or waits its turn there. */
export function installBusyOn(imageId: ImageId): boolean {
  return machineTurns.has(imageId);
}

/** Stops the agent's install script, if one runs (its machine stays, so the job would go on). */
export function cancelAgentInstall(agentId: AgentId): void {
  const jobId = scriptJobs.get(agentId);
  if (jobId) cancelJob(jobId);
}

// The run shows at once; it starts once the machine's runs before it ended
// (a run never rejects, so the chain never breaks).
function inTurn(agentId: AgentId, mode: InstallMode): Promise<boolean> {
  setInstallRun(agentId, startRun(mode));
  const imageId = agentById(agentId)?.imageId;
  if (!imageId) return run(agentId, mode);
  const before = machineTurns.get(imageId) ?? Promise.resolve(true);
  const turn = before.then(() => run(agentId, mode));
  machineTurns.set(imageId, turn);
  void turn.then(() => {
    if (machineTurns.get(imageId) === turn) machineTurns.delete(imageId);
  });
  return turn;
}

async function run(agentId: AgentId, mode: InstallMode): Promise<boolean> {
  try {
    const agent = agentById(agentId);
    if (!agent) throw new InstallError({ code: 'not_found', message: 'the agent is gone' });
    const image = await readyImage(agent.imageId);

    applyInstall(agentId, { type: 'stage', stage: 'plan' });
    const family = image.os?.family ?? '';
    const plan = (mode === 'update' ? updatePlan(agentId, family) : null) ?? installPlan(agentId, family);
    if (plan) {
      applyInstall(agentId, { type: 'plan', phases: plan.phases });
      // The script replaces files a running agent uses.
      await stopForScript(agent);
      await prepareAgentImage(agent);
      applyInstall(agentId, { type: 'stage', stage: 'script' });
      const end = await followJob(
        () => startScript(agent, plan, mode),
        (p) =>
          applyInstall(agentId, {
            type: 'progress',
            phase: p.phase,
            tail: p.tail,
            retry: p.retry,
            elapsedSec: p.elapsedSec,
            downloadedBytes: p.downloadedBytes,
            rateBytesPerSec: p.rateBytesPerSec,
            online: p.online,
          }),
      );
      const failure = scriptFailure(end);
      if (failure) throw new InstallError(failure);
    }

    applyInstall(agentId, { type: 'stage', stage: 'verify' });
    const version = plan ? await checkVersion(agent) : null;
    useAgentsStore.getState().refreshAgents();
    // Every agent of the kind in the machine has its files back: a reset's offer goes for them all.
    for (const a of agentsOnImage(agent.imageId)) if (a.kind === agent.kind) forgetAgentReinstall(a.id);
    applyInstall(agentId, { type: 'done', version });
    return true;
  } catch (e) {
    applyInstall(agentId, { type: 'failed', failure: installFailureOf(e) });
    return false;
  } finally {
    scriptJobs.delete(agentId);
  }
}

// The script as a job in the agent's machine, kept so a delete can stop it.
async function startScript(agent: Agent, plan: InstallPlan, mode: InstallMode): Promise<LinuxJob> {
  const job = await runGuestScript(agent.imageId, plan.script, { timeoutSec: plan.timeoutSec, label: `${mode} ${agent.kind}` });
  scriptJobs.set(agent.id, job.jobId);
  return job;
}

// The agent's machine once it is ready: a setup or reset still running is
// waited for; a machine whose setup failed stops the install with its reason.
async function readyImage(imageId: ImageId): Promise<Image> {
  const linux = useLinuxStore.getState();
  linux.hydrateLinux();
  const find = () => useLinuxStore.getState().images.find((i) => i.id === imageId);
  const now = find();
  if (now?.state === 'creating' || now?.state === 'resetting') {
    await waitForTarget({ kind: 'image', id: imageId }, null);
  }
  const image = find();
  if (!image) throw new InstallError({ code: 'not_found', message: 'its machine is gone' });
  if (image.state !== 'ready') {
    throw new InstallError(failureOf(image.error, image.errorCode) ?? { code: 'busy', message: `it is ${image.state}` });
  }
  return image;
}

// The agent, and on a shared machine the agents that run the same files.
async function stopForScript(agent: Agent): Promise<void> {
  const others = stoppedByInstall(listAgents(), agent, (kind) => agentKind(kind).runtimes);
  await Promise.all([agent.id, ...others.map((a) => a.id)].map(stopIfRunning));
}

async function stopIfRunning(agentId: AgentId): Promise<void> {
  const state = engineStatus(agentId).state;
  if (state === 'starting' || state === 'ready') await useAgentsStore.getState().stopAgent(agentId);
}

// The kind's version check in the machine, then the record that lets the
// engine start. A kind without a check records what the runner makes of no
// output.
async function checkVersion(agent: Agent): Promise<string> {
  const check = versionCheck(agent.id);
  let output = '';
  if (check) {
    const res = await runGuestCommand(agent.imageId, check.argv, VERSION_TIMEOUT_SEC);
    if (res.exitCode !== 0) {
      throw new InstallError({ code: 'verify_failed', message: `the version check ended with exit ${res.exitCode}` });
    }
    output = res.stdout;
  }
  return recordInstall(agent.id, output).version;
}
