import { NativeModule, requireNativeModule } from 'expo';

import type {
  NativeAcpEvent,
  NativeAcpSnapshot,
  NativeAgent,
  NativeAgentChecks,
  NativeAppAccessList,
  NativeAppAccessState,
  NativeAppAnswer,
  NativeBridgePrompt,
  NativeClientRecipe,
  NativeEngineMode,
  NativeEngineStatus,
  NativeInstallPlan,
  NativeKeepAsk,
  NativeKindDeleted,
  NativeKindProblem,
  NativeKindSaved,
  NativeLaunchTarget,
  NativeMemoryStatus,
  NativeMessage,
  NativeMessagingLevel,
  NativeModelServerLog,
  NativeOpenUrlAction,
  NativePromptReading,
  NativeRunLimits,
  NativeRunNowResult,
  NativeSchedule,
  NativeSchedulePatch,
  NativeScheduleResult,
  NativeScheduleRun,
  NativeScheduleSpec,
  NativeScreenQueue,
  NativeShareResult,
  NativeTerminalAttach,
  NativeTerminalTheme,
  NativeUpdateDownload,
  NativeUpdateSpec,
  NativeUserKind,
  NativeVersionCheck,
} from './PhoneCanDoRunner.types';
import type { TelemetryNativeSnapshot } from './telemetry.types';

export type { EngineHealth, NativeCrash, TelemetryNativeSnapshot } from './telemetry.types';
export type {
  NativeAcpEvent,
  NativeAcpItem,
  NativeAcpOption,
  NativeAcpPermission,
  NativeAcpSnapshot,
  NativeAgent,
  NativeAgentChecks,
  NativeAppAccessApp,
  NativeAppAccessList,
  NativeAppAccessState,
  NativeAppAnswer,
  NativeAutoStop,
  NativeBridgePrompt,
  NativeCapabilityCheck,
  NativeCapabilityId,
  NativeCheckRow,
  NativeCheckRun,
  NativeCheckState,
  NativeCheckStep,
  NativeClientRecipe,
  NativeDelivery,
  NativeDeliveryStatus,
  NativeEngineMode,
  NativeEngineStatus,
  NativeInstallPlan,
  NativeKeepAsk,
  NativeKindDeleted,
  NativeKindProblem,
  NativeKindSaved,
  NativeLaunchTarget,
  NativeMemoryAgent,
  NativeMemoryLevel,
  NativeMemoryModel,
  NativeMemoryStatus,
  NativeMessage,
  NativeMessagingLevel,
  NativeModelServerLog,
  NativeOpenUrlAction,
  NativePromptReading,
  NativeRunLimits,
  NativeRunNowResult,
  NativeSchedule,
  NativeScheduleOutcome,
  NativeSchedulePatch,
  NativeScheduleResult,
  NativeScheduleRun,
  NativeScheduleSpec,
  NativeScheduleTiming,
  NativeScreenQueue,
  NativeShareResult,
  NativeTerminalAttach,
  NativeTerminalTheme,
  NativeUpdateDownload,
  NativeUpdateSpec,
  NativeUserKind,
  NativeVersionCheck,
} from './PhoneCanDoRunner.types';

type RunnerEvents = {
  phonecandoLaunchTarget(e: NativeLaunchTarget): void;
  phonecandoBridgePrompt(e: NativeBridgePrompt): void;
  phonecandoEngineState(e: NativeEngineStatus): void;
  phonecandoPromptReading(e: { reading: NativePromptReading | null }): void;
  phonecandoMemory(e: NativeMemoryStatus): void;
  /** The messages between agents changed: a new one, or a delivery moved on; unread per agent id. */
  phonecandoMessages(e: { unread: Record<string, number> }): void;
  /** The schedules or their runs changed (added, edited, removed, fired). */
  phonecandoSchedules(e: Record<string, never>): void;
  /** An agent's ACP turn moved: an item, busy, a permission question or its end. */
  phonecandoAcp(e: NativeAcpEvent): void;
  /** An agent's checks or its Check now run changed (state, part, step, a row, movement, reading); read agentChecks again. */
  phonecandoChecks(e: { agentId: string }): void;
  /** The self-update's download moved: a step, or its bytes (about four times a second). */
  phonecandoUpdateDownload(e: NativeUpdateDownload): void;
  /** The presence changed: who drives, the hand-over to you, the agents' status lines. */
  phonecandoPresence(e: NativePresence): void;
};

