import { hubCooldown, toModelError } from '../../engine/models/native';
import { hubErrorText } from './logic/errorText';

/** A failed Hugging Face request: its sentence, and when Try again may go (ms since the epoch; null for now). */
export type HubFailure = { error: string; retryAt: number | null };

/**
 * `e` from a Hugging Face request made from the list (a search, More) or a
 * repository's page. In the Hub's cooldown (it said none of its calls are
 * left) the sentence says how long, and Try again waits that long.
 */
export function hubFailure(e: unknown, where: 'list' | 'repo'): HubFailure {
  const err = toModelError(e);
  const cooldown = err.code === 'rate_limited' ? hubCooldown() : null;
  return {
    error: hubErrorText(err.code, err.message, cooldown, where),
    retryAt: cooldown != null && cooldown > 0 ? Date.now() + cooldown * 1000 : null,
  };
}
