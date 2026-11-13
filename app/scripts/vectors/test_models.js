// Local models: the job progress fold (src/state/flows/logic/modelProgress.ts),
// a new agent's Model step (src/state/flows/logic/modelStep.ts), the Models
// page's words and lines, a model's users and its card's line, a prompt
// being read, its error sentences, the model choices, a model's dates
// line, the Hugging Face list's filters and a model's context and its
// slider (src/ui/models/logic/) and the start
// failure text for model_unavailable and the caps (src/ui/env/logic/).
// Imports the real pure modules (Node 22.18+ strips their types), so these
// cannot drift.
// Run: node test_models.js (or pnpm check:vectors)
'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name} got=${q(got)} want=${q(want)}`);
}
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;

const GB = 1e9;
const ram = (verdict, need = 3.3 * GB, budget = 3.9 * GB) => ({ verdict, needBytes: need, budgetBytes: budget });
const event = (over) => ({
  jobId: 'model-job-1',
  target: { kind: 'download', id: 'qwen' },
  label: 'Qwen3.5 4B',
  step: 'download',
  done: 1.2 * GB,
  total: 2.7 * GB,
  rateBytesPerSec: 3_400_000,
  retry: null,
  finished: false,
  error: null,
  errorCode: null,
  ...over,
});
const model = (over) => ({
  id: 'qwen3-5-4b-q4-k-m',
  name: 'Qwen3.5 4B',
  source: { kind: 'huggingface', repo: 'unsloth/Qwen3.5-4B-GGUF', revision: 'e87f' },
  sizeBytes: 2_740_937_888,
  quant: 'Q4_K_M',
  architecture: 'qwen35',
  parameterCount: 4_020_000_000,
  contextLength: 262_144,
  servedContext: 16_384,
  autoContext: 16_384,
  contextChoice: null,
  contextRange: { min: 16_384, max: 262_144, step: 1_024 },
  serving: false,
  addedAt: 0,
  dates: { kind: 'released', released: '2026-03', cutoff: null },
  ram: ram('fits'),
  ...over,
});