/** The runner's presence frame (presence/PresenceJs.kt): who drives, the hand-over to you, each agent's status line. */
export type NativePresence = {
  driver: { agentId: string; name: string } | null;
  handOver: {
    agentId: string;
    agentName: string;
    mode: 'watch' | 'paused';
    by: 'user' | 'agent';
    why: string | null;
  } | null;
  statuses: Record<string, { text: string; mood: 'working' | 'thinking' | 'waiting' }>;
};

declare class PhoneCanDoRunnerModule extends NativeModule<RunnerEvents> {
  getPrefix(): string;
  getBuildChannel(): string;
  setAutomationEnabled(enabled: boolean): boolean;
  isAutomationEnabled(): boolean;
  consumeLaunchTarget(): NativeLaunchTarget | null;
  dismissAgentAlert(agentId: string): void;
  setOpenChat(agentId: string | null, sessionId: string | null, title: string | null): void;
  pendingPrompts(): NativeBridgePrompt[];
  resolveUnlock(requestId: string, ok: boolean): boolean;
  resolveAccessibility(requestId: string, ok: boolean, guided: boolean): boolean;
  resolveOpenUrl(requestId: string, action: NativeOpenUrlAction): boolean;
  /** Answers a permission prompt with one of its options, or null to cancel it; false when it is gone or the answer is not one it offers. */
  resolvePermission(requestId: string, optionId: string | null): boolean;
  isUiAutomationConnected(): boolean;
  openAccessibilitySettings(): string;
  isAccessibilityServiceEnabled(): boolean;
  hasAccessibilityConnectedBefore(): boolean;
  /** Auto off: the accessibility service turns itself off while nobody needs it (full builds). */
  getAutoOff(): boolean;
  /** Saves Auto off and returns it as kept. */
  setAutoOff(on: boolean): boolean;
  /** Auto off turned the service off and it has not run since. */
  wasAutoOff(): boolean;
  /** App access (full builds only; lite and play leave these out): the Allow all apps switch and every app answered Always or No. */
  appAccessList?(): NativeAppAccessList;
  /**
   * Answers an app prompt. always: right after the user's biometric (a key
   * that signs only then); false when the signature was refused, the prompt
   * left unanswered. once: the prompt's agent, until it hands the phone back.
   * no: blocks the app for every agent.
   */
  resolveAppAccess?(requestId: string, answer: NativeAppAnswer): boolean;
  /** From Settings: always (right after biometrics), blocked, or none (off both lists: asked again). */
  setAppAccess?(pkg: string, state: NativeAppAccessState | 'none'): boolean;
  /** Allow all apps; on right after biometrics. Returns the switch as kept. */
  setAllowAllApps?(on: boolean): boolean;
  /** The app's launcher icon drawn `sizePx` square, as the file:// URI of a PNG in the cache; null when Android hides the app or it has no icon. */
  appIcon?(pkg: string, sizePx: number): Promise<string | null>;
  canRequestPackageInstalls(): boolean;
  markSelfUpdatePending(): boolean;
  canShowRestrictedSettingNote(): boolean;
  showRestrictedSettingNote(): string;
  openAppInfoSettings(): string;
  requestNotificationPermission(): string;
  listAgents(): NativeAgent[];
  /** Throws kind_cannot_share when the machine has an agent of a kind that cannot keep a second agent's state apart. */
  createAgent(params: { kind: string; name: string; imageId: string }): NativeAgent;
  renameAgent(id: string, name: string): NativeAgent;
  deleteAgent(id: string): Promise<boolean>;
  promptReading(): NativePromptReading | null;
  /** Null when the model's server never ran. Absent from native builds older than the Server log page. */
  modelServerLog?(modelId: string): Promise<NativeModelServerLog | null>;
  /**
   * Starts the agent's engine in a mode (terminal by default). Live in the
   * other mode, it switches, or rejects acp_busy (an ACP turn runs) or
   * terminal_in_use (someone has its terminal open, a run or jobs going).
   */
  startEngine(agentId: string, mode?: NativeEngineMode): Promise<{ port: string | null }>;
  stopEngine(agentId: string): Promise<void>;
  /** [keepRuns]: the runs the agents have going are kept and offered back after (a self-update). */
  stopAllEngines(keepRuns: boolean): Promise<void>;
  /** The self-update's installer came back without installing: the runs stopAllEngines(true) kept are offered back; resolves with those agents. */
  updateCancelled(): Promise<string[]>;
  /** Starts the self-update's download (runner/update/), or finds it running or done. */
  startUpdateDownload(spec: NativeUpdateSpec): Promise<NativeUpdateDownload>;
  /** Stops it; its part, a finished APK and its record go. */
  stopUpdateDownload(): void;
  /** Where it stands; null for none. */
  updateDownloadState(): NativeUpdateDownload | null;
  /** Stops the agents on the model first, then its server; resolves with the agents it stopped. */
  stopModel(modelId: string): Promise<string[]>;
  runLimits(): NativeRunLimits;
  /** Saves the caps (null: none) and returns them as kept. */
  setRunLimits(limits: NativeRunLimits): NativeRunLimits;
  /** The agent page's Keep running: never stopped for being idle in the background. */
  keepRunning(agentId: string): boolean;
  /** Saves Keep running and returns it as kept. */
  setKeepRunning(agentId: string, on: boolean): boolean;
  /** The agent's own live ask to stay up (agents_keep_running), or null. */
  keepRunningAsk(agentId: string): NativeKeepAsk | null;
  /** The messages between agents (and the runner's notices to them), newest first; at most 500. */
  messageLog(limit: number): NativeMessage[];
  /** Unread (not yet in their turn) messages per agent id, only agents with some. */
  unreadCounts(): Record<string, number>;
  /** Who has the screen and who waits for it; empty while no agent with phone tools runs. */
  screenQueue(): NativeScreenQueue;
  /** Saves "Other agents can wake it" and returns the agent as kept. */
  setAgentWakeable(agentId: string, wakeable: boolean): NativeAgent;
  /** Every schedule, every agent's. */
  listSchedules(): NativeSchedule[];
  /** Adds one set by you; refused with a reason (limit, a kind that can't run schedules, ...). */
  addSchedule(spec: NativeScheduleSpec): NativeScheduleResult;
  /** Changes one; the agent stays. A text you rewrite on one the agent set makes it yours. */
  updateSchedule(id: string, patch: NativeSchedulePatch): NativeScheduleResult;
  removeSchedule(id: string): boolean;
  /** Runs it now (the app is in front, so a start is allowed); its next time stays. */
  runScheduleNow(id: string): NativeRunNowResult;
  /** The newest `limit` runs, newest first. */
  scheduleRuns(limit: number): NativeScheduleRun[];
  /** Whether runs come on time: exact alarms allowed (Alarms & reminders). */
  scheduleAlarms(): { exact: boolean };
  /** Opens Android's Alarms & reminders page for the app; false when it couldn't. */
  openAlarmSettings(): boolean;
  /** The agent page's "Can schedule itself" (on by default). */
  canScheduleItself(agentId: string): boolean;
  /** Saves it and returns it as kept. */
  setCanScheduleItself(agentId: string, on: boolean): boolean;
  /** Whether agents of the kind can run schedules (a prompt at start, or a server/hook/reader wake). */
  kindRunsSchedules(kindId: string): boolean;
  /** Android's date dialog (month 1..12; minMs..maxMs bound the days); null when cancelled. */
  pickDate(year: number, month: number, day: number, minMs: number, maxMs: number): Promise<{ year: number; month: number; day: number } | null>;
  /** Android's time dialog on the phone's own clock; null when cancelled. */
  pickTime(hour: number, minute: number): Promise<{ hour: number; minute: number } | null>;
  memoryStatus(): NativeMemoryStatus;
  isAnyEngineAlive(): boolean;
  touchEngine(agentId: string): void;
  engineStatus(agentId: string): NativeEngineStatus;
  /** The agent's ACP turn now; null when it runs in terminal mode or not at all. */
  acpSnapshot(agentId: string): NativeAcpSnapshot | null;
  /** Stops its running ACP turn; false when none runs. */
  acpCancel(agentId: string): boolean;
  /** Keeps a chat its ACP mode ran as the one its next terminal launch opens; false when its kind can't open one by id. */
  keepAcpChat(agentId: string, chatId: string): boolean;
  /** The agent's capability checks, its level now and its last Check now; null for an agent or kind we don't know. */
  agentChecks(agentId: string): NativeAgentChecks | null;
  /** Every kind's messaging level now, by kind id (a capability found not working drops it). */
  kindLevels(): Record<string, NativeMessagingLevel>;
  /** Check now: restarts the agent with a short test task, in its parts, testing every capability when full, else only those not checked yet; null when it started, else why not. */
  checkNow(agentId: string, full: boolean): string | null;
  /** Cancel check: stops the agent's engine; false when no check of it runs. */
  checkCancel(agentId: string): boolean;
  engineStatuses(): NativeEngineStatus[];
  engineHealth(agentId: string): string;
  listKinds(): string;
  listUserKinds(): NativeUserKind[];
  readUserKind(id: string): string | null;
  validateUserKind(json: string): NativeKindProblem[];
  saveUserKind(json: string, replace: boolean): NativeKindSaved;
  deleteUserKind(id: string): NativeKindDeleted;
  copyText(text: string): boolean;
  clipboardText(): string | null;
  /** Android's share sheet; `chosen: false` when it closed without a pick. `app` (the picked app's label) stays on the phone. */
  shareChooser(text: string, title: string): Promise<NativeShareResult>;
  /** When this app was first installed on the phone (ms): kept across updates, new after a reinstall. */
  firstInstallTime(): number;
  pairWebUi(agentId: string): Promise<string>;
  clientRecipe(agentId: string, projectDir: string, sessionId: string | null): NativeClientRecipe;
  isEngineIdle(agentId: string): boolean;
  /** What the agent's machine keeps from its guests: the same for every agent on it. */
  guestUnset(agentId: string): string[];
  installPlan(agentId: string, family: string): NativeInstallPlan | null;
  updatePlan(agentId: string, family: string): NativeInstallPlan | null;
  versionCheck(agentId: string): NativeVersionCheck | null;
  recordInstall(agentId: string, versionOutput: string): { version: string };
  /** How far the app's install bar is for the script job, so the notification says the same; null once the run ended. */
  showInstallShare(jobId: string, agentId: string, fraction: number | null, updating: boolean): void;
  engineTerminalAttach(agentId: string): NativeTerminalAttach;
  engineTerminalRead(viewerId: string, max: number): string | null;
  engineTerminalWrite(viewerId: string, b64: string): void;
  engineTerminalResize(viewerId: string, rows: number, cols: number): void;
  engineTerminalFocus(viewerId: string, shown: boolean): void;
  engineTerminalDetach(viewerId: string): void;
  engineTerminalTheme(theme: NativeTerminalTheme): boolean;
  getTelemetrySnapshot(): TelemetryNativeSnapshot | null;
  consumeTelemetrySnapshot(): TelemetryNativeSnapshot | null;
  setTelemetryEnabled(enabled: boolean): void;
  presenceSnapshot(): NativePresence;
  /** A UserAct name (LET_ME, STOP, GIVE_BACK, START_AGAIN, LEAVE); false when it does not apply now. */
  presenceAct(act: string): boolean;
  /** The agent's mascot as figures for the overlay (memory only: push again at start and on every change of look). */
  setMascotFigures(agentId: string, json: string): void;
  /** The app's theme setting, for the mascot on the glass (full builds; system: the phone's). */
  setGlassScheme(scheme: 'system' | 'light' | 'dark'): void;
}

