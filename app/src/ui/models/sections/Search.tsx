import { useCallback, useEffect, useRef } from 'react';
import AppButton from '../../common/AppButton';
import AppCard from '../../common/AppCard';
import AppInput from '../../common/AppInput';
import SectionTitle from '../../common/SectionTitle';
import Note from '../../env/parts/Note';
import ProgressBar from '../../env/parts/ProgressBar';
import { listKey } from '../logic/filters';
import { hitLine } from '../logic/modelText';
import DatesLine from '../parts/DatesLine';
import HfFilters from '../parts/HfFilters';
import { useSearch } from '../useSearch';

const SEARCH_DELAY_MS = 400;

// Any GGUF model on Hugging Face. Before a query: the most downloaded chat
// models (native keeps that list for the process, so a page view asks the
// Hub once at most). Typing searches after a pause, like the Docker version
// list; clearing the field goes back. The filters apply to both, and More
// keeps them. A size filter is matched natively over a few Hub pages, so a
// page can come back empty while More can still find some. A row shows its
// size when we know it and opens its repository's models.
export default function Search({ onOpen }: { onOpen: (repo: string) => void }) {
  const { query, filters, hits, next, listed, loading, error, setQuery, setFilters, load, more } = useSearch();
  const words = query.trim();
  const key = listKey(query, filters);
  const current = listed === key;
  const typed = useRef(words);

  // Loads the list for `key` unless it is here or on its way (Back from a repository keeps it).
  const loadIfNew = useCallback(() => {
    const s = useSearch.getState();
    if (s.listed !== key && s.loading !== key) void s.load();
  }, [key]);

  useEffect(() => {
    const wait = words !== typed.current && words !== '';
    typed.current = words;
    const timer = setTimeout(loadIfNew, wait ? SEARCH_DELAY_MS : 0);
    return () => clearTimeout(timer);
  }, [loadIfNew, words]);

  return (
    <>
      <SectionTitle>Hugging Face</SectionTitle>
      <AppInput
        value={query}
        onChangeText={setQuery}
        placeholder="search GGUF models, e.g. qwen 4b"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={loadIfNew}
      />
      <HfFilters filters={filters} onChange={setFilters} />
      {current && hits?.length === 0 ? <Note>{next ? 'Nothing found yet. More looks further.' : 'Nothing found.'}</Note> : null}
      {current
        ? hits?.map((h) => (
            <AppCard key={h.repo} title={h.repo} subtitle={hitLine(h)} onPress={() => onOpen(h.repo)}>
              <DatesLine dates={h.dates} />
            </AppCard>
          ))
        : null}
      {!current && !error ? <ProgressBar label={words ? 'Searching' : 'Loading models'} fraction={null} /> : null}
      {error ? (
        <>
          <Note tone="error">{error}</Note>
          <AppButton variant="secondary" onPress={() => void (current ? more() : load())}>
            Try again
          </AppButton>
        </>
      ) : null}
      {current && next && !error ? (
        <AppButton variant="secondary" loading={loading != null} onPress={() => void more()}>
          More
        </AppButton>
      ) : null}
    </>
  );
}
