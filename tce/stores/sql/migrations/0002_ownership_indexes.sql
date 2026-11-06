-- tce schema v1.1, additive only (the live Worker keeps working before and after).
--   devices.verifier: SHA-256 of the device's forget proof, first write wins
--     (core/schema/limits.ts HASH_PEPPER). Writes and forgets must match it.
--   errors/reports by device: forget() deletes by device_id; without these it
--     scanned both tables on every call.
--   reports by received: retention delete and the daily report cap.

ALTER TABLE devices ADD COLUMN verifier TEXT;

CREATE INDEX errors_device ON errors (device_id);
CREATE INDEX reports_device ON reports (device_id);
CREATE INDEX reports_received ON reports (received);
