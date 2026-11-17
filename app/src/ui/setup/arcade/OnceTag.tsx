import { XStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import { ARCADE } from '../copy';
import PopIn from './PopIn';

// Under NOW LOADING while the Linux machine unpacks, a level that plays
// only once ever (first launch never runs again: App's `setUp`): an amber
// ONCE ONLY tag, as the tip's, and its line. It pops in as the level
// starts and goes with it.
export default function OnceTag() {
  return (
    <PopIn style={{ alignSelf: 'center' }}>
      <XStack gap="2" rowGap="1" flexWrap="wrap" justifyContent="center" alignItems="center">
        <XStack backgroundColor="secondary" paddingHorizontal={5} paddingVertical={1}>
          <PlainText fontFamily="mono" fontSize={10} fontWeight="600" letterSpacing={1.2} textTransform="uppercase" color="bg">
            {ARCADE.once.tag}
          </PlainText>
        </XStack>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1} color="secondaryInk" textTransform="uppercase">
          {ARCADE.once.line}
        </PlainText>
      </XStack>
    </PopIn>
  );
}
