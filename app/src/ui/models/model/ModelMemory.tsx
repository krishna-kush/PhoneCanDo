import { useState } from 'react';
import type { LocalModel } from '../../../engine/models/types';
import AppButton from '../../common/AppButton';
import { memoryButtonText } from '../logic/memory';
import MemorySetting from '../memory/MemorySetting';

// A model's context and memory: a button naming how much RAM it may use
// and how many Advanced choices are set, which opens the Memory setting in
// its place (memory/MemorySetting.tsx), its Context among them.
export default function ModelMemory({ model }: { model: LocalModel }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <MemorySetting model={model} onDone={() => setEditing(false)} />;
  return (
    <AppButton variant="secondary" onPress={() => setEditing(true)}>
      {memoryButtonText(model)}
    </AppButton>
  );
}
