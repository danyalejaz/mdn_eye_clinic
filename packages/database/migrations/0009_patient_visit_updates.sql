CREATE TABLE patient_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  kind TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX patient_notifications_by_date ON patient_notifications(patient_id, created_at, id);
CREATE TABLE notification_reads (
  patient_id TEXT NOT NULL REFERENCES patients(id),
  notification_id TEXT NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY (patient_id, notification_id)
);
CREATE VIEW patient_notification_feed AS
  SELECT id, patient_id, kind, resource_id, created_at, NULL AS scheduled_at FROM patient_notifications
  UNION ALL
  SELECT a.id || '-reminder-' || a.version, a.patient_id, 'appointment.reminder', a.id,
    strftime('%Y-%m-%dT%H:%M:%fZ', a.scheduled_at, '-48 hours'), a.scheduled_at
  FROM appointments a
  WHERE a.status = 'confirmed' AND a.source != 'walk_in'
    AND a.scheduled_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    AND a.scheduled_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+48 hours');
-- statement-breakpoint
CREATE TRIGGER appointment_confirmation_notice AFTER INSERT ON appointments
WHEN NEW.source != 'walk_in'
BEGIN
  INSERT INTO patient_notifications(id, patient_id, kind, resource_id, created_at)
  VALUES (NEW.id || '-confirmed', NEW.patient_id, 'appointment.confirmed', NEW.id, NEW.created_at);
END;
-- statement-breakpoint
CREATE TRIGGER appointment_change_notice AFTER UPDATE ON appointments
WHEN NEW.scheduled_at != OLD.scheduled_at OR (NEW.status != OLD.status AND NEW.status IN ('cancelled', 'no_show'))
BEGIN
  INSERT INTO patient_notifications(id, patient_id, kind, resource_id, created_at)
  VALUES (NEW.id || '-change-' || NEW.version, NEW.patient_id,
    'appointment.' || CASE WHEN NEW.scheduled_at != OLD.scheduled_at THEN 'rescheduled' ELSE NEW.status END,
    NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
-- statement-breakpoint
CREATE TRIGGER summary_release_notice AFTER INSERT ON released_summaries
BEGIN
  INSERT INTO patient_notifications(id, patient_id, kind, resource_id, created_at)
  SELECT NEW.encounter_id || '-summary', patient_id, 'summary.released', NEW.encounter_id, NEW.released_at
  FROM encounters WHERE id = NEW.encounter_id;
END;
-- statement-breakpoint
CREATE TRIGGER prescription_release_notice AFTER INSERT ON prescription_releases
BEGIN
  INSERT INTO patient_notifications(id, patient_id, kind, resource_id, created_at)
  SELECT NEW.prescription_id || '-rx', e.patient_id, 'prescription.released', NEW.prescription_id, NEW.released_at
  FROM prescriptions p JOIN encounters e ON e.id = p.encounter_id WHERE p.id = NEW.prescription_id;
END;
