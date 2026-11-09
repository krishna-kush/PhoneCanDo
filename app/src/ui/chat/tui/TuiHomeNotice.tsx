import { Text, YStack } from 'tamagui';
import AppButton from '../../common/AppButton';
import LogoLoader from '../../common/LogoLoader';
import { useTheme } from '../../common/globals';
import type { TuiPhase } from './tuiPhase';

type Props = {
  /** The kind's label ("top"). */
  label: string;
  phase: Exclude<TuiPhase, { name: 'attached' }>;
  /** Starts the engine again and reattaches. */
  onRestart: () => void;
};

// What a TUI home shows while its terminal is not attached: the engine
// starting, the program stopped (Restart), or a start that failed (Retry).
// A program that ended on screen gets a bar over the foot of its last
// screen instead (over the extra keys, which have nothing to type into), so
// the screen keeps its size and stays readable.
export default function TuiHomeNotice({ label, phase, onRestart }: Props) {
  const t = useTheme();

  if (phase.name === 'starting') {
    return (
      <YStack flex={1} backgroundColor={t.bg} padding="$3" gap="$4" alignItems="center" justifyContent="center">
        <LogoLoader size={24} />
        <Text color={t.fg} fontFamily="$mono">
          Starting {label}…
        </Text>
      </YStack>
    );
  }

  const failed = phase.name === 'failed';
  const overScreen = phase.name === 'stopped' && phase.screen;
  const body = (
    <>
      <Text color={failed ? t.primary : t.fg} fontFamily="$mono">
        {failed ? `${label} could not start` : `${label} stopped`}
      </Text>
      {phase.error ? (
        <Text color={t.dim} fontFamily="$mono" fontSize={12} selectable>
          {phase.error}
        </Text>
      ) : null}
      <AppButton variant="secondary" onPress={onRestart}>
        {failed ? 'Retry' : 'Restart'}
      </AppButton>
    </>
  );

  if (overScreen) {
    return (
      <YStack
        position="absolute"
        left={0}
        right={0}
        bottom={0}
        backgroundColor={t.bg}
        borderTopWidth={1}
        borderColor={t.line}
        padding="$3"
        gap="$2"
      >
        {body}
      </YStack>
    );
  }
  return (
    <YStack flex={1} backgroundColor={t.bg} padding="$4" gap="$3" justifyContent="center">
      {body}
    </YStack>
  );
}
