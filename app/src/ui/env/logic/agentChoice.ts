// The Choose agent step's words and its env. Pure (zero RN imports): which
// env a target's offers are judged against, what a blocked card says, the
// badges a card shows and the line over the cards.
import { offerEnvOf, type Offer, type OfferBlock, type OfferEnv } from '../../../engine/agents/offers.ts';
import type { Env } from '../../../engine/linux/types';
import type { NewAgentTarget } from './routes';
import { envTitle } from './titles.ts';

type EnvLike = Pick<Env, 'id' | 'source' | 'state' | 'os'>;

const BLOCKED_TEXT: Record<OfferBlock, string> = {
  needs_linux: 'Needs a Linux env',
  family: "Can't be installed on this env's OS",
  env_not_ready: "This env isn't ready yet",
};

/** Why a card can't be picked, in one line; null when it can. */
export function blockedText(blocked: OfferBlock | null): string | null {
  return blocked ? BLOCKED_TEXT[blocked] : null;
}

/** "Custom" for a kind the user added, "Preview" for one not yet stable. */
export function offerBadges(offer: Pick<Offer, 'origin' | 'stability'>): string[] {
  const badges: string[] = [];
  if (offer.origin === 'user') badges.push('Custom');
  if (offer.stability === 'preview') badges.push('Preview');
  return badges;
}

/**
 * The env a target's offers are judged against. The Default and Android
 * envs are made on the spot, and an Own env's agent is made once it is
 * downloaded, so those count as ready; an Own env's OS is unknown until then.
 */
export function targetOfferEnv(target: NewAgentTarget, envs: readonly EnvLike[]): OfferEnv {
  switch (target.kind) {
    case 'env': {
      const env = envs.find((e) => e.id === target.envId);
      return env ? offerEnvOf(env) : { kind: 'linux', family: null, ready: false };
    }
    case 'default': {
      const env = envs.find((e) => e.source.kind === 'default');
      return { kind: 'linux', family: env?.os?.family ?? null, ready: true };
    }
    case 'android':
      return { kind: 'android', family: null, ready: true };
    case 'own':
      return { kind: 'linux', family: null, ready: true };
  }
}

/** First launch's env: the Default env on the Linux path, else Android's own shell. */
export function setupOfferEnv(path: 'linux' | 'android', envs: readonly EnvLike[]): OfferEnv {
  return targetOfferEnv(path === 'linux' ? { kind: 'default' } : { kind: 'android' }, envs);
}

/** The line over the cards: where the new agent's machine comes from. */
export function targetLine(target: NewAgentTarget, envs: readonly EnvLike[]): string {
  switch (target.kind) {
    case 'env': {
      const env = envs.find((e) => e.id === target.envId);
      if (env?.source.kind === 'android') return "The new agent uses Android's own shell.";
      return env ? `The new agent gets its own machine made from ${envTitle(env.source)}.` : 'This env is gone.';
    }
    case 'default':
      return 'The new agent gets its own machine made from the Default env.';
    case 'android':
      return "The new agent uses Android's own shell.";
    case 'own':
      return `The new agent gets its own machine made from ${target.repo}:${target.tag.name} once the download is done.`;
  }
}

/** The step's button: an Own env's download starts with it. */
export function pickLabel(target: NewAgentTarget): string {
  return target.kind === 'own' ? 'Download' : 'Make agent';
}

/** Why nothing can be picked; null when something can. */
export function noOfferText(offers: readonly Pick<Offer, 'blocked'>[]): string | null {
  if (offers.length === 0) return 'This build has no agents to offer.';
  return offers.some((o) => o.blocked == null) ? null : 'None of these agents can run here.';
}
