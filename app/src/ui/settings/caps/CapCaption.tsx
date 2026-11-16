import PlainText from '../../common/PlainText';
import { capChip, capName, capNote, type Cap, type CapKind } from '../logic/caps';

// Under a cap's picker: its playful name in amber mono capitals, then what
// it does in plain words.
export default function CapCaption({ kind, value }: { kind: CapKind; value: Cap }) {
  return (
    <>
      <PlainText fontFamily="mono" fontSize={12} letterSpacing={1.2} textTransform="uppercase" color="secondaryInk">
        {`${capChip(value)} · ${capName(kind, value)}`}
      </PlainText>
      <PlainText fontSize={14} color="muted">
        {capNote(kind, value)}
      </PlainText>
    </>
  );
}
