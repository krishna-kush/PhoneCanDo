import { useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';
import type { ChatMode } from '../../../engine/schedule/types';
import { useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import { useReduceMotion } from '../../common/useReduceMotion';
import { chatLine, chatNote } from '../logic/editorCopy';
import { chatLabel } from '../logic/scheduleCopy';

const CHATS: readonly ChatMode[] = ['new', 'same'];

// A pop that overshoots, as a card put down on the desk.
const POP = { damping: 10, stiffness: 280 };

// The drawings, on a 28 by 32 grid: a blank sheet with its corner folded
// and a spark on it; a sheet already written on, with the one before it
// behind.
const SHEETS: Record<ChatMode, string[]> = {
  new: ['M4 2 H18 L24 8 V30 H4 Z', 'M18 2 V8 H24', 'M14 13 V21 M10 17 H18'],
  same: ['M8 5 V1.5 H26 V25.5 H22', 'M3 6 H22 V30 H3 Z', 'M7 12 H18 M7 17 H18 M7 22 H14'],
};

type Props = { value: ChatMode; onPick: (chat: ChatMode) => void };

// Which chat each run goes to, as two tiles with a little drawing each:
// a blank sheet for a fresh chat each run, a sheet already written on for
// the same chat. The picked one is red-edged on a faint red tint with its
// drawing inked red, and pops as it is picked.
export default function ChatTiles({ value, onPick }: Props) {
  return (
    <XStack gap="2" accessibilityRole="radiogroup">
      {CHATS.map((chat) => (
        <ChatTile key={chat} chat={chat} on={chat === value} onPress={() => onPick(chat)} />
      ))}
    </XStack>
  );
}

function ChatTile({ chat, on, onPress }: { chat: ChatMode; on: boolean; onPress: () => void }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const pop = useSharedValue(1);
  const was = useRef(on);

  useEffect(() => {
    if (was.current === on) return;
    was.current = on;
    if (reduce || !on) return;
    pop.value = 0.92;
    pop.value = withSpring(1, POP);
  }, [on, reduce, pop]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const ink = on ? t.primary : t.dim;

  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      <YStack
        flex={1}
        padding="3"
        gap="2"
        borderWidth={1}
        borderColor={on ? 'primary' : 'lineStrong'}
        backgroundColor={on ? 'primarySoft' : 'bg'}
        opacity="press:0.7"
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${chatLabel(chat)}. ${chatNote(chat)}`}
      >
        <Svg width={28} height={32} viewBox="0 0 28 32">
          {SHEETS[chat].map((d) => (
            <Path key={d} d={d} fill="none" stroke={ink} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </Svg>
        <PlainText fontSize={15} fontWeight="600" numberOfLines={1}>
          {chatLabel(chat)}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={11} color="dim">
          {chatLine(chat)}
        </PlainText>
      </YStack>
    </Animated.View>
  );
}
