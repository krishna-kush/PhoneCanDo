import AppButton from '../common/AppButton';
import Note from '../env/parts/Note';
import ModelStopConfirm from './ModelStopConfirm';
import { useModelStop } from './useModelStop';

type Props = {
  modelId: string;
  name: string;
  /** The agents running on it, by name: they stop first. */
  agentNames: readonly string[];
};

// A loaded model's Stop on the Models page (the RAM warning's model rows
// lay the same Stop out their own way). With agents on it, the first tap
// asks in place, naming the agents that stop first; without any, it just
// stops.
export default function StopModelButton({ modelId, name, agentNames }: Props) {
  const stop = useModelStop(modelId, name, agentNames);
  if (stop.asking) return <ModelStopConfirm stop={stop} />;
  return (
    <>
      <AppButton variant="secondary" loading={stop.busy} onPress={stop.press}>
        Stop
      </AppButton>
      {stop.error ? <Note tone="error">{stop.error}</Note> : null}
    </>
  );
}
