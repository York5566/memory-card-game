CREATE TABLE IF NOT EXISTS mg_storage (
  id INTEGER PRIMARY KEY CHECK(id = 1), bytes INTEGER NOT NULL DEFAULT 0 CHECK(bytes >= 0), profiles INTEGER NOT NULL DEFAULT 0 CHECK(profiles >= 0)
);
INSERT OR IGNORE INTO mg_storage(id) VALUES(1);
CREATE TABLE IF NOT EXISTS mg_profiles (
  code TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, request_id TEXT NOT NULL UNIQUE,
  owner_hash TEXT NOT NULL, payload_hash TEXT NOT NULL, bytes INTEGER NOT NULL CHECK(bytes > 0),
  status TEXT NOT NULL CHECK(status IN ('pending','ready','deleting')),
  created_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS mg_profile_expiry ON mg_profiles(status, expires_at);
CREATE INDEX IF NOT EXISTS mg_profile_pending ON mg_profiles(status, created_at);
CREATE TRIGGER IF NOT EXISTS mg_storage_insert AFTER INSERT ON mg_profiles BEGIN
  UPDATE mg_storage SET bytes = bytes + NEW.bytes, profiles = profiles + 1 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS mg_storage_delete AFTER DELETE ON mg_profiles BEGIN
  UPDATE mg_storage SET bytes = bytes - OLD.bytes, profiles = profiles - 1 WHERE id = 1;
END;
CREATE TABLE IF NOT EXISTS mg_counters(day INTEGER NOT NULL, scope TEXT NOT NULL, used INTEGER NOT NULL, PRIMARY KEY(day,scope));
