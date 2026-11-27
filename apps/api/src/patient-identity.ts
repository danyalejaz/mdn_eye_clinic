export async function provisionVerifiedPatient(db: D1Database, userId: string) {
  const patientId = crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO clinic_accounts (user_id, role)
      SELECT id, 'patient' FROM user WHERE id = ? AND emailVerified = 1
      ON CONFLICT(user_id) DO NOTHING`).bind(userId),
    db.prepare(`INSERT INTO patients (id, user_id, mrn, display_name, created_at)
      SELECT ?1, a.user_id, ?2, u.name, ?3 FROM clinic_accounts a JOIN user u ON u.id = a.user_id
      WHERE a.user_id = ?4 AND a.role = 'patient' AND a.active = 1 AND u.emailVerified = 1
      ON CONFLICT(user_id) DO NOTHING`)
      .bind(patientId, `MRN-${patientId}`, new Date().toISOString(), userId),
  ]);
}
