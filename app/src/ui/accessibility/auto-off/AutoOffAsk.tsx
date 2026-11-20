import { useEffect, useState } from 'react';
import { useAutoOffStore } from '../../../state/autoOff';
import { useStarterStore } from '../../../state/starter';
import DeckKeys from '../../common/actions/DeckKeys';
import PlainText from '../../common/PlainText';
import SlipDialog from '../../common/slip/SlipDialog';
import AutoOffHead from './AutoOffHead';
import ShiftStrip from './ShiftStrip';
import { ASK_BODY, ASK_FROM, ASK_NO, ASK_TITLE, ASK_WHERE, ASK_YES, CATCH } from './copy';
import TimeCard from './TimeCard';
import { useAutoOffAsk } from './useAutoOffAsk';

// How long after it opens the card punches OUT, showing what Auto off does.
const PUNCH_AFTER_MS = 900;

// After the switch's first turn-on: A-01, sweating over the bank apps that
// won't open while it is on, offers to clock out by itself (Auto off). Its
// time card punches OUT a beat after it opens and A-01 cheers up. In the
// first shift's Give me hands walk, A-09 calls it on a note atop it (kept
// as it opened, though the walk ends under it); anywhere else it comes
// plain. Either key answers for good; Settings → Phone control changes it
// later. Mounted once over every page.
export default function AutoOffAsk() {
  const open = useAutoOffAsk();
  const [punched, setPunched] = useState(false);
  const handsWalk = useStarterStore((s) => s.walk?.mission === 'hands');
  const [keptStrip, setKeptStrip] = useState(false);
  const inShift = open && (handsWalk || keptStrip);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setPunched(true), PUNCH_AFTER_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // The walk's DONE closes by itself; the note stays until you answer.
  useEffect(() => {
    setKeptStrip(open && (handsWalk || keptStrip));
  }, [open, handsWalk, keptStrip]);

  const yes = () => useAutoOffStore.getState().set(true);
  const no = () => useAutoOffStore.getState().dropOffer();

  return (
    <SlipDialog open={open} onClose={no}>
      {inShift ? <ShiftStrip /> : null}
      <AutoOffHead mood={punched ? 'happy' : 'sweaty'} title={ASK_TITLE} caption={ASK_FROM} still={!open} />
      <PlainText fontSize={15} color="muted">
        {ASK_BODY}
      </PlainText>
      <TimeCard on={punched} />
      <PlainText fontSize={13} color="muted">
        {CATCH}
      </PlainText>
      <DeckKeys
        actions={[
          { label: ASK_YES, role: 'go', mark: 'save', onPress: yes },
          { label: ASK_NO, role: 'back', onPress: no },
        ]}
      />
      <PlainText fontSize={12} color="dim">
        {ASK_WHERE}
      </PlainText>
    </SlipDialog>
  );
}
