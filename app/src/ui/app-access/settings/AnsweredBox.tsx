import type { AppAccessApp } from '../../../engine/appAccess';
import PlainText from '../../common/PlainText';
import type { BarcodeId } from '../../common/rows/barcode/lines';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import GuestRow from './GuestRow';

type Props = {
  title: string;
  barcode: BarcodeId;
  apps: readonly AppAccessApp[];
  /** Said when it has none. */
  none: string;
  onOpen: (app: AppAccessApp) => void;
};

// One key box of answered apps (Always allowed, or Blocked), counted in its
// strip, each app with its own icon; a tap on one opens its pop-up.
export default function AnsweredBox({ title, barcode, apps, none, onOpen }: Props) {
  return (
    <RowGroup title={apps.length > 0 ? `${title} · ${apps.length}` : title} barcode={barcode}>
      {apps.length === 0 ? (
        <RowFrame>
          <PlainText fontSize={14} color="muted">
            {none}
          </PlainText>
        </RowFrame>
      ) : (
        apps.map((app) => <GuestRow key={app.package} app={app} onOpen={onOpen} />)
      )}
    </RowGroup>
  );
}
