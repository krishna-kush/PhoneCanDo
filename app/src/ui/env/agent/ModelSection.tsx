import { useState } from 'react';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import { chooseAgentModel } from '../../../state/flows/agentModel';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import SectionTitle from '../../common/SectionTitle';
import { reducedLine } from '../../models/logic/context';
import { HONEST_NOTE } from '../../models/logic/modelText';
import ModelPicker from '../../models/parts/ModelPicker';
import { startFailureCode, startFailureText } from '../logic/errorText';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';

// A kind that can use a local model (its `models`): which one the agent
// runs on, or its own setup, and a line when we serve that model with less
// context than it was trained for (its Context setting is on the Models
// page). A pick restarts a running agent, which loads the model first.
// Nothing for other kinds, or on a phone that cannot run local models
// (unless one is set already, so it can be unset).
export default function ModelSection({ agent }: { agent: Agent }) {
  const open = useEnvNav((s) => s.open);
  const device = useModelsStore((s) => s.device);
  const models = useModelsStore((s) => s.models);
  const [busy, setBusy] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const kind = agentKind(agent.kind);
  if (kind.models.length === 0 || (!device.supported && agent.model == null)) return null;

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
      <SectionTitle>Model</SectionTitle>
      <ModelPicker models={models} selected={agent.model} disabled={busy !== undefined} onSelect={pick} />
      {busy !== undefined ? (
        <ProgressBar label={loading ? `Switching to ${loading}: loading it can take a minute` : 'Switching'} fraction={null} />
      ) : null}
      {error ? <Note tone="error">{error}</Note> : null}
      {reduced ? <Note>{reduced}</Note> : null}
      {agent.model ? <Note>{HONEST_NOTE}</Note> : null}
      {models.length === 0 ? <Note>No models on this phone yet.</Note> : null}
      <AppButton variant="secondary" onPress={() => open({ name: 'models', agentId: agent.id })}>
        Get models
      </AppButton>
    </>
  );
}
