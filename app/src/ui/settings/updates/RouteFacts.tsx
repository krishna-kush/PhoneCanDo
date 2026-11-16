import FieldLine from '../../common/FieldLine';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import { type Channel, routeFields } from './copy';

// How a new build reaches you, as a key box: where it comes from, when we
// look, and who installs it.
export default function RouteFacts({ channel }: { channel: Channel }) {
  return (
    <RowGroup title="How a new build reaches you" barcode="buildRoute">
      {routeFields(channel).map((f) => (
        <RowFrame key={f.term}>
          <FieldLine term={f.term} value={f.value} lines={2} />
        </RowFrame>
      ))}
    </RowGroup>
  );
}
