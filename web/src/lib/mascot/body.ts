// The A-series body as the site draws it: the shared spec (mascot/) over the
// logo's own numbers (theme/logo.json).

import logo from '../../../../theme/logo.json';
import { bodyOf } from '../../../../mascot/body.ts';

export const BODY = bodyOf(logo);
