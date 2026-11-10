// The Hugging Face list's filters on the Models page: the choices and their
// words, what the page opens on, the words of the Sort and Filters buttons
// and of the line of filters that are on, and the key a listed page is kept
// under. Pure (zero RN imports).
import type { ModelFilters, ModelLicense, ModelSize, ModelSort } from '../../../engine/models/types';

export type FilterOption<T> = { value: T; label: string };

/** What the page opens on: chat models, most downloaded in the last 30 days first. */
export const DEFAULT_FILTERS: ModelFilters = { sort: 'downloads', size: null, license: null, chatOnly: true };

export const SORT_OPTIONS: FilterOption<ModelSort>[] = [
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'trending', label: 'Trending' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'likes', label: 'Most liked' },
];

export const SIZE_OPTIONS: FilterOption<ModelSize | null>[] = [
  { value: null, label: 'Any size' },
  { value: 'up_to_2b', label: 'Up to 2B' },
  { value: '2b_to_5b', label: '2B to 5B' },
  { value: '5b_to_10b', label: '5B to 10B' },
  { value: 'over_10b', label: 'Over 10B' },
];

export const LICENSE_OPTIONS: FilterOption<ModelLicense | null>[] = [
  { value: null, label: 'Any license' },
  { value: 'apache-2.0', label: 'Apache 2.0' },
  { value: 'mit', label: 'MIT' },
];

export const KIND_OPTIONS: FilterOption<boolean>[] = [
  { value: true, label: 'Chat models only' },
  { value: false, label: 'All GGUF models' },
];

/** The filters the Filters sheet sets; sort has its own button. */
export type SheetFilters = Pick<ModelFilters, 'size' | 'license' | 'chatOnly'>;

/** What Clear sets: every sheet filter back to what the page opens on. */
export const CLEARED: SheetFilters = {
  size: DEFAULT_FILTERS.size,
  license: DEFAULT_FILTERS.license,
  chatOnly: DEFAULT_FILTERS.chatOnly,
};

/** The label of `value` among `options`; the first option's when it is not one of them. */
export function optionLabel<T>(options: FilterOption<T>[], value: T): string {
  return (options.find((o) => o.value === value) ?? options[0]).label;
}

/** "Sort: Most downloaded" */
export function sortText(sort: ModelSort): string {
  return `Sort: ${optionLabel(SORT_OPTIONS, sort)}`;
}

/** The sheet filters that are on (not what the page opens on), in the sheet's order: ["Up to 2B", "Apache 2.0"]. */
export function activeFilters(filters: ModelFilters): string[] {
  const on: string[] = [];
  if (filters.size !== CLEARED.size) on.push(optionLabel(SIZE_OPTIONS, filters.size));
  if (filters.license !== CLEARED.license) on.push(optionLabel(LICENSE_OPTIONS, filters.license));
  if (filters.chatOnly !== CLEARED.chatOnly) on.push(optionLabel(KIND_OPTIONS, filters.chatOnly));
  return on;
}

/** "Filters", or "Filters · 2" while two are on. */
export function filtersText(filters: ModelFilters): string {
  const count = activeFilters(filters).length;
  return count > 0 ? `Filters · ${count}` : 'Filters';
}

/** The query and filters a list is for: a new key needs a new first page. */
export function listKey(query: string, filters: ModelFilters): string {
  return JSON.stringify([query.trim(), filters.sort, filters.size, filters.license, filters.chatOnly]);
}
