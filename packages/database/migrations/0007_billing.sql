CREATE TABLE invoices (
  id TEXT PRIMARY KEY NOT NULL,
  appointment_id TEXT NOT NULL UNIQUE REFERENCES appointments(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  consultation_minor INTEGER NOT NULL CHECK (consultation_minor >= 0),
  created_by TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX invoices_patient ON invoices(patient_id, created_at, id);
CREATE TABLE payments (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'wallet')),
  reference TEXT,
  operation_key TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  created_at TEXT NOT NULL,
  UNIQUE (created_by, operation_key),
  CHECK (method = 'cash' OR reference IS NOT NULL)
) STRICT;
CREATE INDEX payments_invoice ON payments(invoice_id);
CREATE INDEX payments_date ON payments(created_at);
CREATE UNIQUE INDEX payments_external_reference ON payments(method, reference) WHERE method != 'cash';
CREATE TABLE refunds (
  id TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  reason TEXT NOT NULL,
  operation_key TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES clinic_accounts(user_id),
  created_at TEXT NOT NULL,
  UNIQUE (created_by, operation_key)
) STRICT;
CREATE INDEX refunds_payment ON refunds(payment_id);
CREATE INDEX refunds_date ON refunds(created_at);
