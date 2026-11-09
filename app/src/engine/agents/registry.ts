// Every agent kind the app can run, as the runner lists them: each kind's
// manifest (agents/<type>/<id>/agent.json, packaged per channel) without
// templates or secrets (KindView). Read and parsed once per JS run. Screens
// look up the kind of the agent in question (`agentKind(agent.kind)`); there
// is no app-wide kind.
import type { KindView } from '../../../../agents/kit/ts/contract/view.ts';
import { listKinds } from '../runner';

export type AgentKindId = string;

let kinds: KindView[] | null = null;
const unknown = new Map<AgentKindId, KindView>();

/** Every kind the runner lists (the Choose agent step offers them through offers.ts). */
export function allKinds(): KindView[] {
  if (!kinds) {
    try {
      kinds = JSON.parse(listKinds()) as KindView[];
    } catch {
      // No native runner (Expo Go, web): no kinds, and no agents either.
      kinds = [];
    }
  }
  return kinds;
}

/** The kind a fresh install starts with (the one the runner marks default). */
export function defaultAgentKind(): AgentKindId {
  const kind = allKinds().find((k) => k.isDefault);
  if (!kind) throw new Error('no agent kinds: the native runner is unavailable');
  return kind.id;
}

/**
 * The kind with this id. An agent of a kind this build does not ship gets a
 * stand-in: named by its id, with no web UI and no chat titles, so screens
 * show it without crashing. The same id always gets the same object.
 */
export function agentKind(id: AgentKindId): KindView {
  const kind = allKinds().find((k) => k.id === id) ?? unknown.get(id);
  if (kind) return kind;
  const standIn: KindView = {
    id,
    label: id,
    version: '',
    type: 'image',
    channels: [],
    stability: 'preview',
    isDefault: false,
    home: 'tui',
    web: null,
    chatTitle: null,
    signIn: [],
    origin: id.startsWith('user.') ? 'user' : 'bundled',
    requiresLinux: false,
    families: null,
    runtimes: [],
    commands: [],
    hasInstall: false,
    // Not in this build: never offered, and never started.
    payloadPresent: false,
  };
  unknown.set(id, standIn);
  return standIn;
}
