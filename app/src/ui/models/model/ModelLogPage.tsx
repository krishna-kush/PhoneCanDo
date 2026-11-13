import { useMemo } from 'react';
import { useMemoryStore } from '../../../state/memory';
import { useModelsStore } from '../../../state/models';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import LogPane from '../../env/parts/LogPane';
import Note from '../../env/parts/Note';
import { SERVER_LOG_NONE, type ServerState, serverLogLine } from '../logic/serverLog';
import { useModelServerLog } from './useModelServerLog';

// A model's server log (llama-server's own output: loading the weights,
// each prompt it reads and how fast it answers), as its last start wrote
// it, filling the page and opened at its end. While its server loads or
// runs (the memory guard's reading lists it) it follows the server as it
// writes.
export default function ModelLogPage({ modelId }: { modelId: string }) {
  const model = useModelsStore((s) => s.models.find((m) => m.id === modelId));
  const up = useMemoryStore((s) => s.status.models.find((m) => m.modelId === modelId));
  const server: ServerState = up?.ready || model?.serving ? 'loaded' : up ? 'loading' : 'stopped';
  const read = useModelServerLog(modelId, server !== 'stopped');
  const lines = useMemo(() => (read.state === 'read' ? read.log.text.split('\n') : []), [read]);
  return (
    <Screen scroll={false} fabClearance={false}>
      <PageHeader kicker={model?.name ?? 'model'} title="Server log" />
      {read.state === 'reading' ? <Note>Reading the log…</Note> : null}
      {read.state === 'none' ? <Note>{SERVER_LOG_NONE}</Note> : null}
      {read.state === 'failed' ? <Note tone="error">Could not read the log.</Note> : null}
      {read.state === 'read' ? (
        <>
          <Note>{serverLogLine(read.log, server, Date.now())}</Note>
          <LogPane lines={lines} />
        </>
      ) : null}
    </Screen>
  );
}
