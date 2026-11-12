import { useEffect, useState } from 'react';
import { useBackInterceptor } from '../../nav/interceptors';
import { allPicked, keepPresent, type Picked, togglePick } from './logic/selection';

// The drawer's selection: off until a long press on an agent (picking it)
// or Select (picking none). Back, Cancel, a finished action or the drawer
// sliding shut ends it; an agent deleted meanwhile drops out of it.
// `order`: the agents' ids as the drawer lists them, kept the same array
// while they don't change.
export function useAgentSelection(order: readonly string[], shut: boolean) {
  const [on, setOn] = useState(false);
  const [picked, setPicked] = useState<Picked>([]);

  const end = () => {
    setOn(false);
    setPicked([]);
  };
  useBackInterceptor(on, end);
  useEffect(() => {
    if (shut) end();
  }, [shut]);
  useEffect(() => setPicked((p) => keepPresent(p, order)), [order]);

  return {
    on,
    picked,
    all: allPicked(picked, order),
    start: (id?: string) => {
      setOn(true);
      setPicked(id ? [id] : []);
    },
    toggle: (id: string) => setPicked((p) => togglePick(p, id, order)),
    toggleAll: () => setPicked((p) => (allPicked(p, order) ? [] : [...order])),
    end,
  };
}
