import { useState } from 'react';
import { YStack } from 'tamagui';
import { catalogCommunityOs } from '../../../engine/linux/native';
import type { CatalogImage } from '../../../engine/linux/types';
import { useOsLogosStore } from '../../../state/osLogos';
import AppButton from '../../common/AppButton';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import { linuxFailureText } from '../logic/errorText';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';
import CatalogRow from './CatalogRow';
import { useUnofficialPages } from './useUnofficialPages';

// The end of Which Linux?: a button that adds the unofficial systems after
// the official ones. First the ones that matter, a short list we keep (Kali,
// Parrot, openSUSE, Arch Linux ARM…); then every other unofficial OS Docker
// Hub has with an arm64 build, most pulled first, 100 at a time. Each list
// is a key box whose first row says what it holds.
export default function UnofficialSystems({ onPick }: { onPick: (repo: string) => void }) {
  const [shown, setShown] = useState(false);
  const [curated, setCurated] = useState<CatalogImage[] | null>(null);
  const [curatedError, setCuratedError] = useState<string | null>(null);
  const hub = useUnofficialPages();

  const loadCurated = () => {
    setCuratedError(null);
    setCurated(null);
    catalogCommunityOs()
      .then((found) => {
        setCurated(found);
        useOsLogosStore.getState().remember(found);
      })
      .catch((e: unknown) => setCuratedError(linuxFailureText(e)));
  };

  if (!shown) {
    return (
      <AppButton
        variant="secondary"
        onPress={() => {
          setShown(true);
          loadCurated();
          hub.more?.();
        }}
      >
        Show unofficial systems too
      </AppButton>
    );
  }

  return (
    <>
      <RowGroup title="Unofficial systems" barcode="unofficialSystems">
        <RowFrame>
          <Note>
            Made by each distribution's own project or community, not Docker's official library. Most work as they are; a
            few may need a fix by hand.
          </Note>
        </RowFrame>
        {curatedError ? (
          <RowFrame>
            <YStack gap="2">
              <Note tone="error">{curatedError}</Note>
              <AppButton variant="secondary" onPress={loadCurated}>
                Try again
              </AppButton>
            </YStack>
          </RowFrame>
        ) : curated == null ? (
          <RowFrame>
            <ProgressBar label="Loading the list" fraction={null} />
          </RowFrame>
        ) : (
          curated.map((os) => <CatalogRow key={os.name} os={os} onPress={() => onPick(os.name)} />)
        )}
      </RowGroup>

      <RowGroup title="More on Docker Hub" barcode="dockerHub">
        <RowFrame>
          <Note>
            Everything else Docker Hub files under operating systems with an arm64 build, most pulled first. Many are apps
            or desktops built on a system rather than a plain one.
          </Note>
        </RowFrame>
        {hub.images.map((os) => (
          <CatalogRow key={os.name} os={os} onPress={() => onPick(os.name)} />
        ))}
        {hub.error ? (
          <RowFrame>
            <Note tone="error">{hub.error}</Note>
          </RowFrame>
        ) : null}
        {hub.loading ? (
          <RowFrame>
            <ProgressBar label="Loading the list" fraction={null} />
          </RowFrame>
        ) : null}
      </RowGroup>
      {!hub.loading && hub.more ? (
        <AppButton variant="secondary" onPress={hub.more}>
          {hub.error ? 'Try again' : hub.images.length === 0 ? 'Load the list' : 'Load more'}
        </AppButton>
      ) : null}
      {!hub.loading && !hub.more && !hub.error ? <Note>That's as far as Docker Hub's list goes for us.</Note> : null}
    </>
  );
}
