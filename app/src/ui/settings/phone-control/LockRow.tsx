import { XStack, YStack } from 'tamagui';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';
import RowFrame from '../../common/rows/RowFrame';
import { lockCard, UNLOCK_WHY } from '../../control-lock/modes';
import type { useControlLock } from '../../control-lock/useControlLock';
import Padlock from './Padlock';

type Props = { lock: ReturnType<typeof useControlLock> };

// The panel's lock row: the padlock (its shackle springs open on unlock),
// the lock as it stands, its button and why to unlock. In ask mode agents
// ask for themselves, so the button only locks a live unlock.
export default function LockRow({ lock }: Props) {
  const asks = lock.mode === 'ask';
  const card = lockCard(lock.mode, lock.unlocked, lock.asking);
  const open = asks ? lock.asking > 0 : lock.unlocked;
  return (
    <RowFrame>
      <YStack gap="3">
        <XStack alignItems="center" gap="3">
          <Padlock open={open} />
          <YStack flex={1} minWidth={0} gap={2}>
            <PlainText fontSize={16} fontWeight="600" color={open ? 'primary' : 'fg'}>
              {card.title}
            </PlainText>
            <PlainText fontSize={13} color="muted">
              {card.subtitle}
            </PlainText>
          </YStack>
        </XStack>
        {open ? (
          <AppButton onPress={lock.lock} disabled={lock.busy}>
            {asks ? 'Lock now' : 'Lock phone control'}
          </AppButton>
        ) : asks ? null : (
          <AppButton onPress={() => void lock.unlock()} disabled={lock.busy}>
            Unlock with biometrics
          </AppButton>
        )}
        {lock.msg ? (
          <PlainText fontSize={13} color="muted">
            {lock.msg}
          </PlainText>
        ) : null}
        {open || asks ? null : (
          <PlainText fontSize={13} color="muted">
            {UNLOCK_WHY}
          </PlainText>
        )}
      </YStack>
    </RowFrame>
  );
}
