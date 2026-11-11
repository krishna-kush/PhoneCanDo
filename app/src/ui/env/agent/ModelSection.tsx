import { useState } from 'react';
import type { Agent } from '../../../engine/agents/records';
import { useAppStore } from '../../../state/app';
import { chooseAgentModel } from '../../../state/flows/agentModel';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import { reducedLine } from '../../models/logic/context';
import { HONEST_NOTE } from '../../models/logic/modelText';
import ModelPicker from '../../models/parts/ModelPicker';
import { startFailureCode, startFailureText } from '../logic/errorText';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';
import { hasModelSetting } from './agentSettings';

// The agent's model page body, for a kind that can use a local model (its
// `models`, see hasModelSetting): which one the agent runs on, or its own
// setup, and a line when we serve that model with less context than it was
// trained for (its Context setting is on the Models page). A pick restarts
// a running agent, which loads the model first.
export default function ModelSection({ agent }: { agent: Agent }) {
  const push = useAppStore((s) => s.push);
  const device = useModelsStore((s) => s.device);
  const models = useModelsStore((s) => s.models);
  const [busy, setBusy] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  if (!hasModelSetting(agent, device.supported)) return null;

  const pick = (id: string | null) => {
    if (id === agent.model || busy !== undefined) return;
    setBusy(id);
    setError(null);
    void chooseAgentModel(agent.id, id)
      .then((res) => {
        if (!res.ok) {
          setError(startFailureText(res.code, res.message));
          return;
        }
        const code = res.restart ? startFailureCode(res.restart.status) : null;
        if (code) setError(startFailureText(code, res.restart?.error));
      })
      .finally(() => setBusy(undefined));
  };

  const loading = busy !== undefined ? models.find((m) => m.id === busy)?.name : undefined;
  const current = models.find((m) => m.id === agent.model);
  const reduced = current ? reducedLine(current) : '';

  return (
    <>
      <ModelPicker models={models} selected={agent.model} disabled={busy !== undefined} onSelect={pick} />
      {busy !== undefined ? (
        <ProgressBar label={loading ? `Switching to ${loading}: loading it can take a minute` : 'Switching'} fraction={null} />
      ) : null}
      {error ? <Note tone="error">{error}</Note> : null}
      {reduced ? <Note>{reduced}</Note> : null}
      {agent.model ? <Note>{HONEST_NOTE}</Note> : null}
      {models.length === 0 ? <Note>No models on this phone yet.</Note> : null}
      <AppButton variant="secondary" onPress={() => push({ name: 'models' })}>
        Get models
      </AppButton>
    </>
  );
}

