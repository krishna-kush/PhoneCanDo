import { XStack, YStack } from 'tamagui';
import ChevronIcon from '../../../common/ChevronIcon';
import { HIT, useTheme } from '../../../common/globals';
import PlainText from '../../../common/PlainText';
import SectionTitle from '../../../common/SectionTitle';
import { MORE_WHAT, moreCount, spokenLabel } from '../../logic/customAgentText';
import FieldLabel from '../FieldLabel';
import Note from '../../parts/Note';
import { moreHasProblem, moreSetCount } from '../logic/moreSettings';
import MessageFields from './more/MessageFields';
import PackageFields from './more/PackageFields';
import RunFields from './more/RunFields';
import RuntimeFields from './more/RuntimeFields';
import VersionFields from './more/VersionFields';
import type { FormKit } from './types';

type Props = { k: FormKit; open: boolean; onOpen: (open: boolean) => void };

// Everything expert, folded, all optional. Its head is an expand control,
// not one more option: a plain row across the page, no box, "More settings
// · optional", how many are set and a chevron (down closed, up open), with
// what is in it under while closed. A tap opens it, or a problem on a field
// in it (the form's shell opens it then). Its fields keep their values
// while closed.
export default function MoreSettings({ k, open, onOpen }: Props) {
  const t = useTheme();
  const count = moreCount(moreSetCount(k.form));
  const spoken = [spokenLabel('More settings', 'optional'), count, open ? '' : MORE_WHAT].filter((s) => s !== '').join(', ');
  return (
    <YStack gap="3">
      <YStack
        minHeight={HIT.buttonH}
        justifyContent="center"
        gap="1"
        paddingVertical="2"
        opacity="press:0.7"
        onPress={() => onOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={spoken}
      >
        <XStack alignItems="center" gap="3">
          <YStack flex={1} minWidth={0}>
            <FieldLabel label="More settings" tag="optional" size={16} />
          </YStack>
          {count !== '' ? (
            <PlainText fontFamily="mono" fontSize={12} color="dim">
              {count}
            </PlainText>
          ) : null}
          <YStack rotate={open ? '180deg' : '0deg'}>
            <ChevronIcon dir="down" size={14} color={t.dim} />
          </YStack>
        </XStack>
        {!open ? (
          <PlainText fontSize={13} color="dim">
            {MORE_WHAT}
          </PlainText>
        ) : null}
      </YStack>
      {!open && moreHasProblem(k.problems) ? <Note tone="error">Something in More settings needs a fix.</Note> : null}
      {open ? (
        <>
          <SectionTitle>Install</SectionTitle>
          <PackageFields k={k} />
          <RuntimeFields k={k} />
          <VersionFields k={k} />
          <SectionTitle>While it runs</SectionTitle>
          <RunFields k={k} />
          <SectionTitle>Messages from other agents</SectionTitle>
          <MessageFields k={k} />
        </>
      ) : null}
    </YStack>
  );
}
