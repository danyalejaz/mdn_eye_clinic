CREATE TABLE appointment_slots (
  id TEXT PRIMARY KEY NOT NULL,
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL CHECK (end_at > start_at),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  UNIQUE (doctor_id, start_at)
);
-- statement-breakpoint
CREATE TRIGGER appointment_slots_no_overlap BEFORE INSERT ON appointment_slots
WHEN EXISTS (
  SELECT 1 FROM appointment_slots
  WHERE doctor_id = NEW.doctor_id AND start_at < NEW.end_at AND end_at > NEW.start_at
)
BEGIN
  SELECT RAISE(ABORT, 'SLOT_OVERLAP');
END;
-- statement-breakpoint
CREATE TABLE appointments (
  id TEXT PRIMARY KEY NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  slot_id TEXT REFERENCES appointment_slots(id),
  scheduled_at TEXT NOT NULL,
  fee_minor INTEGER NOT NULL CHECK (fee_minor >= 0),
  source TEXT NOT NULL CHECK (source IN ('online', 'reception', 'walk_in')),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show', 'left')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  booking_key TEXT NOT NULL,
  requested_slot_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (created_by, booking_key)
);
CREATE UNIQUE INDEX appointments_reserved_slot ON appointments(slot_id)
  WHERE status NOT IN ('cancelled', 'left');
CREATE INDEX appointments_patient_date ON appointments(patient_id, scheduled_at, id);
CREATE INDEX appointments_doctor_date ON appointments(doctor_id, scheduled_at, id);
CREATE INDEX appointments_date ON appointments(scheduled_at, id);
