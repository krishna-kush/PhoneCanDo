// What the app knows about an agent kind: its manifest as the runner passes
// it on (listKinds), with no templates and no secrets. Screens and state
// reach it through app/src/engine/agents/registry.ts.
import type { WebAdapterSpec } from './web.ts';

export type KindHome = 'web' | 'tui';

export type KindSignIn = {
  method: 'device-code' | 'paste-code' | 'browser' | 'api-key' | 'in-tui' | 'in-ui';
  note?: string;
};

export type KindView = {
  /** The kind's id: its folder name and its manifest id. */
  id: string;
  label: string;
  version: string;
  type: 'native' | 'image';
  channels: ('full' | 'lite' | 'play')[];
  stability: 'stable' | 'preview';
  /** The kind a fresh install starts with: the bundled one whose manifest says `default: true`; one kind at most. */
  isDefault: boolean;
  /** What the home tab shows. */
  home: KindHome;
  /** The web UI (when the kind has one). */
  web: { adapter: WebAdapterSpec } | null;
  /** A regex whose group 1 is the chat title the TUI puts in the terminal title. */
  chatTitle: string | null;
  signIn: KindSignIn[];
  /** Shipped in this build, or added on this phone by the user. */
  origin: 'bundled' | 'user';
  /** True when the kind can only run in a Linux image. */
  requiresLinux: boolean;
  /** Commands it needs on the image's PATH (requires.commands); the missing-tools hint checks them. */
  commands: string[];
  /** The package families its install supports (its own, cut down to what each runtime it
      needs supports); null means any. */
  families: string[] | null;
  /** The runtime plugins it needs in its machine (`node`), by id; empty for none. */
  runtimes: string[];
  /** It has an install block: each agent of it is installed into its machine before it starts. */
  hasInstall: boolean;
  /** Native kinds: every payload lib is in this APK. Image kinds: true. */
  payloadPresent: boolean;
  /** The wire APIs it can use a local model with, in the order it prefers them; empty: none. */
  models: ('openai-chat' | 'openai-responses' | 'anthropic')[];
  /** An agent of it can keep its sign-in, settings, chats and instructions in a state folder of its own
      (the manifest's `state`), so a second agent of it can share a machine with the first. */
  stateFolder: boolean;
  /** How other agents' messages reach a running agent of it: push, into its turns (the manifest's `inbox`),
      or pull, only when it calls agents_inbox (MCP results tell it when it has unread ones). */
  inbox: 'push' | 'pull';
  /** An idle agent of it can be woken by another agent's message (the manifest's `inbox.wake`). */
  canWake: boolean;
  /** How far other agents' messages reach it, best first (kit-api MessagingLevel): wakes (pushed, and a
      message can start a turn while it is idle), delivered (pushed into its turns), inbox (only when it
      calls agents_inbox), none (no phone tools: it can neither read nor send). */
  messaging: MessagingLevel;
};

/** How far other agents' messages reach an agent of a kind (kit-api MessagingLevel), best first. */
export type MessagingLevel = 'wakes' | 'delivered' | 'inbox' | 'none';
