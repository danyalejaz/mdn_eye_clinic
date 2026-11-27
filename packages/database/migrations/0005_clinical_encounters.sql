CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  request_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_by_resource ON audit_events(resource_type, resource_id, id);
CREATE TABLE patient_allergies (
  patient_id TEXT PRIMARY KEY NOT NULL REFERENCES patients(id),
  status TEXT NOT NULL CHECK (status IN ('none_known', 'recorded')),
  details TEXT,
  updated_by TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  updated_at TEXT NOT NULL,
  CHECK ((status = 'recorded') = (details IS NOT NULL))
);
CREATE TABLE encounters (
  id TEXT PRIMARY KEY NOT NULL,
  appointment_id TEXT NOT NULL UNIQUE REFERENCES appointments(id),
  queue_id TEXT NOT NULL UNIQUE REFERENCES queue_tokens(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finalized_at TEXT,
  actor_id TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  request_id TEXT NOT NULL
);
CREATE INDEX encounters_patient_date ON encounters(patient_id, created_at, id);
CREATE TABLE encounter_amendments (
  id TEXT PRIMARY KEY NOT NULL,
  encounter_id TEXT NOT NULL REFERENCES encounters(id),
  reason TEXT NOT NULL,
  correction TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  created_at TEXT NOT NULL
);
CREATE INDEX amendments_encounter ON encounter_amendments(encounter_id, created_at, id);
CREATE TABLE released_summaries (
  encounter_id TEXT PRIMARY KEY NOT NULL REFERENCES encounters(id),
  summary TEXT NOT NULL,
  released_by TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  released_at TEXT NOT NULL
);
-- statement-breakpoint
CREATE TRIGGER encounter_started AFTER INSERT ON encounters
BEGIN
  UPDATE queue_tokens SET status = 'in_consultation', version = version + 1,
    updated_at = NEW.updated_at, updated_by = NEW.actor_id WHERE id = NEW.queue_id AND status = 'called';
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'INVALID_QUEUE_STATE') END;
  UPDATE appointments SET status = 'in_consultation', version = version + 1
    WHERE id = NEW.appointment_id AND status = 'waiting';
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'INVALID_APPOINTMENT_STATE') END;
  INSERT INTO audit_events(actor_id, action, resource_type, resource_id, request_id, created_at)
    VALUES (NEW.actor_id, 'encounter.start', 'encounter', NEW.id, NEW.request_id, NEW.updated_at);
END;
-- statement-breakpoint
CREATE TRIGGER encounter_immutable BEFORE UPDATE ON encounters
WHEN OLD.status = 'finalized'
BEGIN
  SELECT RAISE(ABORT, 'ENCOUNTER_IMMUTABLE');
END;
-- statement-breakpoint
CREATE TRIGGER encounter_saved AFTER UPDATE ON encounters
BEGIN
  INSERT INTO audit_events(actor_id, action, resource_type, resource_id, request_id, created_at)
    VALUES (NEW.actor_id, 'encounter.' || CASE NEW.status WHEN 'finalized' THEN 'finalize' ELSE 'draft.save' END,
      'encounter', NEW.id, NEW.request_id, NEW.updated_at);
END;
-- statement-breakpoint
CREATE TRIGGER encounter_finalized AFTER UPDATE OF status ON encounters
WHEN NEW.status = 'finalized'
BEGIN
  UPDATE queue_tokens SET status = 'completed', version = version + 1,
    updated_at = NEW.updated_at, updated_by = NEW.actor_id
    WHERE id = NEW.queue_id AND status = 'in_consultation';
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'INVALID_QUEUE_STATE') END;
  UPDATE appointments SET status = 'completed', version = version + 1
    WHERE id = NEW.appointment_id AND status = 'in_consultation';
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'INVALID_APPOINTMENT_STATE') END;
END;
