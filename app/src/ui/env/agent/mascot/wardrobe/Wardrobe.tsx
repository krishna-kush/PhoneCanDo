import { useEffect, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { EARNED, type DesignId } from '../../../../../../../mascot/designs.ts';
import type { Look } from '../../../../../../../mascot/look.ts';
import { AGENT_DESIGNS } from '../../../../../state/logic/agentLooks';
import { useStarterStore } from '../../../../../state/starter';
import { lockedLabel } from '../../../../starter/copy';
import { isEarned } from '../../../../starter/reward';
import { designNumber, LOCKED_NAME } from '../copy';
import { columnsFor, rowsOf } from '../logic/grid';
import type { ChoiceProps } from '../MascotChoice';
import HangerTile, { HangerRail } from './HangerTile';

type Props = {
  /** The width it will have, from the window, so it lays out before it is measured. */
  estimate: number;
  mascot: Look;
  onPick: (design: DesignId) => void;
  /** A locked design pressed: where it is earned. */
  onLocked: () => void;
  still: boolean;
};

/** A tile's narrowest, the room between tiles and between rails, in dp. */
const MIN_TILE = 62;
const GAP = 8;
const ROW_GAP = 14;

// The rows a phone shows before any scrolling go in with the page; the rest
// a frame later, so the page opens at once.
const FIRST_ROWS = 5;

// Every design on the rack, numbered as the site's wardrobe numbers them,
// each in the agent's own shape and colours and hung from a rail: as many
// to a row as fit its width (logic/grid.ts; the window's guess first, then
// measured), the last row padded so every tile is as wide as the rest. An
// earned design hangs last, locked until earned.
export default function Wardrobe({ estimate, mascot, onPick, onLocked, still }: Props) {
  const earned = useStarterStore((s) => s.shift.earned);
  const [width, setWidth] = useState(estimate);
  const [all, setAll] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAll(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const columns = columnsFor(width, MIN_TILE, GAP);

  const rack = [
    ...AGENT_DESIGNS.map((d) => ({ d, locked: false })),
    ...EARNED.map((d) => ({ d, locked: !isEarned(d.id, earned) })),
  ].map(({ d, locked }) => ({
    id: d.id,
    tile: {
      label: locked ? LOCKED_NAME : d.name,
      accessibilityLabel: locked ? lockedLabel(d.name) : d.name,
      number: designNumber(d.id),
      mascot: { ...mascot, design: d.id },
      selected: !locked && d.id === mascot.design,
      locked,
      still,
      onSelect: locked ? onLocked : () => onPick(d.id),
    } satisfies ChoiceProps,
  }));

  return (
    <YStack gap={ROW_GAP} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {rowsOf(rack, columns)
        .slice(0, all ? undefined : FIRST_ROWS)
        .map((row, r) => (
          <YStack key={r}>
            <HangerRail swap={mascot.swap} />
            <XStack gap={GAP}>
              {row.map(({ id, tile }) => (
                <HangerTile key={id} {...tile} />
              ))}
              {Array.from({ length: columns - row.length }, (_, i) => (
                <YStack key={`empty-${i}`} flex={1} />
              ))}
            </XStack>
          </YStack>
        ))}
    </YStack>
  );
}
