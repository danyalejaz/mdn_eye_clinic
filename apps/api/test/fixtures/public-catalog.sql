-- Fictional fixtures for local development and tests only.
INSERT INTO clinic_settings (id, name, address, hours_summary, published)
VALUES (1, 'Demo Eye Clinic', 'Sample address, Mardan', 'Mon–Sat, 9:00 AM–2:00 PM', 1)
ON CONFLICT(id) DO NOTHING;

INSERT INTO departments (slug, name, published) VALUES
  ('eye-care', 'Eye Care', 1),
  ('draft-department', 'Draft Department', 0)
ON CONFLICT(slug) DO NOTHING;

INSERT INTO services (slug, department_slug, name, fee_minor, published) VALUES
  ('eye-consultation', 'eye-care', 'Demo Eye Consultation', 150000, 1),
  ('draft-service', 'eye-care', 'Draft Service', 0, 0),
  ('hidden-service', 'draft-department', 'Hidden Service', 0, 1)
ON CONFLICT(slug) DO NOTHING;

INSERT INTO doctors (id, slug, department_slug, display_name, specialty, fee_minor, published)
VALUES
  ('doc_demo_a', 'demo-doctor-a', 'eye-care', 'Demo Doctor A', 'Ophthalmology', 150000, 1),
  ('doc_demo_b', 'demo-doctor-b', 'eye-care', 'Demo Doctor B', 'Optometry', 120000, 1),
  ('doc_draft', 'draft-doctor', 'eye-care', 'Draft Doctor', 'Ophthalmology', 0, 0),
  ('doc_hidden', 'hidden-doctor', 'draft-department', 'Hidden Doctor', 'Ophthalmology', 0, 1)
ON CONFLICT(slug) DO NOTHING;
