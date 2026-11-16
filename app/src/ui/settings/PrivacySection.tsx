import { useState } from 'react';
import { Linking } from 'react-native';
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
import ConfirmDialog from '../common/ConfirmDialog';
import { useTheme } from '../common/globals';
import OpenMark from '../common/OpenMark';
import PlainText from '../common/PlainText';
import PromptDialog from '../common/PromptDialog';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import SwitchRow from '../common/rows/SwitchRow';
import {
  ALSO,
  FORGET_NOTE,
  NOT_IN_BUILD,
  OFF_MEANS,
  REPORT_NOTE,
  REPORT_OFF_NOTE,
  RESET_NOTE,
  statsNote,
} from './privacy/copy';
import GuardDesk from './privacy/GuardDesk';
import Manifest from './privacy/Manifest';
import Shredder from './privacy/Shredder';
import ToolRow from './privacy/ToolRow';

type Busy = 'report' | 'forget' | 'reset' | null;

// Settings → Privacy, the body of its page (pages/PrivacyPage.tsx), as a
// customs declaration for what leaves the phone (privacy/): A-01 at the
// desk over the usage-stats switch, what goes out and what never does
// (privacy/Manifest.tsx), how share links and the optional sign-in fit in,
// and the user's tools (new anonymous id, send a report, delete my data
// through the shredder, the details). Reset only starts a new install id;
// Delete my data is what removes the phone's data from the server, so the
// copy never blurs the two. For our own test phones, a long-press on the
// desk reveals the tester-device switch; debug builds also get the local
// dev host switch.
export default function PrivacySection() {
  const t = useTheme();
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
        {NOT_IN_BUILD}
      </PlainText>
    );
  }

  return (
    <>
      <RowGroup title="Usage stats" barcode="usageStats">
        <GuardDesk ready={ready} enabled={enabled} onLongPress={() => setShowTester((v) => !v)} />
        <SwitchRow
          title="Share anonymous usage stats"
          on={enabled}
          busy={!idle}
          onToggle={() => {
            setMsg('');
            void setTelemetryEnabled(!enabled);
          }}
          note={statsNote(ready, enabled)}
          more={OFF_MEANS}
        />
      </RowGroup>

      <Manifest />

      <RowGroup title="Also on the form" barcode="privacyAlso">
        {ALSO.map((a) => (
          <RowFrame key={a.title}>
            <PlainText fontSize={16} fontWeight="500">
              {a.title}
            </PlainText>
            <PlainText fontSize={13} color="muted">
              {a.note}
            </PlainText>
          </RowFrame>
        ))}
      </RowGroup>

      <RowGroup title="Your tools" barcode="privacyTools">
        <ToolRow
          label="Reset anonymous ID"
          note={RESET_NOTE}
          disabled={!idle}
          busy={busy === 'reset'}
          onPress={() => setConfirmReset(true)}
          mark={<OpenMark opening={false} size={14} color={t.faint} />}
        />
        <ToolRow
          label="Send report"
          note={enabled ? REPORT_NOTE : REPORT_OFF_NOTE}
          disabled={!idle || !enabled}
          busy={busy === 'report'}
          onPress={() => setReportOpen(true)}
          mark={<OpenMark opening={false} size={14} color={t.faint} />}
        />
        <ToolRow
          label="Delete my data"
          note={FORGET_NOTE}
          danger
          disabled={!idle}
          busy={busy === 'forget'}
          onPress={() => setConfirmForget(true)}
          mark={<Shredder shredding={false} />}
          busyMark={<Shredder shredding />}
        />
        <ToolRow
          label="Privacy details"
          note="The whole list, on phonecando.app."
          onPress={openDetails}
          mark={<OpenMark opening={false} size={14} color={t.faint} />}
        />
      </RowGroup>
      {msg ? (
        <PlainText fontSize={13} color="muted">
          {msg}
        </PlainText>
      ) : null}

      {showTester || __DEV__ ? (
        <RowGroup title="Back room" barcode="backRoom">
          {showTester ? (
            <SwitchRow
              title="Tester device"
              on={tester}
              busy={!idle}
              onToggle={() => void setTesterDevice(!tester)}
              note="Left out of user counts. For our own test phones."
            />
          ) : null}
          {__DEV__ ? (
            <SwitchRow
              title="Send to local dev host"
              on={devLocal}
              onToggle={() => void setDevLocal(!devLocal)}
              note="Debug build · 127.0.0.1:8787"
              more="Debug builds send nothing unless this is on. Run pnpm -C tce dev, then adb reverse tcp:8787 tcp:8787."
            />
          ) : null}
        </RowGroup>
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
