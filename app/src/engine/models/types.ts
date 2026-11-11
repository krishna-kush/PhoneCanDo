// The JS contract of the phonecando-models native module (its maps:
// RecordMaps.kt, CatalogOps.kt, JobReporter.kt). Local models are GGUF
// files on the phone, served by llama-server in the runner (one server per loaded model).

export type ModelId = string;

/** Whether this phone can serve local models at all (64-bit ARM, the CPU features our build needs, 6 GB of RAM or more). */
export type ModelDevice = {
  supported: boolean;
  /** Why not, fit for the UI; null when supported. */
  reason: string | null;
  totalRamBytes: number;
  availableRamBytes: number;
  /** What one model may take: half of the phone's RAM. */
  budgetBytes: number;
};

/**
 * One model's RAM verdict on this phone: its files plus its KV cache (a Hugging Face variant: its files alone).
 * `over_budget` only for a context the user chose: it starts, but Android may stop it.
 */
export type RamCheck = {
  verdict: 'fits' | 'tight' | 'over_budget' | 'too_big' | 'unsupported';
  needBytes: number;
  budgetBytes: number;
};

/** The contexts a model may be served with, in tokens: whole steps from min, the last one max (its trained context). */
export type ContextRange = { min: number; max: number; step: number };

/** One file of a model as Hugging Face lists it. */
export type CatalogFile = { path: string; sizeBytes: number; sha256: string | null };

/**
 * When a model came out and how recent its training data is (lme's
 * ModelDates). `released` only for a model we know, with its vendor's
 * month (`YYYY-MM`) and cutoff (`YYYY-MM`, null: not published); any other
 * has the day its original repository was created on Hugging Face
 * (`YYYY-MM-DD`), which can be before its public release.
 */
export type ModelDates =
  | { kind: 'released'; released: string; cutoff: string | null }
  | { kind: 'on_hub'; since: string };

/** A model we suggest, pinned to one commit and file. */
export type SuggestedModel = {
  title: string;
  note: string;
  repo: string;
  revision: string;
  file: CatalogFile;
  sizeBytes: number;
  dates: ModelDates | null;
  ram: RamCheck;
  /** The model on the phone that is this file; null when none. */
  onPhone: ModelId | null;
  /** Its pending download; null when none. */
  downloadId: string | null;
};

/** One search result: a GGUF repository on Hugging Face. */
export type ModelHit = {
  repo: string;
  downloads: number;
  likes: number;
  pipelineTag: string | null;
  /** The day it was created on Hugging Face, `YYYY-MM-DD`. */
  createdAt: string | null;
  /** Its original model's (null: unknown, or the Hub didn't answer). */
  dates: ModelDates | null;
  /** Its size: from its name, else its original's; null when neither says (lme's ModelSizes). */
  params: ModelParams | null;
};

/** How many parameters a model has; `effective` for Gemma's E sizes ("E2B" is 2B effective). */
export type ModelParams = { count: number; effective: boolean };

/** One page of results; `next` is the cursor for nextModelsPage (it keeps the filters), null on the last page. */
export type SearchPage = { hits: ModelHit[]; next: string | null };

/** Highest first: downloads in the last 30 days, the Hub's trending score, the last commit, likes. */
export type ModelSort = 'downloads' | 'trending' | 'updated' | 'likes';

/** Parameter-count buckets by a repository's size (ModelParams); native matches them, the Hub never sees them. */
export type ModelSize = 'up_to_2b' | '2b_to_5b' | '5b_to_10b' | 'over_10b';

export type ModelLicense = 'apache-2.0' | 'mit';

/** What the Hugging Face list shows, before any query and for a search alike (lme's ModelFilters). */
export type ModelFilters = {
  sort: ModelSort;
  size: ModelSize | null;
  license: ModelLicense | null;
  /** Chat models only: no embedding, reranking, speech or image models. */
  chatOnly: boolean;
};

/** One downloadable model in a repository: a single GGUF file, or every part of a split one. */
export type ModelVariant = {
  quant: string | null;
  files: CatalogFile[];
  sizeBytes: number;
  ram: RamCheck;
  onPhone: ModelId | null;
  downloadId: string | null;
};

/** A repository at its `main` commit, with the models in it, smallest first. */
export type RepoModels = {
  repo: string;
  revision: string;
  /** The model's terms must be accepted on huggingface.co, and a token from that account set. */
  gated: boolean;
  /** Its original model's, the same for every variant. */
  dates: ModelDates | null;
  variants: ModelVariant[];
};

export type ModelSource = { kind: 'huggingface'; repo: string; revision: string } | { kind: 'imported'; fileName: string };

/** A model on the phone, ready to serve. */
export type LocalModel = {
  id: ModelId;
  /** The GGUF's own name, else the file name. */
  name: string;
  source: ModelSource;
  sizeBytes: number;
  quant: string | null;
  architecture: string;
  parameterCount: number | null;
  /** The context the model was trained for. */
  contextLength: number | null;
  /**
   * The context our server runs it with: its server's own while it runs (`serving`), else what a start would get
   * now (the chosen one, or automatic).
   */
  servedContext: number;
  /** What automatic picks now: the most the phone can spare from the memory free now, up to the trained context. */
  autoContext: number;
  /** The context the user chose; null: automatic. */
  contextChoice: number | null;
  contextRange: ContextRange;
  /** Its server runs now. */
  serving: boolean;
  addedAt: number;
  /** Saved with its download; an import's from its header's base model when we know it; else null. */
  dates: ModelDates | null;
  ram: RamCheck;
};

/** A download in flight or paused (an app restart, a cancel, a network that stayed down). */
export type ModelDownload = {
  id: string;
  name: string;
  repo: string;
  revision: string;
  sizeBytes: number;
  /** Bytes on disk, verified or not. */
  doneBytes: number;
  startedAt: number;
  /** Its running job; null while paused. */
  jobId: string | null;
};

export type ModelJobTarget = { kind: 'download' | 'import'; id: string };

/** One `phonecandoModelsProgress` event; the last one has `finished` and `ok`. */
export type ModelProgress = {
  jobId: string;
  target: ModelJobTarget;
  /** The model's name, or the picked file's. */
  label: string;
  /** `verify` re-reads what an earlier try left; `retry` waits before the next try. */
  step: 'start' | 'download' | 'verify' | 'import' | 'retry';
  done: number;
  total: number | null;
  rateBytesPerSec: number | null;
  retry: { attempt: number; max: number; delaySec: number } | null;
  finished: boolean;
  ok?: boolean;
  error: string | null;
  errorCode: ModelErrorCode | null;
};

export type ModelErrorCode =
  | 'invalid_gguf'
  | 'too_large'
  | 'bad_answer'
  | 'invalid_name'
  | 'exists'
  | 'no_space'
  | 'size_mismatch'
  | 'digest_mismatch'
  | 'network'
  | 'rate_limited'
  | 'not_found'
  | 'access_denied'
  | 'corrupt'
  | 'unsupported_device'
  | 'not_enough_memory'
  | 'server_not_ready'
  | 'cancelled'
  | 'busy'
  | 'invalid_token'
  | 'picker_unavailable'
  | 'models_unavailable'
  | 'internal';
