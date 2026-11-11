import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { confirmUser } from '../../engine/auth';
import * as runner from '../../engine/runner';
import { track } from '../../engine/telemetry';
import AccessibilitySetup from '../accessibility/AccessibilitySetup';
import { COPY } from '../accessibility/guide';
import { useAccessibilitySteps } from '../accessibility/useAccessibilitySteps';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import PlainText from '../common/PlainText';
import SectionTitle from '../common/SectionTitle';
import ThumbIcon from '../common/ThumbIcon';
import AfterSlide from '../nav/AfterSlide';
import { usePageActive } from '../nav/pageActive';

const runnerAvailable = runner.isRunnerAvailable();

// Under the lock button while phone control is locked; nothing once unlocked.
const UNLOCK_WHY =
  "Why unlock? It's your yes: the agent can see and tap your phone only while it's unlocked, and it locks again when you say so or PhoneCanDo restarts.";

// Settings → Phone control. Full: what it is for, the one-time Accessibility
// setup, then the biometric lock that gates every session. Each explanation
// steps aside once its key is turned: the Accessibility lines once the switch
// is on, the unlock reason once unlocked. Lite and play: what the build
// cannot do.
export default function PhoneControlSection({ channel }: { channel: string }) {
  const inFront = usePageActive();
  const a11y = useAccessibilitySteps();
  const switchedOn = a11y.enabled;
  const [unlocked, setUnlocked] = useState(false);
  const [trustMsg, setTrustMsg] = useState('');

  useEffect(() => {
    if (!runnerAvailable) return;
    const sync = () => setUnlocked(runner.isAutomationEnabled());
    sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, []);

  // The in-chat unlock modal can flip the gate while Settings stays mounted
  // under another page; re-read when it is in front again.
  useEffect(() => {
    if (runnerAvailable && inFront) setUnlocked(runner.isAutomationEnabled());
  }, [inFront]);

  async function toggleLock() {
    if (!runnerAvailable) return;
    if (unlocked) {
      runner.setAutomationEnabled(false);
      setUnlocked(false);
      // The unlock reason reappears under the button; no extra line needed.
      setTrustMsg('');
      return;
    }
    try {
      if (!(await confirmUser('Unlock phone control'))) {
        setTrustMsg('Not unlocked.');
        return;
      }
      const ok = runner.setAutomationEnabled(true);
      setUnlocked(ok);
      if (ok) track('control.unlock');
      // Unlocked shows no text under the button; only a failure explains itself.
      setTrustMsg(ok ? '' : 'This install has no phone-control driver; rebuild the app.');
    } catch (e) {
      setTrustMsg(`Biometric error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (channel !== 'full') {
    return (
      <>
        <SectionTitle>Phone control</SectionTitle>
        <PlainText fontSize={14} color="muted">
          This {channel} build has no screen automation. Notifications, clipboard, and opening
          links still work.
        </PlainText>
      </>
    );
  }

  return (
    <>
      <SectionTitle>Phone control</SectionTitle>
      {switchedOn ? null : (
        <PlainText fontSize={14} color="muted">
          {COPY.why}
        </PlainText>
      )}
      <AccessibilitySetup a11y={a11y} />
      {/* Below a phone's first screen (SettingsScreen.tsx). */}
      <AfterSlide>
        {switchedOn ? null : (
          <PlainText fontSize={13} color="muted">
            {COPY.api}
          </PlainText>
        )}
        <AppCard
          title={unlocked ? 'Unlocked' : 'Locked'}
          subtitle={
            unlocked
              ? 'The agent can act on the phone until you lock it or PhoneCanDo restarts.'
              : 'Biometric unlock is required before the agent can act on the phone.'
          }
          chevron={false}
          icon={<ThumbIcon up={unlocked} size={26} />}
        />
        <AppButton onPress={toggleLock}>
          {unlocked ? 'Lock phone control' : 'Unlock with biometrics'}
        </AppButton>
        {trustMsg ? (
          <PlainText fontSize={13} color="muted">
            {trustMsg}
          </PlainText>
        ) : null}
        {unlocked ? null : (
          <PlainText fontSize={13} color="muted">
            {UNLOCK_WHY}
          </PlainText>
        )}
      </AfterSlide>
    </>
  );
}
