CREATE TABLE approved_prescription_identity (
  prescription_id TEXT PRIMARY KEY NOT NULL REFERENCES prescriptions(id),
  patient_name TEXT NOT NULL,
  doctor_name TEXT NOT NULL
);
INSERT INTO approved_prescription_identity (prescription_id, patient_name, doctor_name)
SELECT p.id, pt.display_name, d.display_name
FROM prescriptions p JOIN encounters e ON e.id = p.encounter_id
JOIN patients pt ON pt.id = e.patient_id JOIN doctors d ON d.id = e.doctor_id
WHERE p.approved_at IS NOT NULL;
CREATE TABLE receipt_identity (
  payment_id TEXT PRIMARY KEY NOT NULL REFERENCES payments(id),
  patient_name TEXT NOT NULL
);
INSERT INTO receipt_identity (payment_id, patient_name)
SELECT p.id, pt.display_name FROM payments p JOIN invoices i ON i.id = p.invoice_id
JOIN patients pt ON pt.id = i.patient_id;
CREATE TABLE queue_display_numbers (
  queue_id TEXT PRIMARY KEY NOT NULL REFERENCES queue_tokens(id),
  local_date TEXT NOT NULL,
  display_number INTEGER NOT NULL CHECK (display_number > 0),
  UNIQUE(local_date, display_number)
);
INSERT INTO queue_display_numbers (queue_id, local_date, display_number)
SELECT id, local_date, ROW_NUMBER() OVER (PARTITION BY local_date ORDER BY arrived_at, id)
FROM queue_tokens;
-- statement-breakpoint
CREATE TRIGGER snapshot_approved_prescription AFTER UPDATE OF approved_at ON prescriptions
WHEN OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL
BEGIN
  INSERT INTO approved_prescription_identity(prescription_id, patient_name, doctor_name)
  SELECT NEW.id, pt.display_name, d.display_name
  FROM encounters e JOIN patients pt ON pt.id = e.patient_id JOIN doctors d ON d.id = e.doctor_id
  WHERE e.id = NEW.encounter_id;
END;
-- statement-breakpoint
CREATE TRIGGER snapshot_receipt AFTER INSERT ON payments
BEGIN
  INSERT INTO receipt_identity(payment_id, patient_name)
  SELECT NEW.id, pt.display_name FROM invoices i JOIN patients pt ON pt.id = i.patient_id
  WHERE i.id = NEW.invoice_id;
END;
-- statement-breakpoint
CREATE TRIGGER queue_assign_display_number AFTER INSERT ON queue_tokens
BEGIN
  INSERT INTO queue_display_numbers(queue_id, local_date, display_number)
  SELECT NEW.id, NEW.local_date, 1 + COALESCE(MAX(display_number), 0)
  FROM queue_display_numbers WHERE local_date = NEW.local_date;
END;
