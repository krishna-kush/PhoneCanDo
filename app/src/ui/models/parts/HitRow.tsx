import { View } from 'react-native';
import type { ModelHit } from '../../../engine/models/types';
import AppCard from '../../common/AppCard';
import { useSeenOnce } from '../../common/viewport/useSeenOnce';
import { hitLine } from '../logic/modelText';
import { useRepoSizes } from '../useRepoSizes';
import DatesLine from './DatesLine';

type Props = { hit: ModelHit; onOpen: (repo: string) => void };

// One Hugging Face repository in the list: its name, its size and its
// models' download sizes, downloads and likes, then its dates. The download
// sizes come with the list when native has them, else are asked for the
// first time the row comes into view, so rows never scrolled to ask nothing.
export default function HitRow({ hit, onOpen }: Props) {
  const sizes = useRepoSizes((s) => s.sizes[hit.repo]) ?? hit.sizes;
  const seen = useSeenOnce(() => {
    if (!sizes) useRepoSizes.getState().ask(hit.repo);
  });
  return (
    <View ref={seen.ref} onLayout={seen.onLayout} collapsable={false}>
      <AppCard title={hit.repo} subtitle={hitLine(hit, sizes)} onPress={() => onOpen(hit.repo)}>
        <DatesLine dates={hit.dates} />
      </AppCard>
    </View>
  );
}
