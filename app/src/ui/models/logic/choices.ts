// The Model choices, on the agent page and in a new agent's Model step:
// the agent's own setup first, then every model on the phone; one that
// fails the RAM gate cannot be picked, and a chosen model that is gone
// still shows, so the choice is never silently lost. Pure (zero RN imports).
import type { LocalModel, ModelDates } from '../../../engine/models/types';
import { runsHere } from '../../../state/flows/logic/modelStep.ts';
import { modelLine, verdictText } from './modelText.ts';

export type ModelChoice = {
  /** null: the agent's own setup. */
  id: string | null;
  label: string;
  note: string;
  /** A model's release and training-data dates (logic/dates.ts); null for the rest. */
  dates: ModelDates | null;
  disabled: boolean;
};

export const OWN_SETUP_NOTE = 'Whatever the agent is set up with: its own sign-in, provider and model.';

export function modelChoices(models: LocalModel[], current: string | null): ModelChoice[] {
  const own: ModelChoice = { id: null, label: "The agent's own setup", note: OWN_SETUP_NOTE, dates: null, disabled: false };
  const local = models.map<ModelChoice>((m) => ({
    id: m.id,
    label: m.name,
    note: `${modelLine(m)} · ${verdictText(m.ram)}`,
    dates: m.dates ?? null,
    disabled: !runsHere(m.ram),
  }));
  const gone: ModelChoice[] =
    current && !models.some((m) => m.id === current)
      ? [{ id: current, label: current, note: 'No longer on this phone: pick another.', dates: null, disabled: true }]
      : [];
  return [own, ...local, ...gone];
}
