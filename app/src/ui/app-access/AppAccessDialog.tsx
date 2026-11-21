import { useEffect, useState } from 'react';
import { type AppAnswer, resolveAppAccess, setAppAccess } from '../../engine/appAccess';
import { confirmUser } from '../../engine/auth';
import { errorMessage } from '../../engine/errors/message';
import { useAppAccessStore } from '../../state/appAccess';
import DeckKeys from '../common/actions/DeckKeys';
import PlainText from '../common/PlainText';
import { waitingLine } from '../common/promptQueue';
import SlipDialog from '../common/slip/SlipDialog';
import SlipField from '../common/slip/SlipField';
import SlipFrom from '../common/slip/SlipFrom';
import { isWaiting, markAnswered, pendingAppIds, useBridgePrompts } from '../common/useBridgePrompts';
import {
  ALLOW_ALL_TURNED_OFF,
  ALWAYS_LINE,
  ALWAYS_REFUSED,
  ANSWER_FAILED,
  alwaysAuthTitle,
  appName,
  ASKS,
  biometricError,
  blockAuthTitle,
  justNowLine,
  KEY_ALWAYS,
  KEY_NO,
  KEY_OK,
  KEY_ONCE,
  NO_LINE,
  NO_SCREEN_LOCK_LINE,
  NOT_CONFIRMED_SLIP,
  questionLine,
} from './copy';
import AppIcon from './icon/AppIcon';
import { needsConfirm, strongConfirm } from './logic/choices';

// The first time agents reach an app, the bridge holds the agent's request
// and asks here, over whatever page is open, as a permission slip from the
// agent: its face, the app by name and package beside its own icon, and
// what each answer does. Always is saved for every agent and signed
// natively by a key that signs only right after your fingerprint or screen
// lock, so it confirms first (as the phone-control unlock does) and stays
// on the slip, saying so, when that did not take. Just now is this
// agent's alone, until it hands the phone back; No blocks the app for
// every agent. Always and No settle the other agents' questions about the
// same app too (native ends their wait). While Allow all apps is on (a
// question still up as it was turned on), No asks for the fingerprint
// first, as its signature covers the blocked list, and blocks whatever
// comes back; unconfirmed, native turns Allow all off and a notice says so
// once the slip has gone. Back puts the slip away unanswered: the agent's
// wait runs out and it hears no answer. Mounted once, with the other
// prompt dialogs.
export default function AppAccessDialog() {
  const { current, queue } = useBridgePrompts();
  const prompt = current?.kind === 'app' ? current : null;
  /** The answer waiting on a fingerprint prompt, if any. */
  const [working, setWorking] = useState<'always' | 'no' | null>(null);
  const busy = working !== null;
  const [msg, setMsg] = useState('');
  /** Said after an answer, in the slip's place, until OK. */
  const [notice, setNotice] = useState<string | null>(null);
  const requestId = prompt?.requestId;
  const pkg = prompt?.package ?? '';
  const app = appName(prompt?.label, pkg);

  useEffect(() => setMsg(''), [requestId]);

  // True once the answer took. A question that ran out just as you answered
  // still keeps a saved answer (Always, No); Just now has no one left to let in.
  function answer(a: AppAnswer): boolean {
    if (!requestId) return false;
    let ok = resolveAppAccess(requestId, a);
    if (!ok && !isWaiting(requestId)) ok = a === 'once' || !pkg || setAppAccess(pkg, a === 'always' ? 'always' : 'blocked');
    if (!ok) return false;
    markAnswered(a === 'once' || !pkg ? [requestId] : [requestId, ...pendingAppIds(pkg)]);
    useAppAccessStore.getState().refresh();
    return true;
  }

  async function always() {
    if (!requestId) return;
    setWorking('always');
    setMsg('');
    try {
      // Native signs Always only after a fingerprint or the screen lock.
      const auth = await confirmUser(alwaysAuthTitle(app), { strong: true });
      if (auth === 'no_screen_lock') setMsg(NO_SCREEN_LOCK_LINE);
      else if (auth !== 'passed') setMsg(NOT_CONFIRMED_SLIP);
      else if (!answer('always')) setMsg(ALWAYS_REFUSED);
    } catch (e) {
      setMsg(biometricError(errorMessage(e)));
    } finally {
      setWorking(null);
    }
  }

  function once() {
    if (busy) return;
    setMsg('');
    if (!answer('once')) setMsg(ANSWER_FAILED);
  }

  async function no() {
    if (busy) return;
    setWorking('no');
    setMsg('');
    try {
      useAppAccessStore.getState().refresh();
      const all = useAppAccessStore.getState().allowAll;
      if (needsConfirm('none', 'blocked', all)) {
        // Asked so Allow all can stay on; the block never waits on it.
        await confirmUser(blockAuthTitle(app), { strong: strongConfirm('none', 'blocked', all) }).catch(() => null);
      }
      if (!answer('no')) setMsg(ANSWER_FAILED);
      else if (all && !useAppAccessStore.getState().allowAll) setNotice(ALLOW_ALL_TURNED_OFF);
    } finally {
      setWorking(null);
    }
  }

  // Hidden, not answered: native drops it once the agent's wait runs out.
  function close() {
    if (busy || !requestId) return;
    markAnswered([requestId]);
  }

  const note = waitingLine(queue.length - 1);
  const agentName = prompt?.agentName ?? '';

  if (notice) {
    return (
      <SlipDialog open onClose={() => setNotice(null)}>
        <PlainText fontSize={15}>{notice}</PlainText>
        <DeckKeys actions={[{ label: KEY_OK, role: 'go', mark: null, onPress: () => setNotice(null) }]} />
      </SlipDialog>
    );
  }

  return (
    <SlipDialog open={prompt !== null} onClose={close} slip="slipApp">
      {prompt ? <SlipFrom agentId={prompt.agentId} name={agentName} asks={ASKS} /> : null}
      <PlainText fontSize={15}>{questionLine(agentName, app)}</PlainText>
      {pkg ? <SlipField label={app} value={pkg} lines={2} leading={<AppIcon pkg={pkg} size={36} />} /> : null}
      {prompt?.reason ? <SlipField label="Why" value={prompt.reason} lines={6} /> : null}
      {[ALWAYS_LINE, justNowLine(agentName), NO_LINE, note].filter((line) => line).map((line) => (
        <PlainText key={line} fontSize={13} color="muted">
          {line}
        </PlainText>
      ))}
      {msg ? (
        <PlainText fontSize={13} color="primary">
          {msg}
        </PlainText>
      ) : null}
      <DeckKeys
        actions={[
          { label: KEY_ALWAYS, role: 'go', mark: 'save', loading: working === 'always', disabled: busy, onPress: () => void always() },
          { label: KEY_ONCE, disabled: busy, onPress: once },
          { label: KEY_NO, loading: working === 'no', disabled: busy, onPress: () => void no() },
        ]}
      />
    </SlipDialog>
  );
}
