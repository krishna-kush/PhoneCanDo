import SectionTitle from '../../common/SectionTitle';
import { HONEST_NOTE } from '../../models/logic/modelText';
import ModelPicker from '../../models/parts/ModelPicker';
import Note from '../parts/Note';
import type { ModelPick } from './useModelPick';

// A new agent's Model step, under the kinds (Choose agent, first launch):
// the agent's own setup starts picked; a model is set as the agent page
// sets it, and can be changed there later.
export default function ModelStep({ pick }: { pick: ModelPick }) {
  if (!pick.show) return null;
  return (
    <>
      <SectionTitle>Model</SectionTitle>
      <ModelPicker models={pick.models} selected={pick.modelId} onSelect={pick.select} />
      <Note>{pick.modelId ? HONEST_NOTE : "You can change this later on the agent's page."}</Note>
    </>
  );
}
