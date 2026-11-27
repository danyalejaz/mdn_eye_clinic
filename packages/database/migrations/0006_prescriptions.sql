CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY NOT NULL,
  encounter_id TEXT NOT NULL REFERENCES encounters(id),
  supersedes_id TEXT UNIQUE REFERENCES prescriptions(id),
  version INTEGER NOT NULL DEFAULT 1,
  items TEXT NOT NULL CHECK (json_valid(items)),
  correction_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT REFERENCES clinic_accounts(user_id),
  approval_key TEXT,
  CHECK ((approved_at IS NULL) = (approved_by IS NULL))
);
CREATE INDEX prescriptions_encounter ON prescriptions(encounter_id, created_at, id);
CREATE TABLE prescription_releases (
  prescription_id TEXT PRIMARY KEY NOT NULL REFERENCES prescriptions(id),
  released_by TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  released_at TEXT NOT NULL
);
-- statement-breakpoint
CREATE TRIGGER approved_prescription_immutable BEFORE UPDATE ON prescriptions
WHEN OLD.approved_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'PRESCRIPTION_IMMUTABLE');
END;
