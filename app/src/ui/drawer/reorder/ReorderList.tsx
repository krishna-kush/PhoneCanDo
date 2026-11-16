import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { listHeight, ROW_GAP } from './logic/slots';

/** What each row's drag reads and moves, on the UI thread. */
export type ReorderShared = {
  /** The ids as they stand now; a drag moves its row in it as it goes. */
  order: SharedValue<readonly string[]>;
  /** The lifted row's id, '' when none is. */
  lifted: SharedValue<string>;
  /** Where the lifted row sat when it lifted. */
  from: SharedValue<number>;
  /** How far the finger has moved it since. */
  dy: SharedValue<number>;
  /** One row's height plus the gap. */
  slot: SharedValue<number>;
  /** Told the tallest row yet. */
  measured: (height: number) => void;
  /** Told the new order once a drag moved a row. */
  onDrop: (ids: readonly string[]) => void;
  /** Told when a row lifts and settles, so the list's scroll can hold still meanwhile. */
  onLift: (lifted: boolean) => void;
};

const ReorderContext = createContext<ReorderShared | null>(null);

export function useReorder(): ReorderShared {
  const shared = useContext(ReorderContext);
  if (!shared) throw new Error('A ReorderRow sits in a ReorderList');
  return shared;
}

type Props = {
  /** The ids in the order the rows are given. */
  ids: readonly string[];
  /** Until a row reports its height, a row is this tall. */
  rowHeight: number;
  onDrop: (ids: readonly string[]) => void;
  onLift: (lifted: boolean) => void;
  children: ReactNode;
};

// Rows that a hold lifts and a drag moves (ReorderRow): each sits at its
// place in `order`, not where React lays it out, so the order React gives
// them next (after onDrop) moves nothing on screen. Rows are one height,
// the tallest measured.
export default function ReorderList({ ids, rowHeight, onDrop, onLift, children }: Props) {
  const [rowH, setRowH] = useState(rowHeight);
  const order = useSharedValue<readonly string[]>(ids);
  const lifted = useSharedValue('');
  const from = useSharedValue(0);
  const dy = useSharedValue(0);
  const slot = useSharedValue(rowH + ROW_GAP);

  // Agents come and go (and a drop comes back as the same ids): not mid-drag.
  useEffect(() => {
    if (lifted.value === '') order.value = ids;
  }, [ids, order, lifted]);
  useEffect(() => {
    slot.value = rowH + ROW_GAP;
  }, [rowH, slot]);

  const shared = useMemo<ReorderShared>(
    () => ({
      order,
      lifted,
      from,
      dy,
      slot,
      measured: (h) => setRowH((was) => (h > was ? h : was)),
      onDrop,
      onLift,
    }),
    [order, lifted, from, dy, slot, onDrop, onLift],
  );

  return (
    <ReorderContext.Provider value={shared}>
      <View style={{ height: listHeight(ids.length, rowH) }}>{children}</View>
    </ReorderContext.Provider>
  );
}
