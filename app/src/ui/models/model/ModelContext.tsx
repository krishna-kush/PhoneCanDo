import { useState } from 'react';
import type { LocalModel } from '../../../engine/models/types';
import AppButton from '../../common/AppButton';
import ContextSetting from '../context/ContextSetting';
import { canChoose, contextButtonText } from '../logic/context';

// A model's Context: a button naming the context it gets, which opens the
// setting in its place (ContextSetting.tsx); nothing for a model with no
// choice to make.
export default function ModelContext({ model }: { model: LocalModel }) {
  const [editing, setEditing] = useState(false);
  if (!canChoose(model.contextRange) && model.contextChoice == null) return null;
  if (editing) return <ContextSetting model={model} onDone={() => setEditing(false)} />;
  return (
    <AppButton variant="secondary" onPress={() => setEditing(true)}>
      {contextButtonText(model)}
    </AppButton>
  );
}
