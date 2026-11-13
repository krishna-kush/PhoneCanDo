-- Accounts: only people who chose to sign in with Google (optional).
-- docs/accounts.md is the published schema; change both together.
-- Never edit a shipped migration: add the next number instead.

-- One row per Google account that signed in. id is ours (random);
-- google_sub is Google's account number; email is refreshed on each sign-in.
CREATE TABLE accounts (
  id          TEXT PRIMARY KEY,
  google_sub  TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  created     INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL
);

-- One row per signed-in phone. Only the SHA-256 of the session token.
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  created     INTEGER NOT NULL,
  last_used   INTEGER NOT NULL
);
CREATE INDEX sessions_account ON sessions (account_id);
CREATE INDEX sessions_last_used ON sessions (last_used);

-- One-use sign-in nonces, ten minutes each.
CREATE TABLE nonces (
  nonce    TEXT PRIMARY KEY,
  expires  INTEGER NOT NULL
);
CREATE INDEX nonces_expires ON nonces (expires);

-- The share links an account keeps (codes and when they were made, nothing else).
CREATE TABLE account_shares (
  account_id  TEXT NOT NULL,
  code        TEXT NOT NULL,
  created     INTEGER NOT NULL,
  PRIMARY KEY (account_id, code)
);
