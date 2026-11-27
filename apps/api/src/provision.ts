import { hashPassword } from "better-auth/crypto";
import type { Role } from "./identity";

export async function provisionAccount(db: D1Database, account: {
  email: string; password: string; name: string; role: Role; patientId?: string; doctorId?: string;
}, initiatedBy: string | null, requestId: string) {
  const userId = crypto.randomUUID();
  const now = new Date();
  const hashedPassword = await hashPassword(account.password);
  const [result] = await db.batch([
    db.prepare(`
      INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
      SELECT ?1, ?2, ?3, 0, ?4, ?4
      WHERE (?5 IS NOT NULL OR NOT EXISTS (SELECT 1 FROM clinic_accounts WHERE role = 'admin'))
        AND (?6 != 'doctor' OR EXISTS (
          SELECT 1 FROM doctors d WHERE id = ?7 AND NOT EXISTS (
            SELECT 1 FROM clinic_accounts ca WHERE ca.doctor_id = d.id)))
        AND (?6 != 'patient' OR EXISTS (SELECT 1 FROM patients WHERE id = ?8 AND user_id IS NULL))
      ON CONFLICT(email) DO NOTHING
    `).bind(userId, account.name, account.email, now.getTime(), initiatedBy, account.role,
      account.doctorId ?? null, account.patientId ?? null),
    db.prepare(`
      INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
      SELECT ?1, id, 'credential', id, ?2, ?3, ?3 FROM user WHERE id = ?4
    `).bind(crypto.randomUUID(), hashedPassword, now.getTime(), userId),
    db.prepare(`INSERT INTO clinic_accounts (user_id, role, doctor_id)
      SELECT id, ?1, ?2 FROM user WHERE id = ?3`).bind(account.role, account.doctorId ?? null, userId),
    db.prepare(`UPDATE patients SET user_id = ?1 WHERE id = ?2 AND user_id IS NULL
      AND EXISTS (SELECT 1 FROM clinic_accounts WHERE user_id = ?1 AND role = 'patient')`)
      .bind(userId, account.patientId ?? null),
    db.prepare(`INSERT INTO audit_events(actor_id, action, resource_type, resource_id, request_id, created_at)
      SELECT COALESCE(?1, user_id), 'account.provision', 'account', user_id, ?2, ?3
      FROM clinic_accounts WHERE user_id = ?4`)
      .bind(initiatedBy, requestId, now.toISOString(), userId),
  ]);
  return result.meta.changes === 1 ? userId : null;
}
