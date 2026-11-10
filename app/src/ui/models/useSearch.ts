import { create } from 'zustand';
import { nextModelsPage, searchModels, toModelError } from '../../engine/models/native';
import type { ModelFilters, ModelHit } from '../../engine/models/types';
import { modelErrorText } from './logic/errorText';
import { DEFAULT_FILTERS, listKey } from './logic/filters';

// The Hugging Face list on the Models page: the most downloaded chat models
// before any query, search results after one, both under the filters. Kept
// while a repository's page is open on top, so Back finds the list where it
// was.
interface SearchState {
  query: string;
  filters: ModelFilters;
  hits: ModelHit[] | null;
  /** The cursor for More; it keeps the filters. */
  next: string | null;
  /** The listKey `hits` are for; null before the first list. */
  listed: string | null;
  /** The listKey a request is loading (a first page or More); null when idle. */
  loading: string | null;
  error: string | null;
  setQuery: (query: string) => void;
  setFilters: (change: Partial<ModelFilters>) => void;
  /** The first page for the query and filters as they are now. */
  load: () => Promise<void>;
  more: () => Promise<void>;
}

// Only the newest request may write: typing fast starts several.
let latest = 0;

function errorText(e: unknown): string {
  const err = toModelError(e);
  return modelErrorText(err.code, err.message);
}

export const useSearch = create<SearchState>((set, get) => ({
  query: '',
  filters: DEFAULT_FILTERS,
  hits: null,
  next: null,
  listed: null,
  loading: null,
  error: null,

  setQuery: (query) => set({ query }),

  setFilters: (change) => set((s) => ({ filters: { ...s.filters, ...change } })),

  load: async () => {
    const mine = ++latest;
    const { query, filters } = get();
    const key = listKey(query, filters);
    set({ loading: key, error: null });
    try {
      const page = await searchModels(query.trim(), filters);
      if (mine !== latest) return;
      set({ hits: page.hits, next: page.next, listed: key, loading: null });
    } catch (e) {
      if (mine === latest) set({ loading: null, error: errorText(e) });
    }
  },

  more: async () => {
    const { next, loading, listed } = get();
    if (!next || loading != null || listed == null) return;
    const mine = ++latest;
    set({ loading: listed, error: null });
    try {
      const page = await nextModelsPage(next);
      if (mine !== latest) return;
      set((s) => ({ hits: [...(s.hits ?? []), ...page.hits], next: page.next, loading: null }));
    } catch (e) {
      if (mine === latest) set({ loading: null, error: errorText(e) });
    }
  },
}));
