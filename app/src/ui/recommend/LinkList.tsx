import { XStack, YStack } from 'tamagui';
import type { LinkStats } from '../../engine/share/stats';
import type { ShareLink } from '../../state/logic/share/list';
import PlainText from '../common/PlainText';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import Note from '../env/parts/Note';
import { LINKS_TITLE, NO_LINKS } from './copy';
import { linkLine, linkTitle, sentLabel } from './logic/funnel';
import { linkReach } from './logic/route';
import MiniRoute from './MiniRoute';

// Every link this phone (or the account) sent, newest first, as rows of
// one key box: the app it went through, what it did, when and its code,
// and at its end its own route in small, red as far as a friend got.
export default function LinkList({ links, stats }: { links: ShareLink[]; stats: Record<string, LinkStats> }) {
  const now = Date.now();
  return (
    <RowGroup title={LINKS_TITLE} barcode="shareLinks">
      {links.length === 0 ? (
        <RowFrame>
          <Note>{NO_LINKS}</Note>
        </RowFrame>
      ) : null}
      {links.map((l) => {
        const s = l.code ? stats[l.code] : undefined;
        const line = linkLine(l, s);
        return (
          <RowFrame key={l.code ?? `untracked-${l.at}`}>
            <XStack alignItems="center" gap="3" accessible accessibilityLabel={`${linkTitle(l)}, ${line}, ${sentLabel(l.at, now)}`}>
              <YStack flex={1} minWidth={0} gap={2}>
                <PlainText fontSize={16} fontWeight="600" numberOfLines={1}>
                  {linkTitle(l)}
                </PlainText>
                <PlainText fontSize={13} color={l.code ? 'muted' : 'dim'} numberOfLines={2}>
                  {line}
                </PlainText>
                <PlainText fontFamily="mono" fontSize={11} color="secondaryInk" numberOfLines={1}>
                  {l.code ? `${sentLabel(l.at, now)} · /i/${l.code}` : sentLabel(l.at, now)}
                </PlainText>
              </YStack>
              {l.code ? <MiniRoute reached={linkReach(s)} /> : null}
            </XStack>
          </RowFrame>
        );
      })}
    </RowGroup>
  );
}
