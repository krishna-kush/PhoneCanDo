import { Image as RNImage } from 'react-native';
import type { CatalogImage } from '../../../engine/linux/types';
import AppCard from '../../common/AppCard';
import { formatCount } from '../logic/format';

// One OS in Which Linux?: its Docker Hub logo, name, description and pulls.
export default function OsCard({ os, onPress }: { os: CatalogImage; onPress: () => void }) {
  return (
    <AppCard
      title={os.name}
      subtitle={[os.description, os.pullCount ? `${formatCount(os.pullCount)} pulls` : ''].filter(Boolean).join(' · ')}
      icon={
        os.logoUrl ? (
          <RNImage source={{ uri: os.logoUrl }} style={{ width: 32, height: 32 }} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : undefined
      }
      onPress={onPress}
    />
  );
}
