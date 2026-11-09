// Installing an agent of an image kind into its machine: the runner renders
// the kind's install (or update) as one POSIX sh script for the image's
// package family (runtimes the kind needs, its packages, its own steps, the
// version check), says how to read the installed version, and records it.
// The script and the check run in the image through engine/linux/native.ts
// (runGuestScript, runGuestCommand); state/flows/installAgent.ts drives it.
// Rejections carry the runner's code first (`no_recipe: …`,
// `verify_failed: …`); state/flows/logic/installErrors.ts reads it.
import type {
  NativeInstallPlan,
  NativeVersionCheck,
} from '../../../modules/phonecando-runner/src/PhoneCanDoRunner.types';
import { nativeRunner } from '../runner';
import type { AgentId } from './records';

/** A rendered script: it prints `@phase <name>` before each of `phases`, in order. */
export type InstallPlan = NativeInstallPlan;

/** argv runs in the agent's machine (paths filled in, the kind's runtimes on PATH); `pattern`'s group 1 is the version. */
export type VersionCheck = NativeVersionCheck;

/** The kind's install for this package family (`''` when the image has none we know); null when it has none. Throws `no_recipe` when the family is not supported. */
export function installPlan(agentId: AgentId, family: string): InstallPlan | null {
  return nativeRunner().installPlan(agentId, family) ?? null;
}

/** The kind's update steps, with its runtimes ensured first; null when it has no update block. */
export function updatePlan(agentId: AgentId, family: string): InstallPlan | null {
  return nativeRunner().updatePlan(agentId, family) ?? null;
}

/** How to read the installed version; null when the kind has no check. */
export function versionCheck(agentId: AgentId): VersionCheck | null {
  return nativeRunner().versionCheck(agentId) ?? null;
}

/** Parses the check's output and stores the version on the agent (its engine may start from then on). Throws `verify_failed` when nothing matches. */
export function recordInstall(agentId: AgentId, versionOutput: string): { version: string } {
  return nativeRunner().recordInstall(agentId, versionOutput);
}
