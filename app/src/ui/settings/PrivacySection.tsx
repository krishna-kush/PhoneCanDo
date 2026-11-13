import { useState } from 'react';
import { Linking } from 'react-native';
import { XStack } from 'tamagui';
import {
  forgetMe,
  PRIVACY_URL,
  resetAnonymousId,
  sendReport,
  setDevLocal,
  setTelemetryEnabled,
  setTesterDevice,
  type TelemetryOutcome,
} from '../../engine/telemetry';
import { useAppStore } from '../../state/app';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import ConfirmDialog from '../common/ConfirmDialog';
import PlainText from '../common/PlainText';
import PromptDialog from '../common/PromptDialog';
import ThumbIcon from '../common/ThumbIcon';

type Busy = 'report' | 'forget' | 'reset' | null;

// Settings → Privacy, the body of its page (pages/PrivacyPage.tsx): the
// usage-stats switch, what it sends and what it never does (and how share
// links and the optional sign-in fit in), and the user's tools (new
// anonymous id, send a report, delete my data). Reset only
// starts a new install id; Delete my data is what removes the phone's data
// from the server, so the copy never blurs the two. For our own test
// phones, a long-press on the usage-stats card reveals the tester-device
// switch; debug builds also get the local dev host switch.
export default function PrivacySection() {
  const [showTester, setShowTester] = useState(false);
  const telemetry = useAppStore((s) => s.telemetry);
  const { ready, available, enabled, tester, devLocal } = telemetry;
  const [busy, setBusy] = useState<Busy>(null);
  const idle = ready && busy === null;
  const [msg, setMsg] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [note, setNote] = useState('');
  const [confirmForget, setConfirmForget] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function run(kind: Exclude<Busy, null>, action: () => Promise<TelemetryOutcome>) {
    setBusy(kind);
    setMsg('');
    try {
      const r = await action();
      setMsg(r.message);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function submitReport() {
    const text = note;
    setReportOpen(false);
    setNote('');
    void run('report', () => sendReport(text));
  }

  function openDetails() {
    Linking.openURL(PRIVACY_URL).catch(() => setMsg(`Open ${PRIVACY_URL} in a browser.`));
  }

  if (ready && !available) {
    return (
      <PlainText fontSize={14} color="muted">
        Usage stats are not available in this build, so nothing is sent.
      </PlainText>
    );
  }

  return (
    <>
      <AppCard
        title="Share anonymous usage stats"
        subtitle={!ready ? 'Loading…' : enabled ? 'On · helps find bugs' : 'Off · nothing is sent'}
        chevron={false}
        icon={<ThumbIcon up={enabled} size={26} />}
        onLongPress={() => setShowTester((v) => !v)}
      />
      <XStack gap="2">
        <AppButton
          flex={1}
          variant={enabled ? 'primary' : 'secondary'}
          disabled={!idle}
          accessibilityState={{ selected: enabled }}
          onPress={() => {
            setMsg('');
            void setTelemetryEnabled(true);
          }}
        >
          On
        </AppButton>
        <AppButton
          flex={1}
          variant={enabled ? 'secondary' : 'primary'}
          disabled={!idle}
          accessibilityState={{ selected: !enabled }}
          onPress={() => {
            setMsg('');
            void setTelemetryEnabled(false);
          }}
        >
          Off
        </AppButton>
      </XStack>
      <PlainText fontSize={14} color="muted">
        Sent: your device type, Android and app version, crashes, engine health and how often
        features are used, under a random anonymous ID. Never sent: your chats, files, keys, or
        anything on your screen. Off stops it and deletes what has not been sent yet.
      </PlainText>
      <PlainText fontSize={14} color="muted">
        Tell a friend: each link you share carries a random code, so we can count how often it
        was opened, downloaded and installed. Never who. Links you share while this is off go out
        untracked.
      </PlainText>
      <PlainText fontSize={14} color="muted">
        Signing in with Google (Settings → Account) is optional. We keep your email, your links&apos;
        codes and a few settings (theme, extra keys, run caps) only if you sign in, and never link
        them to these usage stats.
      </PlainText>
      <AppButton
        variant="secondary"
        disabled={!idle}
        loading={busy === 'reset'}
        onPress={() => setConfirmReset(true)}
      >
        Reset anonymous ID
      </AppButton>
      <PlainText fontSize={13} color="muted">
        Starts a new install ID and drops data not sent yet. Data already sent stays linked to this
        phone; Delete my data removes it.
      </PlainText>
      <AppButton
        variant="secondary"
        disabled={!idle || !enabled}
        loading={busy === 'report'}
        onPress={() => setReportOpen(true)}
      >
        Send report
      </AppButton>
      <AppButton
        variant="danger"
        disabled={!idle}
        loading={busy === 'forget'}
        onPress={() => setConfirmForget(true)}
      >
        Delete my data
      </AppButton>
      <AppButton variant="ghost" onPress={openDetails}>
        Privacy details
      </AppButton>
      {msg ? (
        <PlainText fontSize={13} color="muted">
          {msg}
        </PlainText>
      ) : null}

      {showTester ? (
        <>
          <AppCard
            title={`Tester device: ${tester ? 'on' : 'off'}`}
            subtitle="Left out of user counts. For our own test phones."
            chevron={false}
            icon={<ThumbIcon up={tester} size={26} />}
          />
          <AppButton variant="secondary" disabled={!idle} onPress={() => void setTesterDevice(!tester)}>
            {tester ? 'Unmark tester device' : 'Mark as tester device'}
          </AppButton>
        </>
      ) : null}

      {__DEV__ ? (
        <>
          <AppCard
            title={`Send to local dev host: ${devLocal ? 'on' : 'off'}`}
            subtitle="Debug build · 127.0.0.1:8787"
            chevron={false}
            icon={<ThumbIcon up={devLocal} size={26} />}
          />
          <AppButton variant="secondary" onPress={() => void setDevLocal(!devLocal)}>
            {devLocal ? 'Stop sending to dev host' : 'Send to local dev host'}
          </AppButton>
          <PlainText fontSize={13} color="muted">
            Debug builds send nothing unless this is on. Run pnpm -C tce dev, then adb reverse
            tcp:8787 tcp:8787.
          </PlainText>
        </>
      ) : null}

      <PromptDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Send a report"
        placeholder="What went wrong? (optional)"
        confirmLabel="Send"
        value={note}
        onChangeText={setNote}
        onConfirm={submitReport}
      />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset anonymous ID?"
        message="Starts a new install ID and drops usage data not sent yet. Data already sent stays linked to this phone; use Delete my data to remove it."
        confirmLabel="Reset"
        onConfirm={() => {
          setConfirmReset(false);
          void run('reset', resetAnonymousId);
        }}
      />
      <ConfirmDialog
        open={confirmForget}
        onClose={() => setConfirmForget(false)}
        title="Delete my data?"
        message="Deletes all usage data the server holds for this phone (every install, also from before a reset or reinstall, and what your share links counted), then turns sharing off. Your account, if you signed in, has its own Delete in Settings → Account."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmForget(false);
          void run('forget', forgetMe);
        }}
      />
    </>
  );
}
