import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../state/app';
import type { Route } from '../../../state/app/routes';
import { useMemoryStore } from '../../../state/memory';
import SheetScroll from '../../common/sheet/SheetScroll';
import { countdownLine } from '../logic/memoryCopy';
import { agentName } from '../logic/memoryRows';
import { ramMap } from '../logic/ramMap';
import { useCountdown } from '../useCountdown';
import { useMemoryView } from '../useMemoryView';
import { useToldLine } from '../useToldLine';
import AgentsBox from './AgentsBox';
import CountdownBox from './countdown/CountdownBox';
import EmptyBox from './EmptyBox';
import ModelsBox from './ModelsBox';
import RamFigure from './ram/RamFigure';
import SheetHead from './SheetHead';
import ToldSlip from './ToldSlip';

// The RAM warning's content, top to bottom by how soon you need it: A-01
// and the headline, the line after an automatic stop, our own countdown
// with its fuse, the phone's memory as a figure (who holds what), then the
// agents and the local models, each with its Stop. Mounted anew each
// opening, so each has its own headline.
export default function SheetBody() {
  // Each opening reads the guard now, with what each one takes: the last
  // reading it sent may be older, and between looks it carries no sizes.
  useEffect(() => {
    useMemoryStore.getState().refreshMemory();
  }, []);
  const view = useMemoryView();
  const toldLine = useToldLine();
  const { status } = view;
  const level = status.level;
  // Seen in trouble while up: back at ok, it says phew instead of all calm.
  const [sawTrouble, setSawTrouble] = useState(level !== 'ok');
  useEffect(() => {
    if (level !== 'ok') setSawTrouble(true);
  }, [level]);
  const recovered = sawTrouble && level === 'ok';

  const seconds = useCountdown(status.stopAt);
  const nextName = status.nextStopAgentId ? agentName(view.info, status.nextStopAgentId) : null;
  const countdown = countdownLine(level, seconds, nextName, view.agents.length);
  const map = useMemo(() => (view.ram ? ramMap(view.ram, view.agents, view.models) : null), [view]);
  // A row opens its agent's or model's page, the sheet going as it slides in.
  const push = useAppStore((s) => s.push);
  const closeSheet = useMemoryStore((s) => s.closeSheet);
  const open = (route: Route) => {
    closeSheet();
    push(route);
  };

  return (
    <SheetScroll contentContainerStyle={{ padding: 16, gap: 12 }}>
      <SheetHead level={level} agents={view.agents.length} recovered={recovered} />
      {toldLine ? <ToldSlip>{toldLine}</ToldSlip> : null}
      {countdown ? <CountdownBox line={countdown} level={level} seconds={seconds} stopAt={status.stopAt} /> : null}
      {view.ram && map ? (
        <RamFigure use={view.ram} map={map} level={level} warnBelowBytes={status.warnBelowBytes} nextName={nextName} />
      ) : null}
      <AgentsBox
        rows={view.agents}
        seconds={seconds}
        map={map}
        onOpen={(agentId) => open({ name: 'agent', agentId })}
      />
      <ModelsBox rows={view.models} level={level} map={map} onOpen={(modelId) => open({ name: 'model', modelId })} />
      {view.agents.length === 0 && view.models.length === 0 ? <EmptyBox /> : null}
    </SheetScroll>
  );
}
