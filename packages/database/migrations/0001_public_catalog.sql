CREATE TABLE clinic_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  hours_summary TEXT,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1))
);

CREATE TABLE departments (
  slug TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1))
);

CREATE TABLE services (
  slug TEXT PRIMARY KEY NOT NULL,
  department_slug TEXT NOT NULL REFERENCES departments(slug),
  name TEXT NOT NULL,
  description TEXT,
  fee_minor INTEGER NOT NULL CHECK (fee_minor BETWEEN 0 AND 9007199254740991),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1))
) STRICT;

CREATE TABLE doctors (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  department_slug TEXT NOT NULL REFERENCES departments(slug),
  display_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  qualifications TEXT,
  photo_url TEXT,
  fee_minor INTEGER NOT NULL CHECK (fee_minor BETWEEN 0 AND 9007199254740991),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1))
) STRICT;
