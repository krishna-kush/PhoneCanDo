import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import { useStartNewAgent } from '../../env/new-agent/useStartNewAgent';
import { useHomeInFront } from '../../nav/homeInFront';
import { NO_AGENTS } from './copy';
import Dozing from './Dozing';
import HireButton from './HireButton';
import HiringSign from './HiringSign';

/** How long a boop keeps A-01 up before it dozes off again. */
const UP_MS = 2400;

// Home with every agent deleted. First launch's setup runs once ever
// (App's `setUp`), so instead of it: the empty office, NOW HIRING in its
// window (HiringSign), A-01 dozing under it (a tap wakes it with a hop for
// a moment), and a button that hires the next agent the drawer's New
// agent way.
export default function NoAgents() {
  const inFront = useHomeInFront();
  const hire = useStartNewAgent();
  const [boops, setBoops] = useState(0);
  const [up, setUp] = useState(false);

  useEffect(() => {
    if (!up) return;
    const id = setTimeout(() => setUp(false), UP_MS);
    return () => clearTimeout(id);
  }, [up, boops]);

  const boop = (n: number) => {
    setBoops(n);
    setUp(true);
  };

  return (
    <YStack flex={1} backgroundColor="bg">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}>
        <YStack gap="4" alignItems="center">
          <HiringSign still={!inFront} />
          <Dozing up={up} onBoop={boop} still={!inFront} />
          <YStack gap="2" alignItems="center">
            <PlainText fontSize={22} fontWeight="700" textAlign="center">
              {NO_AGENTS.title}
            </PlainText>
            <PlainText fontSize={15} color="muted" textAlign="center">
              {NO_AGENTS.line}
            </PlainText>
          </YStack>
          <HireButton hire={hire} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
