CREATE TABLE rooms (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);
CREATE TABLE doctor_rooms (
  doctor_id TEXT PRIMARY KEY NOT NULL REFERENCES doctors(id),
  room_id TEXT NOT NULL REFERENCES rooms(id)
);
CREATE TABLE queue_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  appointment_id TEXT NOT NULL UNIQUE REFERENCES appointments(id),
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  room_id TEXT REFERENCES rooms(id),
  local_date TEXT NOT NULL,
  token_number INTEGER NOT NULL CHECK (token_number > 0),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'skipped', 'in_consultation', 'completed', 'left')),
  version INTEGER NOT NULL DEFAULT 1,
  arrived_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  reason TEXT,
  UNIQUE (doctor_id, local_date, token_number)
);
CREATE UNIQUE INDEX queue_one_called ON queue_tokens(doctor_id) WHERE status = 'called';
CREATE UNIQUE INDEX queue_one_active ON queue_tokens(doctor_id) WHERE status = 'in_consultation';
CREATE INDEX queue_by_date ON queue_tokens(local_date, doctor_id, token_number);
CREATE INDEX queue_by_room ON queue_tokens(room_id, local_date, status);
-- statement-breakpoint
CREATE TRIGGER queue_check_in AFTER INSERT ON queue_tokens
BEGIN
  UPDATE appointments SET status = 'waiting', version = version + 1
  WHERE id = NEW.appointment_id AND status = 'confirmed';
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'INVALID_CHECK_IN') END;
END;