const mod = requireNativeModule<PhoneCanDoRunnerModule>('PhoneCanDoRunner');

export function getPrefix(): string {
  return mod.getPrefix();
}

export function getBuildChannel(): string {
  const m = mod as unknown as { getBuildChannel?: () => string };
  if (typeof m.getBuildChannel !== 'function') return 'full';
  return m.getBuildChannel();
}

export function setAutomationEnabled(enabled: boolean): boolean {
  const m = mod as unknown as { setAutomationEnabled?: (v: boolean) => boolean };
  if (typeof m.setAutomationEnabled !== 'function') return false;
  return m.setAutomationEnabled(enabled);
}

export function isAutomationEnabled(): boolean {
  const m = mod as unknown as { isAutomationEnabled?: () => boolean };
  if (typeof m.isAutomationEnabled !== 'function') return false;
  return m.isAutomationEnabled();
}

// Where the app should land, once ({tab, agentId}); null when nothing waits.
export function consumeLaunchTarget(): NativeLaunchTarget | null {
  return mod.consumeLaunchTarget() ?? null;
}

export function isUiAutomationConnected(): boolean {
  const m = mod as unknown as { isUiAutomationConnected?: () => boolean };
  if (typeof m.isUiAutomationConnected !== 'function') return false;
  return m.isUiAutomationConnected();
}

