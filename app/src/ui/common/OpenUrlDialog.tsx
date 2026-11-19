import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as runner from '../../engine/runner';
import type { OpenUrlAction } from '../../engine/runner';
import DeckKeys from './actions/DeckKeys';
import PlainText from './PlainText';
import { isWebLink, urlHost, waitingLine } from './promptQueue';
import SlipDialog from './slip/SlipDialog';
import SlipField from './slip/SlipField';
import SlipFrom from './slip/SlipFrom';
import { markAnswered, useBridgePrompts } from './useBridgePrompts';

/** After its desk, on the slip. */
const ASKS = 'wants to open a link';

// An agent wants a link opened on the phone, most often a sign-in its
// program started (the kit's phonecando-open, its BROWSER). Nothing opens
// without the user: Open hands the link to Android, Copy puts it on the
// clipboard (native does it; it holds the link), Not now drops it. It shows
// when the oldest waiting prompt is a link, over whatever tab is open, as a
// permission slip from the agent: its face, then the link's site set into
// the field's edge over the whole link.
export default function OpenUrlDialog() {
  const { current, queue } = useBridgePrompts();
  const prompt = current?.kind === 'open_url' ? current : null;
  const requestId = prompt?.requestId;
  const url = prompt?.url ?? '';
  const [msg, setMsg] = useState('');

  useEffect(() => setMsg(''), [requestId]);

  function answer(action: OpenUrlAction) {
    if (!requestId) return;
    runner.resolveOpenUrl(requestId, action);
    markAnswered([requestId]);
  }

  // A copy that did not reach the clipboard keeps the dialog; the link
  // above can still be selected by hand.
  function copy() {
    if (!requestId) return;
    if (runner.resolveOpenUrl(requestId, 'copy')) markAnswered([requestId]);
    else setMsg("We couldn't copy it. Press and hold the link above to copy it.");
  }

  function open() {
    Linking.openURL(url).then(
      () => answer('open'),
      () => setMsg('No app on this phone opens this link. Copy it instead.'),
    );
  }

  function close() {
    answer('dismiss');
  }

  const note = waitingLine(queue.length - 1);

  return (
    <SlipDialog open={prompt !== null} onClose={close} slip="slipLink">
      {prompt ? <SlipFrom agentId={prompt.agentId} name={prompt.agentName} asks={ASKS} /> : null}
      <SlipField label={urlHost(url) || 'A link'} value={url} lines={6} />
      <PlainText fontSize={13} color="muted">
        Open it only if you expect it, for example a sign-in you started with this agent.
      </PlainText>
      {note ? (
        <PlainText fontSize={13} color="muted">
          {note}
        </PlainText>
      ) : null}
      {msg ? (
        <PlainText fontSize={13} color="muted">
          {msg}
        </PlainText>
      ) : null}
      <DeckKeys
        actions={[
          { label: 'Open', role: 'go', disabled: !isWebLink(url), onPress: open },
          { label: 'Copy', onPress: copy },
          { label: 'Not now', role: 'back', onPress: close },
        ]}
      />
    </SlipDialog>
  );
}
