// The Models page's and the agent page's words: verdicts, sizes, progress
// lines, the honest note, a prompt being read. Pure (zero RN imports).
import type {
  LocalModel,
  ModelDownload,
  ModelHit,
  ModelParams,
  ModelProgress,
  ModelSource,
  ModelVariant,
  RamCheck,
} from '../../../engine/models/types';
import { formatBytes, formatCount, formatRate } from '../../env/logic/format.ts';
import { contextText } from './context.ts';

/** What every local-model screen says once: a phone CPU is slow to read a long prompt. */
export const HONEST_NOTE =
  "A local model runs on this phone's own processor. Reading an agent's long prompt can take minutes before the first reply; later replies are faster. Plug in a charger for long runs.";

const VERDICT_TEXT: Record<RamCheck['verdict'], string> = {
  fits: 'Fits this phone',
  tight: 'Fits, but tight: close other apps first',
  over_budget: 'More than this phone can spare: Android may stop the model server',
  too_big: 'Too big for this phone',
  unsupported: "This phone can't run local models",
};

export function verdictText(ram: RamCheck): string {
  return VERDICT_TEXT[ram.verdict];
}

/** "Needs 3.3 GB of RAM; this phone can spare 3.9 GB." */
export function needText(ram: RamCheck): string {
  if (ram.verdict === 'unsupported') return '';
  return `Needs ${formatBytes(ram.needBytes)} of RAM; this phone can spare ${formatBytes(ram.budgetBytes)}.`;
}

/**
 * 4_020_000_000 → "4B", 1_500_000_000 → "1.5B", 751_632_384 → "0.8B", 135_000_000 → "135M"; '' when
 * unknown. From 450M up in tenths of a billion, as model makers name them (Qwen3.5-0.8B, Qwen2.5-0.5B);
 * below that in millions (SmolLM2-135M, 360M).
 */
export function paramsText(count: number | null): string {
  if (count == null || !Number.isFinite(count) || count <= 0) return '';
  if (count < 450_000_000) return `${Math.max(1, Math.round(count / 1e6))}M`;
  const b = count / 1e9;
  const digits = b >= 10 ? 0 : 1;
  return `${b.toFixed(digits).replace(/\.0$/, '')}B`;
}

/** A search result's size: "27B", "2B effective" (Gemma's E2B); '' when unknown. */
export function hitSizeText(params: ModelParams | null | undefined): string {
  const text = paramsText(params?.count ?? null);
  return text && params?.effective ? `${text} effective` : text;
}

/** "2.7 GB · Q4_K_M · 4B · 16k context" */
export function modelLine(m: LocalModel): string {
  const context = m.servedContext > 0 ? `${contextText(m.servedContext)} context` : '';
  return [formatBytes(m.sizeBytes), m.quant ?? '', paramsText(m.parameterCount), context].filter(Boolean).join(' · ');
}

export function sourceText(source: ModelSource): string {
  return source.kind === 'huggingface' ? source.repo : `Imported from ${source.fileName}`;
}

// llama.cpp's split-file suffix, as lme's Shards reads it: `<stem>-00001-of-00003.gguf`.
const PART_SUFFIX = /-[0-9]{5}-of-[0-9]{5}(\.gguf)$/i;

/** "Q4_K_M", else the entry file's name, a split one's part suffix left out: "x.gguf" for "x-00001-of-00003.gguf". */
export function variantTitle(v: ModelVariant): string {
  return v.quant ?? (v.files[0]?.path.split('/').pop()?.replace(PART_SUFFIX, '$1') || 'Model');
}

/**
 * Its file's path, "Q4/x-Q4_K_M.gguf"; a split one's parts in order, each
 * with its size: "x-00001-of-00002.gguf (49.7 GB), x-00002-of-00002.gguf (11.4 GB)".
 */
export function variantFiles(v: ModelVariant): string {
  if (v.files.length === 1) return v.files[0].path;
  return v.files.map((f) => `${f.path.split('/').pop()} (${formatBytes(f.sizeBytes)})`).join(', ');
}

/** "2.7 GB", "48.1 GB in 3 parts" */
export function variantLine(v: ModelVariant): string {
  const parts = v.files.length > 1 ? ` in ${v.files.length} parts` : '';
  return `${formatBytes(v.sizeBytes)}${parts}`;
}

/** "27B · 1.2M downloads · 340 likes", the size first when we know it. */
export function hitLine(hit: ModelHit): string {
  return [hitSizeText(hit.params), `${formatCount(hit.downloads) || '0'} downloads`, `${formatCount(hit.likes) || '0'} likes`]
    .filter(Boolean)
    .join(' · ');
}

/** done/total in 0..1; null when the total is unknown. */
export function fraction(done: number, total: number | null): number | null {
  if (total == null || !(total > 0)) return null;
  return Math.max(0, Math.min(1, done / total));
}

/** A job's line under its progress bar, or a paused download's. */
export function jobLine(p: ModelProgress | undefined, paused: ModelDownload | null): string {
  if (p && !p.finished) {
    if (p.step === 'retry' && p.retry) {
      return `Connection lost: trying again in ${p.retry.delaySec} s (try ${p.retry.attempt} of ${p.retry.max})`;
    }
    if (p.step === 'verify') return `Checking what is already here: ${formatBytes(p.done)}`;
    if (p.step === 'start') return 'Starting';
    const total = p.total != null ? ` of ${formatBytes(p.total)}` : '';
    const rate = p.rateBytesPerSec != null ? ` · ${formatRate(p.rateBytesPerSec)}` : '';
    return `${formatBytes(p.done)}${total}${rate}`;
  }
  if (paused) return `Paused at ${formatBytes(paused.doneBytes)} of ${formatBytes(paused.sizeBytes)}`;
  return '';
}

/** 950 → "950", 4_096 → "4.1k", 12_345 → "12.3k" (the runner's notification writes them the same way). */
export function tokensText(count: number): string {
  if (!Number.isFinite(count) || count < 1000) return String(Math.max(0, Math.floor(count || 0)));
  return `${(count / 1000).toFixed(1)}k`;
}

/** The header's line while the model reads a prompt: "Reading prompt · 4.1k", without a count before the first batch. */
export function readingText(read: number): string {
  return read > 0 ? `Reading prompt · ${tokensText(read)}` : 'Reading prompt';
}

/** What a screen reader says of it. */
export function readingLabel(read: number): string {
  const base = 'The local model is reading the prompt';
  return read > 0 ? `${base}: ${tokensText(read)} tokens so far` : base;
}
