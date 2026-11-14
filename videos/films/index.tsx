// Every film there is: what the preview lists and a render picks from. A
// new film is a folder here and a line below.

import { registerRoot } from 'remotion';
import { Films } from '../engine/render/Films.tsx';
import { fieldNotes } from './field-notes/film.tsx';

registerRoot(() => <Films films={[fieldNotes]} />);
