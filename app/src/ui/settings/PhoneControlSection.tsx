import AccessibilitySetup from '../accessibility/AccessibilitySetup';
import { COPY } from '../accessibility/guide';
import { useAccessibilitySteps } from '../accessibility/useAccessibilitySteps';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import PlainText from '../common/PlainText';
import ThumbIcon from '../common/ThumbIcon';
import LockModePicker from '../control-lock/LockModePicker';
import { lockCard, UNLOCK_WHY } from '../control-lock/modes';
import { useControlLock } from '../control-lock/useControlLock';

// Settings → Phone control, on Settings itself above the rows.
// Full: what it is for, the one-time Accessibility setup, the biometric
// lock that gates the agents, then how often it asks (control-lock/). Each
// explanation steps aside once its key is turned: the Accessibility lines
// once the switch is on, the unlock reason once unlocked. In ask mode
// agents ask for themselves, so the button only locks a live unlock. Lite
// and play: what the build cannot do.
export default function PhoneControlSection({ channel }: { channel: string }) {
  const a11y = useAccessibilitySteps();
  const switchedOn = a11y.enabled;
  const lock = useControlLock();
  const asks = lock.mode === 'ask';
  const card = lockCard(lock.mode, lock.unlocked, lock.asking);
  const open = asks ? lock.asking > 0 : lock.unlocked;

  if (channel !== 'full') {
    return (
      <PlainText fontSize={14} color="muted">
        This {channel} build has no screen automation. Notifications, clipboard, and opening
        links still work.
      </PlainText>
    );
  }

  return (
    <>
      {switchedOn ? null : (
        <PlainText fontSize={14} color="muted">
          {COPY.why}
        </PlainText>
      )}
      <AccessibilitySetup a11y={a11y} />
      {switchedOn ? null : (
        <PlainText fontSize={13} color="muted">
          {COPY.api}
        </PlainText>
      )}
      <AppCard
        title={card.title}
        subtitle={card.subtitle}
        chevron={false}
        icon={<ThumbIcon up={open} size={26} />}
      />
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
      <LockModePicker value={lock.mode} onPick={(m) => void lock.changeMode(m)} disabled={lock.busy} />
    </>
  );
}
