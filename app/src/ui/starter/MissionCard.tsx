import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { isLong, type MissionId } from '../../state/logic/starter/missions';
import type { MissionMark } from '../../state/logic/starter/shift';
import AppButton from '../common/AppButton';
import ChevronIcon from '../common/ChevronIcon';
import PlainText from '../common/PlainText';
import Stamp from '../common/Stamp';
import { DONE_STAMP, NEXT, SHOW_HOW, SKIP, SKIPPED, TRY_IT, WHERE, type MissionCopy } from './copy';
import DareBox from './DareBox';
import { daresFor, rollDare } from './logic/dares';

type Props = {
  id: MissionId;
  /** Its place in the list, from 1. */
  n: number;
  copy: MissionCopy;
  mark: MissionMark | undefined;
  open: boolean;
  /** Done while the page was open: the stamp slams down. */
  fresh: boolean;
  /** The agent's machine is Linux (which dares). */
  linux: boolean;
  /** Its button is busy (New agent getting ready). */
  busy: boolean;
  onToggle: () => void;
  onGo: (dare: string | null) => void;
  onCopy: (dare: string) => void;
  onSkip: () => void;
  onTryAgain: () => void;
};

// One mission of the first shift: its number and name, and its mark (a
// DONE stamp, or "skipped" with Try it). Open, it says what it is and
// where it lives; a short one then shows the steps, its dare and its
// button at once, a long one asks first: Show me how, or Next (a skip).
// Skip is there at every step.
export default function MissionCard({
  id,
  n,
  copy,
  mark,
  open,
  fresh,
  linux,
  busy,
  onToggle,
  onGo,
  onCopy,
  onSkip,
  onTryAgain,
}: Props) {
  const [shown, setShown] = useState(false);
  const dares = copy.dares ? daresFor(copy.dares, linux) : [];
  const [dareAt, setDareAt] = useState(0);
  const [rolls, setRolls] = useState(0);
  const dare = dares.length ? dares[Math.min(dareAt, dares.length - 1)] : null;
  const asking = isLong(id) && !shown && mark !== 'done';

  const roll = () => {
    setDareAt((at) => rollDare(dares.length, at, Math.random));
    setRolls((r) => r + 1);
  };

  return (
    <YStack
      borderWidth={1}
      borderColor={open ? 'lineStrong' : 'line'}
      backgroundColor="panel"
      boxShadow={open ? '2px 2px 0 secondary' : undefined}
    >
      <XStack
        alignItems="center"
        gap="3"
        padding="3"
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${copy.title}${mark ? `, ${mark === 'done' ? DONE_STAMP : SKIPPED}` : ''}`}
      >
        <PlainText fontFamily="mono" fontSize={13} fontWeight="600" color="secondaryInk">
          {String(n).padStart(2, '0')}
        </PlainText>
        <PlainText flex={1} fontSize={16} fontWeight="600" color={mark === 'skipped' ? 'dim' : 'fg'} numberOfLines={1}>
          {copy.title}
        </PlainText>
        {mark === 'done' ? (
          <Stamp slam={fresh}>{DONE_STAMP}</Stamp>
        ) : mark === 'skipped' ? (
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="dim" textTransform="uppercase">
            {SKIPPED}
          </PlainText>
        ) : (
          <ChevronIcon size={14} dir={open ? 'down' : 'right'} />
        )}
      </XStack>

      {open ? (
        <YStack paddingHorizontal="3" paddingBottom="3" gap="3">
          <PlainText fontSize={15}>{copy.what}</PlainText>
          <YStack gap={2}>
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
              {WHERE}
            </PlainText>
            <PlainText fontFamily="mono" fontSize={13} color="muted">
              {copy.where}
            </PlainText>
          </YStack>

          {mark === 'skipped' ? (
            <XStack justifyContent="flex-end">
              <AppButton variant="secondary" onPress={onTryAgain}>
                {TRY_IT}
              </AppButton>
            </XStack>
          ) : asking ? (
            <XStack gap="2" justifyContent="flex-end" flexWrap="wrap">
              <AppButton variant="ghost" onPress={onSkip}>
                {NEXT}
              </AppButton>
              <AppButton onPress={() => setShown(true)}>{SHOW_HOW}</AppButton>
            </XStack>
          ) : (
            <>
              <YStack gap="2">
                {copy.steps.map((step, i) => (
                  <XStack key={step} gap="2">
                    <PlainText fontFamily="mono" fontSize={13} color="secondaryInk">
                      {`${i + 1}.`}
                    </PlainText>
                    <PlainText flex={1} fontSize={14} color="muted">
                      {step}
                    </PlainText>
                  </XStack>
                ))}
              </YStack>
              {copy.dares && dare ? (
                <DareBox
                  set={copy.dares}
                  dare={dare}
                  rolls={rolls}
                  onRoll={roll}
                  onCopy={copy.dares === 'hands' ? () => onCopy(dare) : undefined}
                />
              ) : null}
              <XStack gap="2" justifyContent="flex-end" flexWrap="wrap">
                {mark === 'done' ? null : (
                  <AppButton variant="ghost" onPress={onSkip}>
                    {SKIP}
                  </AppButton>
                )}
                <AppButton loading={busy} onPress={() => onGo(copy.dares === 'hands' ? null : dare)}>
                  {copy.go}
                </AppButton>
              </XStack>
            </>
          )}
        </YStack>
      ) : null}
    </YStack>
  );
}
