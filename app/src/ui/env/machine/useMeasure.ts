import { useEffect, useState } from 'react';
import { imageSize } from '../../../engine/linux/native';

// The machine measured (system and home) when the page opens and again
// each time `again` changes; the record takes the new size, so the page
// reads it from the store. True while measuring. A failed measure keeps
// the size last measured.
export function useMeasure(readyImageId: string | null, again: number): boolean {
  const [measuring, setMeasuring] = useState(false);

  useEffect(() => {
    if (!readyImageId) return;
    let live = true;
    setMeasuring(true);
    imageSize(readyImageId)
      .catch(() => 0)
      .finally(() => {
        if (live) setMeasuring(false);
      });
    return () => {
      live = false;
    };
  }, [readyImageId, again]);

  return measuring;
}
