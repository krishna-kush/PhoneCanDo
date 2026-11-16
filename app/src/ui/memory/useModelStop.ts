import { useState } from 'react';
import { unloadModel } from '../../state/flows/freeMemory';
import { modelErrorText } from '../models/logic/errorText';
import { modelStopAll, modelStopConfirm } from './logic/rowText';

/**
 * A loaded model's Stop: with agents on it the first press asks in place,
 * naming the agents that stop first; without any it just stops. The state
 * behind StopModelButton and the RAM warning's model rows, which each lay
 * it out their own way.
 */
export function useModelStop(modelId: string, name: string, agentNames: readonly string[]) {
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

  return {
    /** The confirm is up: its line, Keep it and the stop-them-all button. */
    asking: asking && confirm != null,
    busy,
    error,
    /** The confirm's line; null when no agent runs on it. */
    confirm,
    /** The confirm's stop button's label. */
    allLabel: modelStopAll(agentNames.length),
    press: () => (confirm ? setAsking(true) : void stop()),
    keep: () => setAsking(false),
    stopAll: () => void stop(),
  };
}

export type ModelStop = ReturnType<typeof useModelStop>;
