-- tce schema v1.5: drops devices.drm_id.
--   It was for a hash of the phone's Widevine (DRM) id, coded in the app but
--   never switched on, so every row holds NULL. Nothing used it, and we want
--   no phone id that outlives a factory reset, so the column, the wire field
--   and the app's reader are all gone.
--   Order: apply this only after the Worker that no longer writes drm_id is
--   live (push first, then `cf d1 migrations apply`). The Worker before it
--   names the column in every device upsert, and those would fail.

ALTER TABLE devices DROP COLUMN drm_id;
