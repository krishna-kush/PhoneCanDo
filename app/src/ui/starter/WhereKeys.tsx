import { Fragment } from 'react';
import { XStack } from 'tamagui';
import PlainText from '../common/PlainText';

// A mission's way there as keys to press, one per tap from Home (my name ›
// Schedules › Add): small mono keycaps on the logo's hard amber shadow.
export default function WhereKeys({ hops }: { hops: readonly string[] }) {
  return (
    <XStack flexWrap="wrap" alignItems="center" gap="2" rowGap="2" accessibilityLabel={hops.join(', then ')}>
      {hops.map((hop, i) => (
        <Fragment key={hop}>
          {i > 0 ? (
            <PlainText fontFamily="mono" fontSize={13} color="faint">
              ›
            </PlainText>
          ) : null}
          <XStack borderWidth={1} borderColor="lineStrong" backgroundColor="panel2" paddingHorizontal="2" paddingVertical={3} boxShadow="2px 2px 0 secondary">
            <PlainText fontFamily="mono" fontSize={12} color="fg">
              {hop}
            </PlainText>
          </XStack>
        </Fragment>
      ))}
    </XStack>
  );
}
