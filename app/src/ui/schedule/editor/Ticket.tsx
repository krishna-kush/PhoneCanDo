import type { ReactNode } from 'react';
import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import KeyHead from '../../common/rows/KeyHead';
import { InRowGroup } from '../../common/rows/place';
import Stamp from '../../common/Stamp';
import { STAMP_WORDS, type StampWord, TICKET_TITLE } from '../logic/editorCopy';

type Props = {
  /** At the strip's right: Draft, or the order's number. */
  tag: string;
  /** Slammed across its foot as it is filed, sent or torn up; each new one lands again. */
  stamp: { word: StampWord; key: number } | null;
  children: ReactNode;
};

// The schedule editor as a work order handed to an agent: the site's
// figure key (a hairline box on the panel colour, its title on a strip
// with the box's barcode, YOU ARE UP) with the order's tag at the strip's
// right, then its fields (Field) with dashed rules between. As it is
// filed, sent or torn up, a big stamp slams across its foot, by the
// buttons you just pressed.
export default function Ticket({ tag, stamp, children }: Props) {
  return (
    <InRowGroup.Provider value>
      <YStack overflow="hidden" borderWidth={1} borderColor="line" backgroundColor="panel">
        <KeyHead
          title={TICKET_TITLE}
          barcode="scheduleAgent"
          trailing={
            <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.2} textTransform="uppercase" color="primary">
              {tag}
            </PlainText>
          }
        />
        <YStack marginBottom={-1}>{children}</YStack>
        {stamp ? (
          <YStack position="absolute" left={0} right={0} bottom={28} alignItems="center" pointerEvents="none">
            <YStack>
              <Stamp key={stamp.key} slam big>
                {STAMP_WORDS[stamp.word]}
              </Stamp>
            </YStack>
          </YStack>
        ) : null}
      </YStack>
    </InRowGroup.Provider>
  );
}
