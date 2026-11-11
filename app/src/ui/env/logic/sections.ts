// The systems list: each env with its machines (image + its agent) as rows.
// Default first, then Own envs oldest first, Android last. Anything whose env
// or image we cannot find still gets a row (in a last group without an env),
// so it can be opened and deleted. Pure (zero RN imports).
import type { Agent } from '../../../engine/agents/records';
import type { Env, Image } from '../../../engine/linux/types';

type EnvLike = Pick<Env, 'id' | 'source' | 'createdAt'>;
type ImageLike = Pick<Image, 'id' | 'envId' | 'createdAt'>;
type AgentLike = Pick<Agent, 'id' | 'imageId' | 'createdAt'>;

export type EnvRow<I, A> = { key: string; image: I | null; agent: A | null };
export type EnvSection<E, I, A> = { key: string; env: E | null; rows: EnvRow<I, A>[] };

const SOURCE_ORDER: Record<Env['source']['kind'], number> = { default: 0, registry: 1, android: 2 };

export function buildEnvSections<E extends EnvLike, I extends ImageLike, A extends AgentLike>(
  envs: readonly E[],
  images: readonly I[],
  agents: readonly A[],
): EnvSection<E, I, A>[] {
  const agentOf = new Map(agents.map((a) => [a.imageId, a]));
  const rowOf = (image: I): EnvRow<I, A> => ({ key: image.id, image, agent: agentOf.get(image.id) ?? null });
  const since = (r: EnvRow<I, A>) => r.agent?.createdAt ?? r.image?.createdAt ?? 0;

  const sorted = [...envs].sort(
    (a, b) => SOURCE_ORDER[a.source.kind] - SOURCE_ORDER[b.source.kind] || a.createdAt - b.createdAt,
  );
  const envIds = new Set(envs.map((e) => e.id));
  const sections: EnvSection<E, I, A>[] = sorted.map((env) => ({
    key: env.id,
    env,
    rows: images
      .filter((i) => i.envId === env.id)
      .map(rowOf)
      .sort((a, b) => since(a) - since(b)),
  }));

  const imageIds = new Set(images.map((i) => i.id));
  const lost: EnvRow<I, A>[] = [
    ...images.filter((i) => !envIds.has(i.envId)).map(rowOf),
    ...agents.filter((a) => !imageIds.has(a.imageId)).map((a) => ({ key: `agent:${a.id}`, image: null, agent: a })),
  ];
  if (lost.length > 0) sections.push({ key: 'lost', env: null, rows: lost.sort((a, b) => since(a) - since(b)) });
  return sections;
}
