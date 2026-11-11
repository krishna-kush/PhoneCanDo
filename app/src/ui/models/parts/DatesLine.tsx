import type { ModelDates } from '../../../engine/models/types';
import { datesLine } from '../logic/dates';
import PlainText from '../../common/PlainText';

// A model's release and training-data dates, one short line under its
// details (model panels, choice rows, search results); nothing when we have
// none.
export default function DatesLine({ dates }: { dates: ModelDates | null | undefined }) {
  const line = datesLine(dates);
  if (!line) return null;
  return (
    <PlainText fontSize={13} color="dim" numberOfLines={2}>
      {line}
    </PlainText>
  );
}
