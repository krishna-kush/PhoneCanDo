// A custom agent kind pasted in (someone else's export, or one's own from
// another phone): the JSON read and held to the kit's rules for a user kind
// before the review step shows what it runs. Pure (zero RN imports).
import { isObject, type Json } from '../../../../../agents/kit/ts/manifest/primitives.ts';
import { validate } from '../../../../../agents/kit/ts/manifest/validate.ts';

export type Imported = { ok: true; id: string; manifest: Json; text: string } | { ok: false; problems: string[] };

export function parseImport(text: string): Imported {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, problems: ['Paste an agent first.'] };
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return { ok: false, problems: ["That isn't JSON. Copy the whole agent, from { to }."] };
  }
  if (!isObject(json)) return { ok: false, problems: ['An agent is one JSON object, from { to }.'] };
  const result = validate(json, { origin: 'user' });
  if (!result.ok) return { ok: false, problems: result.problems.map((p) => `${p.path || '/'}: ${p.detail}`) };
  return { ok: true, id: json.id as string, manifest: json, text: `${JSON.stringify(json, null, 2)}\n` };
}
