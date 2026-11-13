// Google sign-in's one setting.

/**
 * The client ID of our Google Cloud project's "Web application" OAuth client
 * (Google Auth Platform → Clients). Public, not a secret: Google names it as
 * the ID token's audience, and the Worker accepts only the ids in its
 * GOOGLE_CLIENT_IDS var, which lists this same one. The Android clients
 * (package name + signing certificate) need no id here. Project
 * `phonecando`, client "PhoneCanDo server". Empty would mean sign-in isn't set
 * up: the Account page then says so.
 */
export const GOOGLE_WEB_CLIENT_ID = '701358888506-nejeeo6ga7d547o4otsip01tc9f9g3b2.apps.googleusercontent.com';
