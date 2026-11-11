// The Models section's cartridges: the brains a card can run on, each with
// the phone it needs. Build time only, like agentCards.ts. Our suggested
// models come from lme's own list, best first, with the phone sizes lme's
// RAM gate gives them (SuggestedRamTest keeps those in step), so the app
// and the page never disagree.
import suggested from '../../../lme/catalog/src/main/resources/com/phonecando/lme/catalog/suggested/suggested.json';

/** The smallest phone, by marketed RAM in GB, a model runs on, and runs on with no RAM warning. */
export type PhoneRam = { runsFromGb: number; runsWellFromGb: number };

export type Cartridge = {
  id: string;
  name: string;
  note: string;
  ram: PhoneRam;
  /** Any GGUF: the gate's floor; past it, what a model needs depends on its file. */
  any: boolean;
};

const gb = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;
const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The note's lead word ("Fastest" of "Fastest: …"); the best one is our pick.
const tag = (note: string, best: boolean) => (best ? 'our pick' : note.split(/[:;]/)[0].trim().toLowerCase());

/** Our suggestions, best first, then any GGUF. */
export const cartridges: Cartridge[] = [
  ...suggested.models.map((m, i) => ({
    id: slug(m.title),
    name: m.title,
    note: `${gb(m.file.sizeBytes)} · ${tag(m.note, i === 0)}`,
    ram: m.phoneRam,
    any: false,
  })),
  { id: 'gguf', name: 'Any GGUF', note: 'Hugging Face or a file', ram: suggested.phoneRam, any: true },
];

/** The cartridge in the phone when the page opens: any GGUF, not one of our picks. */
export const firstCartridge = 'gguf';