export function openAccessibilitySettings(): string {
  const m = mod as unknown as { openAccessibilitySettings?: () => string };
  if (typeof m.openAccessibilitySettings !== 'function') return 'unsupported';
  return m.openAccessibilitySettings();
}

export function markSelfUpdatePending(): boolean {
  const m = mod as unknown as { markSelfUpdatePending?: () => boolean };
  if (typeof m.markSelfUpdatePending !== 'function') return false;
  return m.markSelfUpdatePending();
}

export function requestNotificationPermission(): string {
  return mod.requestNotificationPermission();
}

// Telemetry counters (contract: telemetry.types.ts). Null when the native
// method is missing (a build before telemetry) or fails: telemetry must never
// break its caller.
export function getTelemetrySnapshot(): TelemetryNativeSnapshot | null {
  const m = mod as unknown as { getTelemetrySnapshot?: () => TelemetryNativeSnapshot | null };
  if (typeof m.getTelemetrySnapshot !== 'function') return null;
  try {
    return m.getTelemetrySnapshot() ?? null;
  } catch {
    return null;
  }
}

// Same shape; also zeroes the native counters, clears lastExitCode,
// lastDiedAt and lastBootMs and drains the crash list, so each is returned
// once. lastStderrTail stays until the next unexpected exit replaces it.
// Callers peek, fold and store first, and consume last (telemetry.types.ts).
export function consumeTelemetrySnapshot(): TelemetryNativeSnapshot | null {
  const m = mod as unknown as { consumeTelemetrySnapshot?: () => TelemetryNativeSnapshot | null };
  if (typeof m.consumeTelemetrySnapshot !== 'function') return null;
  try {
    return m.consumeTelemetrySnapshot() ?? null;
  } catch {
    return null;
  }
}

// Mirrors the user's telemetry on/off choice into native prefs. While off,
// no engine event stream is opened just to count sessions. No-op when the
// native method is missing or fails.
export function setTelemetryEnabled(enabled: boolean): void {
  const m = mod as unknown as { setTelemetryEnabled?: (v: boolean) => void };
  if (typeof m.setTelemetryEnabled !== 'function') return;
  try {
    m.setTelemetryEnabled(enabled);
  } catch {
    // Telemetry must never break its caller.
  }
}

export default mod;
