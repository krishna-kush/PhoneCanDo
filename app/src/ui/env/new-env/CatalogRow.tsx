import type { CatalogImage } from '../../../engine/linux/types';
import { formatCount } from '../logic/format';
import OsLogo from '../parts/OsLogo';
import OsRow, { OS_ROW_LOGO } from './OsRow';

// One OS in Which Linux?: its Docker Hub logo, name, description and pulls.
export default function CatalogRow({ os, onPress }: { os: CatalogImage; onPress: () => void }) {
  return (
    <OsRow
      lead={<OsLogo uri={os.logoUrl} size={OS_ROW_LOGO} />}
      title={os.name}
      line={os.description || 'No description on Docker Hub.'}
      meta={os.pullCount ? `${formatCount(os.pullCount)} pulls` : undefined}
      onPress={onPress}
    />
  );
}
