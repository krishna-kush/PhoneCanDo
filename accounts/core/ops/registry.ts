// The single list of routes. Hosts match requests against it; adding a route
// is one file in this folder and one line here.

import type { Route } from '../route.ts';
import { deleteRoute } from './delete.ts';
import { meRoute } from './me.ts';
import { nonceRoute } from './nonce.ts';
import { settingsReadRoute } from './settings-read.ts';
import { settingsWriteRoute } from './settings-write.ts';
import { sharesRoute } from './shares.ts';
import { signinRoute } from './signin.ts';
import { signoutRoute } from './signout.ts';

/** Every route of the accounts API. */
export const routes: readonly Route[] = [
  nonceRoute,
  signinRoute,
  meRoute,
  sharesRoute,
  settingsReadRoute,
  settingsWriteRoute,
  signoutRoute,
  deleteRoute,
];
