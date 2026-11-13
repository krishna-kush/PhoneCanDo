// The A-series body as the app draws it: the shared spec (mascot/) over the
// logo's own numbers (theme/logo.json), as the website does.
import logo from '../../../../../theme/logo.json';
import { bodyOf } from '../../../../../mascot/body.ts';

export const BODY = bodyOf(logo);