(async () => {
  // --- state/flows/logic/modelProgress ------------------------------------
  const { applyModelProgress, dropModelJob, importJobs, modelJobKey } = await import(src('state/flows/logic', 'modelProgress.ts'));
  t('job key', modelJobKey({ kind: 'import', id: 'import-3' }), 'import:import-3');
  let jobs = applyModelProgress({}, event({}));
  t('a running job is kept', Object.keys(jobs), ['download:qwen']);
  jobs = applyModelProgress(jobs, event({ finished: true, ok: true }));
  t('one that ended well goes', jobs, {});
  jobs = applyModelProgress({}, event({ finished: true, ok: false, error: 'x', errorCode: 'network' }));
  t('one that failed stays', jobs['download:qwen'].errorCode, 'network');
  t('dismissed', dropModelJob(jobs, 'download:qwen'), {});
  const imports = importJobs({
    'import:import-10': event({ target: { kind: 'import', id: 'import-10' } }),
    'import:import-9': event({ target: { kind: 'import', id: 'import-9' } }),
    'download:qwen': event({}),
  });
  t('imports, oldest first', imports.map((p) => p.target.id), ['import-9', 'import-10']);
  const { lostDownloadJobs } = await import(src('state/flows/logic', 'modelProgress.ts'));
  const failedAs = (id, errorCode) =>
    event({ target: { kind: 'download', id }, finished: true, ok: false, error: 'x', errorCode });
  const lost = lostDownloadJobs(
    {
      'download:gone': failedAs('gone', 'invalid_gguf'),
      'download:kept': failedAs('kept', 'network'),
      'download:deleted': failedAs('deleted', 'cancelled'),
      'download:running': event({ target: { kind: 'download', id: 'running' } }),
      'import:import-1': event({ target: { kind: 'import', id: 'import-1' }, finished: true, ok: false, errorCode: 'invalid_gguf' }),
    },
    ['kept'],
  );
  t('a failed download with no record left is shown', lost.map((p) => p.target.id), ['gone']);

  // --- state/flows/logic/modelStep: a new agent's Model step ----------------
  const ms = await import(src('state/flows/logic', 'modelStep.ts'));
  const takes = { models: ['openai-chat'] };
  const takesNone = { models: [] };
  const small = model({ id: 'small' });
  const tight = model({ id: 'tight', ram: ram('tight') });
  const huge = model({ id: 'huge', ram: ram('too_big') });
  t('fits runs here', ms.runsHere(ram('fits')), true);
  t('tight runs here', ms.runsHere(ram('tight')), true);
  t('a chosen context past the budget runs here', ms.runsHere(ram('over_budget')), true);
  t('too big does not', ms.runsHere(ram('too_big')), false);
  t('unsupported does not', ms.runsHere(ram('unsupported')), false);
  t('step: kind takes models, one fits', ms.hasModelStep(takes, [huge, small]), true);
  t('step: a tight one counts', ms.hasModelStep(takes, [tight]), true);
  t('no step: none fits', ms.hasModelStep(takes, [huge]), false);
  t('no step: no models', ms.hasModelStep(takes, []), false);
  t('no step: kind takes none', ms.hasModelStep(takesNone, [small]), false);
  t('held: own setup by default', ms.heldModel(takes, [small], null), null);
  t('held: a model that runs', ms.heldModel(takes, [small, huge], 'small'), 'small');
  t('held: one too big falls back', ms.heldModel(takes, [small, huge], 'huge'), null);
  t('held: one gone falls back', ms.heldModel(takes, [small], 'deleted'), null);
  t('held: a kind that takes none drops it', ms.heldModel(takesNone, [small], 'small'), null);

  // --- ui/models/logic/modelText -------------------------------------------
  const mt = await import(src('ui/models/logic', 'modelText.ts'));
  t('fits', mt.verdictText(ram('fits')), 'Fits this phone');
  t('tight', mt.verdictText(ram('tight')), 'Fits, but tight: close other apps first');
  t('too big', mt.verdictText(ram('too_big')), 'Too big for this phone');
  t('over budget', mt.verdictText(ram('over_budget')), 'More than this phone can spare: Android may stop the model server');
  t('need line, over budget', mt.needText(ram('over_budget', 4.9 * GB)), 'Needs 4.9 GB of RAM; this phone can spare 3.9 GB.');
  t('need line', mt.needText(ram('fits')), 'Needs 3.3 GB of RAM; this phone can spare 3.9 GB.');
  t('no need line when unsupported', mt.needText(ram('unsupported')), '');
  t('params 4B', mt.paramsText(4_020_000_000), '4B');
  t('params from 450M in tenths of a billion', [mt.paramsText(800_000_000), mt.paramsText(751_632_384), mt.paramsText(494_000_000)], ['0.8B', '0.8B', '0.5B']);
  t('params under 450M in millions', [mt.paramsText(135_000_000), mt.paramsText(360_000_000)], ['135M', '360M']);
  t('params at 1B', [mt.paramsText(999_600_000), mt.paramsText(1_235_814_400), mt.paramsText(1_500_000_000)], ['1B', '1.2B', '1.5B']);
  t('params 122B', mt.paramsText(122_100_000_000), '122B');
  t('params unknown', mt.paramsText(null), '');
  t('model line', mt.modelLine(model({})), '2.7 GB · Q4_K_M · 4B · 16k context');
  t('model line, sparse', mt.modelLine(model({ quant: null, parameterCount: null })), '2.7 GB · 16k context');
  t('model line, a context off the grid', mt.modelLine(model({ servedContext: 33_792 })), '2.7 GB · Q4_K_M · 4B · 33k context');
  t('source hf', mt.sourceText(model({}).source), 'unsloth/Qwen3.5-4B-GGUF');
  t('source imported', mt.sourceText({ kind: 'imported', fileName: 'my.gguf' }), 'Imported from my.gguf');

  const us = await import(src('ui/models/logic', 'usage.ts'));
  const crew = [
    { id: 'a', name: 'Ada', model: 'qwen' },
    { id: 'b', name: 'Bob', model: 'gemma' },
    { id: 'c', name: 'Cy', model: 'qwen' },
    { id: 'd', name: 'Di', model: null },
    { id: 'e', name: 'Eve', model: 'qwen' },
  ];
  const up = (a) => a.id === 'e';
  t('users: only the model\'s, running first, else in list order', us.usersOf(crew, 'qwen', up).map((a) => a.name), ['Eve', 'Ada', 'Cy']);
  t('users: none', us.usersOf(crew, 'llama', up), []);
  t('usage: loaded, some running', us.usageLine(true, 2, 1), 'loaded · 2 agents · 1 running');
  t('usage: not loaded, one agent', us.usageLine(false, 1, 0), 'not loaded · 1 agent');
  t('usage: no agents', us.usageLine(false, 0, 0), 'not loaded · no agents');
  const part = (i) => ({ path: `Q8_0/x-0000${i}-of-00003.gguf`, sizeBytes: [0, 20 * GB, 20 * GB, 8.1 * GB][i], sha256: 'a' });
  const split = { quant: null, files: [part(1), part(2), part(3)], sizeBytes: 48.1 * GB };
  t('variant title falls back to the file, part suffix left out', mt.variantTitle(split), 'x.gguf');
  t('variant title, upper case part suffix', mt.variantTitle({ ...split, files: [{ path: 'X-00001-OF-00002.GGUF' }] }), 'X.GGUF');
  t('variant title, no files', mt.variantTitle({ quant: null, files: [], sizeBytes: 0 }), 'Model');
  t(
    'variant files, every part by name with its size',
    mt.variantFiles(split),
    'x-00001-of-00003.gguf (20 GB), x-00002-of-00003.gguf (20 GB), x-00003-of-00003.gguf (8.1 GB)',
  );
  t('variant files, one file', mt.variantFiles({ ...split, files: [{ path: 'Q4/x-Q4_K_M.gguf' }] }), 'Q4/x-Q4_K_M.gguf');
  t('variant line, split', mt.variantLine(split), '48.1 GB in 3 parts');
  t('variant line', mt.variantLine({ ...split, files: [{}], quant: 'Q4_K_M' }), '48.1 GB');
  t('hit line', mt.hitLine({ repo: 'a/b', downloads: 1_234_567, likes: 340 }), '1.2M downloads · 340 likes');
  t('hit line, none yet', mt.hitLine({ repo: 'a/b', downloads: 0, likes: 0 }), '0 downloads · 0 likes');
  t('hit line, its size first', mt.hitLine({ repo: 'a/b', downloads: 1_234_567, likes: 340, params: { count: 27e9, effective: false } }), '27B · 1.2M downloads · 340 likes');
  const sized = (smallest, largest, count = 4) => ({ count, smallest, largest });
  t(
    'hit line, its download sizes after its size',
    mt.hitLine({ repo: 'a/b', downloads: 10, likes: 1, params: { count: 4e9, effective: false }, sizes: sized(1.6 * GB, 61.1 * GB) }),
    '4B · 1.6–61.1 GB · 10 downloads · 1 likes',
  );
  t('hit line, sizes asked after the list came', mt.hitLine({ repo: 'a/b', downloads: 10, likes: 1, sizes: null }, sized(GB, 2 * GB)), '1–2 GB · 10 downloads · 1 likes');
  t('size range, one unit', mt.sizeRangeText(sized(1.6 * GB, 61.1 * GB)), '1.6–61.1 GB');
  t('size range, two units', mt.sizeRangeText(sized(800e6, 3.2 * GB)), '800 MB–3.2 GB');
  t('size range, one size', mt.sizeRangeText(sized(2.7 * GB, 2.7 * GB, 1)), '2.7 GB');
  t('size range, no model we can run', mt.sizeRangeText(sized(0, 0, 0)), '');
  t('size range, unknown', [mt.sizeRangeText(null), mt.sizeRangeText(undefined)], ['', '']);
  t('hit size, Gemma E2B', mt.hitSizeText({ count: 2e9, effective: true }), '2B effective');
  t('hit size, from a checkpoint', mt.hitSizeText({ count: 179_999_981_459, effective: false }), '180B');
  t('hit size, unknown', [mt.hitSizeText(null), mt.hitSizeText(undefined)], ['', '']);
  t('fraction', mt.fraction(1, 4), 0.25);
  t('fraction, no total', mt.fraction(1, null), null);
  t('fraction, capped', mt.fraction(5, 4), 1);
  t('job line', mt.jobLine(event({}), null), '1.2 GB of 2.7 GB · 3.4 MB/s');
  t('job line, no rate yet', mt.jobLine(event({ rateBytesPerSec: null }), null), '1.2 GB of 2.7 GB');
  t(
    'job line, retry',
    mt.jobLine(event({ step: 'retry', retry: { attempt: 2, max: 6, delaySec: 5, reason: 'network' } }), null),
    'Connection lost: trying again in 5 s (try 2 of 6)',
  );
  t(
    "job line, retry after Hugging Face's limit",
    mt.jobLine(event({ step: 'retry', retry: { attempt: 1, max: 6, delaySec: 42, reason: 'rate_limited' } }), null),
    'Hugging Face is limiting downloads: trying again in 42 s (try 1 of 6)',
  );
  t('job line, verify', mt.jobLine(event({ step: 'verify' }), null), 'Checking what is already here: 1.2 GB');
  t(
    'job line, offline',
    mt.jobLine(event({ step: 'offline' }), null),
    'No network: it goes on by itself when one is back (1.2 GB here)',
  );
  const paused = { id: 'qwen', name: 'q', repo: 'r', revision: 'v', sizeBytes: 2.7 * GB, doneBytes: 1.2 * GB, startedAt: 0, jobId: null };
  t('paused line', mt.jobLine(undefined, paused), 'Paused at 1.2 GB of 2.7 GB');
  t('a finished job reads as paused', mt.jobLine(event({ finished: true, ok: false }), paused), 'Paused at 1.2 GB of 2.7 GB');
  t('tokens, under a thousand', mt.tokensText(950), '950');
  t('tokens, thousands', mt.tokensText(4096), '4.1k');
  t('tokens, tens of thousands', mt.tokensText(12_345), '12.3k');
  t('tokens, none', mt.tokensText(0), '0');
  t('reading, before the first batch', mt.readingText(0, 12_345), 'Reading prompt · 0%');
  t('reading, rounded down', mt.readingText(4096, 12_345), 'Reading prompt · 33%');
  t('reading, never 100% before the last token', mt.readingText(12_344, 12_345), 'Reading prompt · 99%');
  t('reading, never past the whole', mt.readingText(2048, 950), 'Reading prompt · 100%');
  t('reading, no whole, before the first batch', mt.readingText(0, null), 'Reading prompt');
  t('reading, no whole, with a count', mt.readingText(4096, null), 'Reading prompt · 4.1k');
  t('reading label', mt.readingLabel(4096, 12_345), 'The local model is reading the prompt: 33%, 4.1k of 12.3k tokens');
  t('reading label, never past the whole', mt.readingLabel(2048, 950), 'The local model is reading the prompt: 100%, 950 of 950 tokens');
  t('reading label, no whole', mt.readingLabel(4096, null), 'The local model is reading the prompt: 4.1k tokens so far');
  t('reading label, no count', mt.readingLabel(0, null), 'The local model is reading the prompt');

  // --- ui/models/logic/context -------------------------------------------------
  const cx = await import(src('ui/models/logic', 'context.ts'));
  t('context words', [16_384, 33_792, 262_144, 131_072, 40_000, 512, 0, NaN].map(cx.contextText), ['16k', '33k', '256k', '128k', '39k', '512', '', '']);
  t(
    'reduced: automatic and less than trained',
    cx.reducedLine(model({ servedContext: 49_152 })),
    'Context 48k of 256k: reduced so it runs well on this phone',
  );
  t('no line at the whole trained context', cx.reducedLine(model({ servedContext: 262_144 })), '');
  t('no line for a chosen context', cx.reducedLine(model({ servedContext: 65_536, contextChoice: 65_536 })), '');
  t('no line when the trained context is unknown', cx.reducedLine(model({ contextLength: null })), '');
  t('no line for a model trained for less than the floor', cx.reducedLine(model({ contextLength: 8_192, servedContext: 8_192 })), '');
  t('button, automatic', cx.contextButtonText(model({})), 'Context: auto');
  t('button, chosen', cx.contextButtonText(model({ contextChoice: 65_536 })), 'Context: 64k');
  t(
    'automatic says it follows free memory',
    cx.automaticNote(model({ autoContext: 33_792 })),
    'The most this phone can spare when the model starts, from the memory free then: 33k now.',
  );
  t(
    'automatic while its server runs says what it runs with',
    cx.automaticNote(model({ autoContext: 16_384, serving: true, servedContext: 210_944 })),
    'The most this phone can spare when the model starts, from the memory free then: running with 206k now.',
  );
  t('choose note', cx.chooseNote({ min: 16_384, max: 262_144, step: 1_024 }), 'From 16k to 256k. More context takes more RAM.');
  const r = { min: 16_384, max: 262_144, step: 1_024 };
  const odd = { min: 16_384, max: 40_000, step: 1_024 };
  const none = { min: 16_384, max: 16_384, step: 1_024 };
  t('something to choose', [cx.canChoose(r), cx.canChoose(odd), cx.canChoose(none), cx.canChoose({ min: 8_192, max: 8_192, step: 1_024 })], [true, true, false, false]);
  t('last stop', [cx.lastStop(r), cx.lastStop(odd), cx.lastStop(none)], [240, 24, 0]);
  t('contexts at stops', [0, 1, 48, 240, 241, -3, 2.6, NaN].map((i) => cx.contextAt(r, i)), [16_384, 17_408, 65_536, 262_144, 262_144, 16_384, 19_456, 16_384]);
  t('the last stop of an off-grid range is its max', [cx.contextAt(odd, 23), cx.contextAt(odd, 24)], [39_936, 40_000]);
  t('stops of contexts', [16_384, 65_536, 33_792, 33_900, 262_144, 999_999, 1].map((c) => cx.stopOf(r, c)), [0, 48, 17, 17, 240, 240, 0]);
  t('round trip', [0, 17, 48, 200, 240].map((i) => cx.stopOf(r, cx.contextAt(r, i))), [0, 17, 48, 200, 240]);
  t('max of an off-grid range round-trips', [cx.stopOf(odd, 40_000), cx.stopOf(odd, 39_936)], [24, 23]);
  t('nothing to choose: one stop', [cx.stopOf(none, 99_999), cx.contextAt(none, 5)], [0, 16_384]);
  const team = [
    { id: 'a', name: 'Main', model: 'qwen' },
    { id: 'b', name: 'Work', model: 'qwen' },
    { id: 'c', name: 'Spare', model: 'qwen' },
    { id: 'd', name: 'Other', model: 'gemma' },
    { id: 'e', name: 'Own', model: null },
  ];
  const states = { a: { state: 'ready' }, b: { state: 'starting' }, c: { state: 'stopped' }, d: { state: 'ready' }, e: { state: 'ready' } };
  t('running on the model', cx.runningOn('qwen', team, states), ['Main', 'Work']);
  t('none running', cx.runningOn('qwen', team, {}), []);
  t('restart note, one', cx.restartNote(['Main']), 'Saving restarts Main, which runs on this model.');
  t('restart note, three', cx.restartNote(['Main', 'Work', 'Spare']), 'Saving restarts Main, Work and Spare, which run on this model.');
  t('restart note, none', cx.restartNote([]), '');

  // --- ui/models/logic/errorText --------------------------------------------
  const { modelErrorText } = await import(src('ui/models/logic', 'errorText.ts'));
  t('known code', modelErrorText('exists', 'already on the phone as qwen'), 'This model is already on the phone.');
  t('internal keeps the line', modelErrorText('internal', 'boom'), 'Something went wrong on our side. (boom)');
  t(
    'internal drops the stack',
    modelErrorText('internal', '[startDownload] Cannot convert x\n\nError: Value is null\n    at startDownload (native)'),
    'Something went wrong on our side. ([startDownload] Cannot convert x)',
  );
  t('unknown code is internal', modelErrorText('weird', 'x'), 'Something went wrong on our side. (x)');
  t('prototype key is no code', modelErrorText('toString', ''), 'Something went wrong on our side.');
  t('in use by one', modelErrorText('in_use', 'Main'), 'Main runs on it. Pick another model for them first.');
  t('in use by two', modelErrorText('in_use', 'Main, Work'), 'Main, Work run on it. Pick another model for them first.');

  const { hubErrorText, waitText } = await import(src('ui/models/logic', 'errorText.ts'));
  t('wait under a minute', [waitText(40), waitText(0.2), waitText(59)], ['40 s', '1 s', '59 s']);
  t('a wait that rounds up to a minute', waitText(59.5), 'about 1 min');
  t('wait in minutes, rounded up', [waitText(60), waitText(61), waitText(284)], ['about 1 min', 'about 2 min', 'about 5 min']);
  t('a limit says how long', hubErrorText('rate_limited', 'x', 125, 'list'), 'Hugging Face is limiting requests: try again in about 3 min.');
  t('a limit on a repository too', hubErrorText('rate_limited', 'x', 30, 'repo'), 'Hugging Face is limiting requests: try again in 30 s.');
  t('a limit the Hub gave no time for', hubErrorText('rate_limited', 'x', null, 'list'), 'Hugging Face is limiting requests right now. Try again later.');
  t(
    'a refused list is the Hub refusing, not a gated model',
    hubErrorText('access_denied', 'x', null, 'list'),
    'Hugging Face refused the request: it may be blocking this network or account for a while. Try again later, or on another network.',
  );
  t(
    'a refused repository is gated or private',
    hubErrorText('access_denied', 'x', null, 'repo'),
    'This model is gated or private. Accept its terms on huggingface.co, then add a token from that account below.',
  );
  t('other codes read as before', hubErrorText('network', 'x', null, 'list'), "We couldn't reach Hugging Face. Check your connection and try again.");

  // --- ui/models/logic/choices ------------------------------------------------
  const { modelChoices, OWN_SETUP_NOTE } = await import(src('ui/models/logic', 'choices.ts'));
  const big = model({ id: 'nine', name: 'Qwen3.5 9B', ram: ram('too_big') });
  const choices = modelChoices([model({}), big], null);
  t('own setup first', choices[0], { id: null, label: "The agent's own setup", note: OWN_SETUP_NOTE, dates: null, disabled: false });
  t('a model, its line and its dates', choices[1], {
    id: 'qwen3-5-4b-q4-k-m',
    label: 'Qwen3.5 4B',
    note: '2.7 GB · Q4_K_M · 4B · 16k context · Fits this phone',
    dates: { kind: 'released', released: '2026-03', cutoff: null },
    disabled: false,
  });
  t('too big cannot be picked', choices[2].disabled, true);
  t('a chosen context past the budget can be picked', modelChoices([model({ ram: ram('over_budget') })], null)[1].disabled, false);
  t('a model without dates', modelChoices([model({ dates: null })], null)[1].dates, null);
  const gone = modelChoices([], 'deleted-model');
  t('a chosen model that is gone still shows', gone.map((c) => [c.id, c.disabled, c.dates]), [[null, false, null], ['deleted-model', true, null]]);

  // --- ui/models/logic/dates ----------------------------------------------------
  const { datesLine, monthText } = await import(src('ui/models/logic', 'dates.ts'));
  t('month', monthText('2026-03'), 'Mar 2026');
  t('month of a day', monthText('2024-09-18'), 'Sep 2024');
  t('month, December', monthText('2025-12'), 'Dec 2025');
  t('no month', [monthText(null), monthText(''), monthText('2026-13'), monthText('2026-00'), monthText('March 2026'), monthText('2026-03-02T05:46:32.000Z')], ['', '', '', '', '', '']);
  t(
    'released and trained to',
    datesLine({ kind: 'released', released: '2026-04', cutoff: '2025-01' }),
    'Released Apr 2026 · Trained to Jan 2025',
  );
  t('released, cutoff not published', datesLine({ kind: 'released', released: '2026-03', cutoff: null }), 'Released Mar 2026 · Cutoff not published');
  t('on Hugging Face since', datesLine({ kind: 'on_hub', since: '2024-09-18' }), 'On Hugging Face since Sep 2024');
  t('no dates, no line', [datesLine(null), datesLine(undefined)], ['', '']);
  t('dates that do not read are no line', [datesLine({ kind: 'released', released: 'soon', cutoff: '2025-01' }), datesLine({ kind: 'on_hub', since: '' })], ['', '']);

  // --- ui/models/logic/filters --------------------------------------------------
  const hf = await import(src('ui/models/logic', 'filters.ts'));
  const d = hf.DEFAULT_FILTERS;
  t('opens on chat models, most downloaded', d, { sort: 'downloads', size: null, license: null, chatOnly: true });
  t('each default is its picker first choice', [hf.SORT_OPTIONS[0].value, hf.SIZE_OPTIONS[0].value, hf.LICENSE_OPTIONS[0].value, hf.KIND_OPTIONS[0].value], [d.sort, d.size, d.license, d.chatOnly]);
  t('sort labels', hf.SORT_OPTIONS.map((o) => o.label), ['Most downloaded', 'Trending', 'Recently updated', 'Most liked']);
  t('labels', [hf.optionLabel(hf.SIZE_OPTIONS, '2b_to_5b'), hf.optionLabel(hf.LICENSE_OPTIONS, null), hf.optionLabel(hf.KIND_OPTIONS, false)], ['2B to 5B', 'Any license', 'All GGUF models']);
  t('sort button', [hf.sortText('downloads'), hf.sortText('likes')], ['Sort: Most downloaded', 'Sort: Most liked']);
  t('no filter on at first', [hf.activeFilters(d), hf.filtersText(d)], [[], 'Filters']);
  t('a sort is not a filter', hf.activeFilters({ ...d, sort: 'trending' }), []);
  const many = { ...d, size: 'up_to_2b', license: 'apache-2.0', chatOnly: false };
  t('the filters on, in the sheet order', hf.activeFilters(many), ['Up to 2B', 'Apache 2.0', 'All GGUF models']);
  t('Filters counts them', [hf.filtersText({ ...d, license: 'mit' }), hf.filtersText(many)], ['Filters · 1', 'Filters · 3']);
  t('Clear sets every sheet filter back, the sort stays', { ...many, sort: 'likes', ...hf.CLEARED }, { ...d, sort: 'likes' });
  t('an unknown value reads as the first choice', hf.optionLabel(hf.SORT_OPTIONS, 'newest'), 'Most downloaded');
  t('spaces around a query are the same list', hf.listKey('  qwen 4b ', d), hf.listKey('qwen 4b', d));
  t('a cleared query is the opening list', hf.listKey('   ', d), hf.listKey('', d));
  const keys = new Set([
    hf.listKey('', d),
    hf.listKey('qwen', d),
    hf.listKey('', { ...d, sort: 'trending' }),
    hf.listKey('', { ...d, size: 'up_to_2b' }),
    hf.listKey('', { ...d, license: 'mit' }),
    hf.listKey('', { ...d, chatOnly: false }),
  ]);
  t('a query or any filter is another list', keys.size, 6);

  // --- ui/env/logic: start failure text ------------------------------------------
  const { startFailureText, startFailureCode } = await import(src('ui/env/logic', 'errorText.ts'));
  t(
    'model_unavailable says why',
    startFailureText('model_unavailable', 'model_unavailable: its model (qwen) is no longer on this phone'),
    "This agent's local model can't run right now. Its model (qwen) is no longer on this phone.",
  );
  t('without a message', startFailureText('model_unavailable', null), "This agent's local model can't run right now.");
  t(
    'other codes keep their sentence',
    startFailureText('too_many_running', 'too_many_running: 3'),
    "You're at your cap for agents running at once, and none has sat idle long enough to make room. Stop one, or raise the cap in Settings → Agents & models.",
  );
  t(
    'a models cap says where to change it',
    startFailureText('too_many_models', 'too_many_models: 1'),
    "You're at your cap for local models loaded at once. Stop one on the Models page, or raise the cap in Settings → Agents & models.",
  );
  t('a models cap code from status', startFailureCode('start-failed:too_many_models'), 'too_many_models');
  t('code from status', startFailureCode('start-failed:model_unavailable'), 'model_unavailable');
  const { linuxFailureText } = await import(src('ui/env/logic', 'errorText.ts'));
  const refused = Object.assign(new Error('model_unavailable: its model (qwen) is no longer on this phone'), { code: 'model_unavailable' });
  t(
    'a creation whose model pick was refused says why',
    linuxFailureText(refused),
    "This agent's local model can't run right now. Its model (qwen) is no longer on this phone.",
  );
  t('a Linux code still reads as before', linuxFailureText({ code: 'no_space', message: 'x' }), 'Your phone is out of space. Free some up and try again.');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
