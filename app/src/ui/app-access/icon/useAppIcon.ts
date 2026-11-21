// An app's launcher icon for a row or the slip (engine/appAccess.ts'
// appIcon): native draws it once into its cache as a PNG, and each
// package's answer is kept here in memory for as long as the app runs,
// so a page opened again or a list scrolled shows it at once. One ask per
// package and size, however many rows wait on it. Null while it is on its
// way and when there is none.
import { useEffect, useState } from 'react';
import { PixelRatio } from 'react-native';
import { appIcon } from '../../../engine/appAccess';

const known = new Map<string, string | null>();
const asking = new Map<string, Promise<string | null>>();

function ask(pkg: string, px: number, key: string): Promise<string | null> {
  const already = asking.get(key);
  if (already) return already;
  const next = appIcon(pkg, px).then((uri) => {
    known.set(key, uri);
    asking.delete(key);
    return uri;
  });
  asking.set(key, next);
  return next;
}

/** The icon's file:// URI at `size` dp on this screen; null while it loads or when the app has none. */
export function useAppIcon(pkg: string, size: number): string | null {
  const px = PixelRatio.getPixelSizeForLayoutSize(size);
  const key = `${pkg}@${px}`;
  const [uri, setUri] = useState<string | null>(() => known.get(key) ?? null);

  useEffect(() => {
    if (!pkg) {
      setUri(null);
      return;
    }
    if (known.has(key)) {
      setUri(known.get(key) ?? null);
      return;
    }
    let live = true;
    void ask(pkg, px, key).then((found) => {
      if (live) setUri(found);
    });
    return () => {
      live = false;
    };
  }, [pkg, px, key]);

  return uri;
}
