import { useCallback, useEffect, useRef, useState } from 'react';
import { catalogTags } from '../../../engine/linux/native';
import type { CatalogTag } from '../../../engine/linux/types';
import AppButton from '../../common/AppButton';
import AppCard from '../../common/AppCard';
import AppInput from '../../common/AppInput';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { useSlidInList } from '../../nav/slidIn';
import { useAppStore } from '../../../state/app';
import type { AgentPick } from '../../../state/flows/logic/modelStep';
import { linuxErrorText, linuxFailureText } from '../logic/errorText';
import { formatAgo, formatBytes } from '../logic/format';
import { EMPTY_PAGES_TO_SKIP, mergeTags, rankTags } from '../logic/tags';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';

const SEARCH_DELAY_MS = 400;

// Versions drawn as the page opens; the rest come once it has slid in.
const FIRST_SCREEN_CARDS = 8;

// Download another Linux, step 2: which version. Native lists only tags with an arm64
// build (the rest would fail on this phone); the usual ones (latest, plain
// version numbers) come first. The search box asks the registry, not just
// the loaded pages. A page can hold no arm64 tag at all, so a few such pages
// are read on our own before "Load more".
export default function TagPicker({ repo, pick }: { repo: string; pick?: AgentPick }) {
  const push = useAppStore((s) => s.push);
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<CatalogTag[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the newest request may write: typing fast starts several.
  const request = useRef(0);

  const fetchPages = useCallback(
    async (page: number, q: string, append: boolean) => {
      const mine = ++request.current;
      setLoading(true);
      setError(null);
      try {
        let found: CatalogTag[] = [];
        let more: number | null = page;
        for (let read = 0; more != null && found.length === 0 && read < EMPTY_PAGES_TO_SKIP; read++) {
          const res = await catalogTags(repo, more, q || undefined);
          if (mine !== request.current) return;
          found = res.tags;
          more = res.next;
        }
        setTags((have) => (append ? mergeTags(have, found) : found));
        setNext(more);
      } catch (e) {
        if (mine === request.current) setError(linuxFailureText(e));
      } finally {
        if (mine === request.current) setLoading(false);
      }
    },
    [repo],
  );

  useEffect(() => {
    const timer = setTimeout(() => void fetchPages(1, query.trim(), false), query ? SEARCH_DELAY_MS : 0);
    return () => clearTimeout(timer);
  }, [fetchPages, query]);

  const ranked = rankTags(tags);
  const shown = useSlidInList(ranked, FIRST_SCREEN_CARDS);
  const now = Date.now();
  const q = query.trim();
  let empty: string | null = null;
  if (!loading && !error && ranked.length === 0) {
    if (q) empty = `No arm64 version matches “${q}”.`;
    else if (next == null) empty = linuxErrorText('no_arm64');
    else empty = 'No arm64 versions on the first pages yet.';
  }

  return (
    <Screen>
      <PageHeader kicker={pick ? 'new agent · version' : 'add system · version'} title={repo} />
      <AppInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search versions, e.g. 3.22"
        autoCorrect={false}
        returnKeyType="search"
      />
      {shown.map((tag) => (
        <AppCard
          key={tag.name}
          title={tag.name}
          subtitle={[tag.sizeArm64 != null ? formatBytes(tag.sizeArm64) : null, formatAgo(tag.lastUpdated, now)]
            .filter(Boolean)
            .join(' · ')}
          onPress={() =>
            push({
              name: 'new-env-confirm',
              repo,
              tag: { name: tag.name, sizeArm64: tag.sizeArm64, lastUpdated: tag.lastUpdated },
              typed: false,
              pick,
            })
          }
        />
      ))}
      {loading ? <ProgressBar label="Loading versions" fraction={null} /> : null}
      {error ? (
        <>
          <Note tone="error">{error}</Note>
          <AppButton variant="secondary" onPress={() => void fetchPages(1, q, false)}>
            Try again
          </AppButton>
        </>
      ) : null}
      {empty ? <Note>{empty}</Note> : null}
      {!loading && !error && next != null ? (
        <AppButton variant="secondary" onPress={() => void fetchPages(next, q, true)}>
          Load more
        </AppButton>
      ) : null}
    </Screen>
  );
}
