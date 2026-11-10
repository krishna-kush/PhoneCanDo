import { Text } from 'tamagui';
import type { ModelDates } from '../../../engine/models/types';
import { useTheme } from '../../common/globals';
import { datesLine } from '../logic/dates';

// A model's release and training-data dates, one short line under its
// details (model panels, choice rows, search results); nothing when we have
// none.
export default function DatesLine({ dates }: { dates: ModelDates | null | undefined }) {
  const t = useTheme();
  const line = datesLine(dates);
  if (!line) return null;
  return (
    <Text fontSize={13} color={t.dim} numberOfLines={2}>
      {line}
    </Text>
  );
}
