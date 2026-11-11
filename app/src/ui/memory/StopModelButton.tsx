import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { unloadModel } from '../../state/flows/freeMemory';
import AppButton from '../common/AppButton';
import PlainText from '../common/PlainText';
import Note from '../env/parts/Note';
import { modelErrorText } from '../models/logic/errorText';
import { modelStopAll, modelStopConfirm } from './logic/rowText';

type Props = {
  modelId: string;
  name: string;
  /** The agents running on it, by name: they stop first. */
  agentNames: readonly string[];
};

// A loaded model's Stop, in the RAM warning and on the Models page. With
// agents on it, the first tap asks in place, naming the agents that stop
// first; without any, it just stops.
export default function StopModelButton({ modelId, name, agentNames }: Props) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = modelStopConfirm(name, agentNames);

  const stop = async () => {
    setBusy(true);
    setError(null);
    const res = await unloadModel(modelId);
    setBusy(false);
    setAsking(false);
    if (!res.ok) setError(modelErrorText(res.code, res.message));
  };

  if (asking && confirm) {
    return (
      <YStack gap="2">
        <PlainText fontSize={14}>{confirm}</PlainText>
        <XStack gap="2">
          <AppButton flex={1} variant="secondary" disabled={busy} onPress={() => setAsking(false)}>
            Keep it
          </AppButton>
          <AppButton flex={1} variant="danger" loading={busy} onPress={() => void stop()}>
            {modelStopAll(agentNames.length)}
          </AppButton>
        </XStack>
      </YStack>
    );
  }

  return (
    <>
      <AppButton variant="secondary" loading={busy} onPress={() => (confirm ? setAsking(true) : void stop())}>
        Stop
      </AppButton>
      {error ? <Note tone="error">{error}</Note> : null}
    </>
  );
}
