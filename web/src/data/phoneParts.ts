// FIG. 01A's layers, top to bottom (components/sections/hero/apart): what
// the hero phone comes apart into. Each line has to be true of the app.
// `lift` is a layer's height in the stack, the board's 0; the screen is the
// hero's own clip. The cloud relay is a phantom: drawn dashed, as the part
// that is not there.
import { site } from './site';

export type PartId = 'cloud' | 'screen' | 'apps' | 'agent' | 'linux' | 'keys' | 'board';

export type Part = {
  id: PartId;
  lift: number;
  name: string;
  note: string;
  phantom?: boolean;
};

export const phoneParts: Part[] = [
  { id: 'cloud', lift: 6, name: 'Cloud relay', note: 'not invited', phantom: true },
  { id: 'screen', lift: 5, name: 'Screen', note: "reads it so you don't" },
  { id: 'apps', lift: 4, name: 'Your apps', note: 'your thumbs: off duty' },
  { id: 'agent', lift: 3, name: 'A-01', note: 'lives here now' },
  { id: 'linux', lift: 2, name: 'Linux', note: 'root without rooting' },
  { id: 'keys', lift: 1, name: 'Your keys', note: 'we never see them' },
  { id: 'board', lift: 0, name: 'The board', note: `${site.arch} · the PC can rest` },
];
