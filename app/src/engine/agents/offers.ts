// Which agent kinds a creation step offers, for this build's channel and the
// env the new agent's machine comes from. Pure (zero RN imports): the
// "Choose agent" step, first launch and the flows read it, and
// scripts/vectors/test_agent_offers.js checks it.
//
// Hidden: kinds this channel does not ship, and native kinds whose payload
// is missing from this APK. Blocked (shown, not choosable, with a reason):
// a kind that needs Linux on an Android env, a kind whose install does not
// support the env's package family, and any kind while the env is not ready.
import type { KindView } from '../../../../agents/kit/ts/contract/view.ts';
import type { Env } from '../linux/types';

/** The env a new agent's machine comes from, as far as the offers care. */
export type OfferEnv = {
  /** In a Linux image, or with Android's own shell. */
  kind: 'linux' | 'android';
  /** The env's package family (`apt`, `apk`, …); null while unknown (or none). */
  family: string | null;
  ready: boolean;
};

export type OfferBlock = 'needs_linux' | 'family' | 'env_not_ready';

export type Offer = {
  id: string;
  label: string;
  origin: 'bundled' | 'user';
  stability: 'stable' | 'preview';
  /** Why it cannot be picked here; null when it can. */
  blocked: OfferBlock | null;
};

/**
 * What the offers read of a kind. The runner's newer fields may be missing
 * (a native build from before them), so each has a default: a `user.` id is
 * a user kind, an image kind needs Linux, any family, payload present.
 */
export type OfferKind = Pick<KindView, 'id' | 'label' | 'type' | 'channels' | 'stability'> & {
  origin?: 'bundled' | 'user';
  requiresLinux?: boolean;
  /** Package families the install supports; null means any. */
  families?: readonly string[] | null;
  payloadPresent?: boolean;
};

export type OffersInput = { channel: string; env: OfferEnv; kinds: readonly OfferKind[] };

const USER_ID_PREFIX = 'user.';

function originOf(kind: OfferKind): Offer['origin'] {
  if (kind.origin === 'bundled' || kind.origin === 'user') return kind.origin;
  return kind.id.startsWith(USER_ID_PREFIX) ? 'user' : 'bundled';
}

function needsLinux(kind: OfferKind): boolean {
  return kind.type === 'image' || kind.requiresLinux === true;
}

// A kind's families against the env's: either one unknown passes.
function familyFits(kind: OfferKind, family: string | null): boolean {
  const families = Array.isArray(kind.families) ? kind.families : null;
  return families == null || family == null || families.includes(family);
}

function blockOf(kind: OfferKind, env: OfferEnv): OfferBlock | null {
  if (env.kind === 'android' && needsLinux(kind)) return 'needs_linux';
  if (!familyFits(kind, env.family)) return 'family';
  if (!env.ready) return 'env_not_ready';
  return null;
}

// Available first, bundled before user, stable before preview, then by label.
function rank(offer: Offer): number {
  return (offer.blocked ? 4 : 0) + (offer.origin === 'user' ? 2 : 0) + (offer.stability === 'preview' ? 1 : 0);
}

function byLabel(a: Offer, b: Offer): number {
  const la = a.label.toLowerCase();
  const lb = b.label.toLowerCase();
  if (la !== lb) return la < lb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function offersFor({ channel, env, kinds }: OffersInput): Offer[] {
  return kinds
    .filter((k) => (k.channels as readonly string[]).includes(channel) && k.payloadPresent !== false)
    .map((k) => ({ id: k.id, label: k.label, origin: originOf(k), stability: k.stability, blocked: blockOf(k, env) }))
    .sort((a, b) => rank(a) - rank(b) || byLabel(a, b));
}

/** The offer to take without asking: exactly one kind shows, and it can be picked. */
export function soleOffer(offers: readonly Offer[]): Offer | null {
  return offers.length === 1 && offers[0].blocked == null ? offers[0] : null;
}

/** The offer the step starts on: the default kind when it can be picked here, else the first that can. */
export function preselect(offers: readonly Offer[], defaultId: string | null): string | null {
  const available = offers.filter((o) => o.blocked == null);
  return (available.find((o) => o.id === defaultId) ?? available[0])?.id ?? null;
}

/**
 * The kind to go on with without asking: the one already picked when it can
 * still be made here (first launch falling back from Linux to Android), else
 * the sole offer; null when the step has to ask.
 */
export function autoPick(offers: readonly Offer[], picked: string | null): string | null {
  if (picked != null && offers.some((o) => o.id === picked && o.blocked == null)) return picked;
  return soleOffer(offers)?.id ?? null;
}

/** An env record as the offers see it. */
export function offerEnvOf(env: Pick<Env, 'source' | 'state' | 'os'>): OfferEnv {
  return {
    kind: env.source.kind === 'android' ? 'android' : 'linux',
    family: env.os?.family ?? null,
    ready: env.state === 'ready',
  };
}
