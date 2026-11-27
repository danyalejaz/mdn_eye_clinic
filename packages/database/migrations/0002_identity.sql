CREATE TABLE user (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  twoFactorEnabled INTEGER DEFAULT 0
);
CREATE TABLE session (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL UNIQUE,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  mfaVerified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX session_user_idx ON session(userId);
CREATE TABLE account (
  id TEXT PRIMARY KEY NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope TEXT,
  password TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX account_user_idx ON account(userId);
CREATE TABLE verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX verification_identifier_idx ON verification(identifier);
CREATE TABLE twoFactor (
  id TEXT PRIMARY KEY NOT NULL,
  secret TEXT NOT NULL,
  backupCodes TEXT NOT NULL,
  userId TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  verified INTEGER DEFAULT 1,
  failedVerificationCount INTEGER DEFAULT 0,
  lockedUntil INTEGER
);
CREATE INDEX two_factor_secret_idx ON twoFactor(secret);
CREATE TABLE rateLimit (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL,
  lastRequest INTEGER NOT NULL
);
CREATE TABLE clinic_accounts (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id),
  role TEXT NOT NULL CHECK (role IN ('patient', 'receptionist', 'doctor', 'admin')),
  doctor_id TEXT UNIQUE REFERENCES doctors(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  CHECK ((role = 'doctor') = (doctor_id IS NOT NULL))
);
CREATE TABLE patients (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT UNIQUE REFERENCES clinic_accounts(user_id),
  mrn TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  date_of_birth TEXT,
  phone TEXT,
  created_at TEXT NOT NULL
);
