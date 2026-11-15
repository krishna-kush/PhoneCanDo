import { memo, useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { AcpItem } from '../../../engine/acp/types';
import PlainText from '../../common/PlainText';
import { thoughtLabel, toolFailed, toolStatusWord } from './logic/copy';

// One thing the agent showed in its background run: its answer
// (selectable), its thinking (closed until tapped), a tool step with its
// status, or its plan.
function RunItemRow({ item }: { item: AcpItem }) {
  switch (item.type) {
    case 'text':
      return (
        <PlainText fontSize={15} lineHeight="21px" userSelect="text">
          {item.text}
        </PlainText>
      );
    case 'thought':
      return <Thought text={item.text} />;
    case 'tool': {
      const word = toolStatusWord(item.status);
      return (
        <XStack gap="2" alignItems="baseline" borderLeftWidth={2} borderColor="line" paddingLeft="2">
          <PlainText fontFamily="mono" fontSize={13} color="fg" numberOfLines={2} flexShrink={1} flexGrow={1}>
            {item.title || item.kind || 'Tool step'}
          </PlainText>
          {word ? (
            <PlainText fontFamily="mono" fontSize={11} color={toolFailed(item.status) ? 'primary' : 'dim'} flexShrink={0}>
              {word}
            </PlainText>
          ) : null}
        </XStack>
      );
    }
    case 'plan':
      return (
        <YStack gap="1" borderWidth={1} borderColor="line" backgroundColor="panel" padding="2">
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="dim" textTransform="uppercase">
            Plan
          </PlainText>
          {item.entries.map((entry, i) => (
            <PlainText key={`${i}:${entry}`} fontSize={13} color="fg">
              {`· ${entry}`}
            </PlainText>
          ))}
        </YStack>
      );
  }
}

function Thought({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <YStack gap="1">
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <PlainText fontFamily="mono" fontSize={12} color="dim">
          {thoughtLabel(open)}
        </PlainText>
      </Pressable>
      {open ? (
        <PlainText fontSize={13} lineHeight="19px" color="muted" userSelect="text">
          {text}
        </PlainText>
      ) : null}
    </YStack>
  );
}

export default memo(RunItemRow);
