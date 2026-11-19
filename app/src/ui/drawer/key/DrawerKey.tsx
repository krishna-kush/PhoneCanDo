import { useEffect, useState } from 'react';
import { YStack } from 'tamagui';
import { useAppStore } from '../../../state/app';
import { HIT } from '../../common/globals';
import { useReduceMotion } from '../../common/useReduceMotion';
import { usePageActive } from '../../nav/pageActive';
import Bunks from './Bunks';
import { useBunks } from './useBunks';

// Every page's way to the drawer, first in its head (PageHeader, an agent's
// hero, a terminal's bar): three bunks, the first three agents asleep or
// awake in them (Bunks.tsx). Held, they sit up and stay up while the drawer
// it opened is open; they lie back down when it shuts. The drawer opens over
// the page, and what is picked there opens on top of it, as from Home.
// Home keeps its agent chip. [drop] moves it down, to meet a title's
// letters (PageHeader measures them, common/lettersMiddle.ts).
export default function DrawerKey({ drop = 0 }: { drop?: number }) {
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const { bunks, label } = useBunks();
  const reduce = useReduceMotion();
  const active = usePageActive();
  const [held, setHeld] = useState(false);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!drawerOpen) setOpened(false);
  }, [drawerOpen]);

  return (
    <YStack
      width={HIT.minTouch}
      height={HIT.minTouch}
      marginLeft={-12}
      top={drop}
      alignItems="center"
      justifyContent="center"
      onPressIn={() => setHeld(true)}
      onPressOut={() => setHeld(false)}
      onPress={() => {
        setOpened(true);
        setDrawerOpen(true);
      }}
      role="button"
      aria-label={label}
    >
      <Bunks bunks={bunks} up={held || (opened && drawerOpen)} still={reduce || !active} />
    </YStack>
  );
}
