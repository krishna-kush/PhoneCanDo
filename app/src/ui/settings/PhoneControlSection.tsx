import { XStack, YStack } from 'tamagui';
import AccessibilitySetup from '../accessibility/AccessibilitySetup';
import AutoOffBox from '../accessibility/auto-off/AutoOffBox';
import { useAutoOff } from '../accessibility/auto-off/useAutoOff';
import { COPY } from '../accessibility/guide';
import { useAccessibilitySteps } from '../accessibility/useAccessibilitySteps';
import AgentFace from '../common/face/AgentFace';
import PlainText from '../common/PlainText';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import Spot from '../common/spot/Spot';
import Stamp from '../common/Stamp';
import AppsRow from '../app-access/settings/AppsRow';
import LockModePicker from '../control-lock/LockModePicker';
import { useControlLock } from '../control-lock/useControlLock';
import { usePageActive } from '../nav/pageActive';
import { handsLevel, noHandsLine, noHandsStamp, PANEL_TITLE } from './phone-control/copy';
import LockRow from './phone-control/LockRow';
import StatusRow from './phone-control/StatusRow';

// Settings → Phone control, on Settings itself above the rows, as A-01's
// control panel: a key box whose first row is A-01 at the controls (how
// the keys below add up), then the two keys agents need turned before
// they see and tap the phone: Android's Accessibility switch with its
// one-time setup, and the biometric lock (control-lock/), and under them
// the Apps row (app-access/: which apps agents may use), then Auto off
// (accessibility/auto-off/: the switch turns itself off while nobody needs
// it, so bank apps open) and how often the lock asks. Each explanation
// steps aside once its key is turned: the
// Accessibility lines once the switch is on, the unlock reason once
// unlocked. Lite and play: A-01 off duty and what the build cannot do.
export default function PhoneControlSection({ channel }: { channel: string }) {
  const a11y = useAccessibilitySteps();
  const switchedOn = a11y.enabled;
  const lock = useControlLock();
  const auto = useAutoOff();
  const asks = lock.mode === 'ask';
  const open = asks ? lock.asking > 0 : lock.unlocked;
  const active = usePageActive();

  if (channel !== 'full') {
    return (
      <RowGroup title={PANEL_TITLE} barcode="phoneControl">
        <RowFrame>
          <XStack alignItems="center" gap="3">
            <AgentFace mood="asleep" size={30} still={!active} />
            <YStack flex={1} minWidth={0} gap="2">
              <PlainText fontSize={14} color="muted">
                {noHandsLine(channel)}
              </PlainText>
              <Stamp tone="secondary">{noHandsStamp(channel)}</Stamp>
            </YStack>
          </XStack>
        </RowFrame>
      </RowGroup>
    );
  }

  return (
    <>
      {switchedOn ? null : (
        <PlainText fontSize={14} color="muted">
          {COPY.why}
        </PlainText>
      )}
      <RowGroup title={PANEL_TITLE} barcode="phoneControl">
        <StatusRow
          level={handsLevel(a11y.enabled, a11y.connected, open)}
          asks={asks}
          clockedOut={!a11y.enabled && auto.turnedOff}
          still={!active}
        />
        <Spot id="settings.phone">
          <AccessibilitySetup a11y={a11y} />
        </Spot>
        {switchedOn ? null : (
          <RowFrame>
            <PlainText fontSize={13} color="muted">
              {COPY.api}
            </PlainText>
          </RowFrame>
        )}
        <LockRow lock={lock} />
        <AppsRow />
      </RowGroup>
      {auto.available ? <AutoOffBox auto={auto} /> : null}
      <LockModePicker value={lock.mode} onPick={(m) => void lock.changeMode(m)} disabled={lock.busy} />
    </>
  );
}
