import { useEffect, useState } from 'react';
import { XStack } from 'tamagui';
import { checkNow } from '../../../state/flows/update/check';
import AppButton from '../../common/AppButton';
import AgentFace from '../../common/face/AgentFace';
import PlainText from '../../common/PlainText';
import { usePageActive } from '../../nav/pageActive';
import { type Channel, courierLine, type Errand } from './copy';

// How long A-01 looks about after a tap on Check; the answer itself comes
// in the update box, whenever GitHub replies.
const ERRAND_MS = 2500;

// A-01 as the courier on the porch, and (full) Check for updates: a tap
// asks GitHub and A-01 hops and looks about for a moment, then says the
// answer pops up. Shown while no newer build is known; one that is shows
// in its place (update/parts/UpdateCard).
export default function Courier({ channel }: { channel: Channel }) {
  const active = usePageActive();
  const [errand, setErrand] = useState<Errand>('idle');
  const [hops, setHops] = useState(0);

  useEffect(() => {
    if (errand !== 'running') return;
    const timer = setTimeout(() => setErrand('back'), ERRAND_MS);
    return () => clearTimeout(timer);
  }, [errand, hops]);

  const check = () => {
    setHops((n) => n + 1);
    setErrand('running');
    void checkNow();
  };

  return (
    <>
      <XStack alignItems="center" gap="3" paddingTop="2">
        <AgentFace mood={errand === 'running' ? 'busy' : 'awake'} size={28} hop={hops} still={!active} />
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase" flexShrink={1}>
          {`A-01 · ${courierLine(channel, errand)}`}
        </PlainText>
      </XStack>
      {channel === 'full' ? (
        <AppButton variant="secondary" onPress={check}>
          Check for updates
        </AppButton>
      ) : null}
    </>
  );
}
