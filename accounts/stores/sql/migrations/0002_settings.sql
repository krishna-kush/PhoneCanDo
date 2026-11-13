-- The app's settings a signed-in person keeps (docs/accounts.md): one row
-- per setting, its value as JSON text and when a phone last changed it (ms).
-- Deleted with the account.
CREATE TABLE account_settings (
  account_id  TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  at          INTEGER NOT NULL,
  PRIMARY KEY (account_id, key)
);
