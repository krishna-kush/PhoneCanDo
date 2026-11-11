import { useCallback, useRef, useState } from 'react';
import { catalogUnofficialOs } from '../../../engine/linux/native';
import type { CatalogImage } from '../../../engine/linux/types';
import { useOsLogosStore } from '../../../state/osLogos';
import { linuxFailureText } from '../logic/errorText';
import { mergeTags } from '../logic/tags';

type UnofficialPages = {
  images: CatalogImage[];
  loading: boolean;
  error: string | null;
  /** Reads the next page; null once Hub has no more (or won't page further for us). */
  more: (() => void) | null;
};

// Every other unofficial OS on Docker Hub, most pulled first, a page of 100
// at a time: call `more` for the first page and each next one. Pages are
// joined without repeats (a row can move between pages while we read).
// Logos it sees are kept for the Systems list.
export function useUnofficialPages(): UnofficialPages {
  const [images, setImages] = useState<CatalogImage[]>([]);
  const [next, setNext] = useState<number | null>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(() => {
    if (busy.current || next == null) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    catalogUnofficialOs(next)
      .then((page) => {
        setImages((have) => mergeTags(have, page.images));
        setNext(page.next);
        useOsLogosStore.getState().remember(page.images);
      })
      .catch((e: unknown) => setError(linuxFailureText(e)))
      .finally(() => {
        busy.current = false;
        setLoading(false);
      });
  }, [next]);

  return { images, loading, error, more: next != null ? load : null };
}
