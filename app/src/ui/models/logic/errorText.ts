// Model error codes as plain sentences. Pure (zero RN imports). Only
// `internal` adds the native line: the code alone tells nobody anything.
import type { ModelErrorCode } from '../../../engine/models/types';

const TEXT: Record<ModelErrorCode, string> = {
  invalid_gguf: "That file isn't a model we can run (a GGUF file).",
  too_large: "That model's file has a header too big for us to read.",
  bad_answer: "Hugging Face sent an answer we couldn't read. Try again later.",
  invalid_name: "That isn't a valid model or repository name.",
  exists: 'This model is already on the phone.',
  no_space: 'Your phone is out of space. Free some up and try again.',
  size_mismatch: "The file didn't have the size it should. Try again.",
  digest_mismatch: 'The download got damaged on the way. Try again.',
  network: "We couldn't reach Hugging Face. Check your connection and try again.",
  rate_limited: 'Hugging Face is limiting requests right now. Try again later.',
  not_found: "We couldn't find that on Hugging Face.",
  access_denied:
    'This model is gated or private. Accept its terms on huggingface.co, then add a token from that account below.',
  corrupt: 'The list of models on the phone is damaged.',
  unsupported_device: "This phone can't run local models.",
  not_enough_memory: 'This model needs more RAM than this phone can spare.',
  server_not_ready: "The model didn't start.",
  cancelled: 'It stopped before it finished.',
  busy: 'It is already running.',
  invalid_token: "That doesn't look like a Hugging Face token (one word, like hf_…).",
  picker_unavailable: "The phone's file picker didn't open.",
  models_unavailable: "Local models aren't in this build.",
  internal: 'Something went wrong on our side.',
};

function isCode(code: string): code is ModelErrorCode {
  return Object.prototype.hasOwnProperty.call(TEXT, code);
}

/** A failed model action as a sentence; `in_use` carries the agents' names as its message. */
export function modelErrorText(code: string, message: string): string {
  if (code === 'in_use') return `${message} ${message.includes(',') ? 'run' : 'runs'} on it. Pick another model for them first.`;
  if (isCode(code) && code !== 'internal') return TEXT[code];
  // Its first line only: a bridge failure goes on with a JS stack.
  const detail = message.trim().split('\n')[0].trim();
  return detail ? `${TEXT.internal} (${detail})` : TEXT.internal;
}

/** How long a Hugging Face wait has left: "40 s", "about 2 min" (rounded up). */
export function waitText(seconds: number): string {
  const whole = Math.max(1, Math.ceil(seconds));
  return whole < 60 ? `${whole} s` : `about ${Math.ceil(whole / 60)} min`;
}

// The list asks for nothing gated or private, and the Hub ignores a wrong
// token on a public call (it answers as for no token): a refusal there is
// the Hub refusing this network or account.
const LIST_REFUSED =
  'Hugging Face refused the request: it may be blocking this network or account for a while. Try again later, or on another network.';

/**
 * A failed Hugging Face request as a sentence, by where it was asked from:
 * the list (a search, More) or a repository's page. A limit says how long it
 * lasts when the Hub said (`cooldown` seconds, from hubCooldown).
 */
export function hubErrorText(code: string, message: string, cooldown: number | null, where: 'list' | 'repo'): string {
  if (code === 'rate_limited' && cooldown != null && cooldown > 0) {
    return `Hugging Face is limiting requests: try again in ${waitText(cooldown)}.`;
  }
  if (code === 'access_denied' && where === 'list') return LIST_REFUSED;
  return modelErrorText(code, message);
}
