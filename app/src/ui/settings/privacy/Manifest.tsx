import type { ReactNode } from 'react';
import { XStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import { ROW_GUTTER } from '../../common/rows/place';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import Stamp from '../../common/Stamp';
import { DECLARED, DECLARED_NOTE, DECLARED_TITLE, NEVER, NEVER_STAMP, NEVER_TITLE } from './copy';

// What leaves the phone, as a customs declaration: one key box of what is
// declared (each ticked in amber, under the anonymous ID) and one of what
// never crosses, each line stamped NEVER in red as the page opens.
export default function Manifest() {
  return (
    <>
      <RowGroup title={DECLARED_TITLE} barcode="privacyDeclared">
        <Line>
          <PlainText fontSize={13} color="muted">
            {DECLARED_NOTE}
          </PlainText>
        </Line>
        {DECLARED.map((item) => (
          <Line key={item}>
            <PlainText fontFamily="mono" fontSize={14} color="secondaryInk" width={16}>
              ✓
            </PlainText>
            <PlainText fontSize={15} flex={1}>
              {item}
            </PlainText>
          </Line>
        ))}
      </RowGroup>
      <RowGroup title={NEVER_TITLE} barcode="privacyNever">
        {NEVER.map((item) => (
          <Line key={item}>
            <PlainText fontSize={15} flex={1}>
              {item}
            </PlainText>
            <Stamp slam>{NEVER_STAMP}</Stamp>
          </Line>
        ))}
      </RowGroup>
    </>
  );
}

// One line of the declaration: slimmer than a row you press.
function Line({ children }: { children: ReactNode }) {
  return (
    <RowFrame bare>
      <XStack alignItems="center" gap="3" minHeight={44} paddingHorizontal={ROW_GUTTER} paddingVertical="2">
        {children}
      </XStack>
    </RowFrame>
  );
}
