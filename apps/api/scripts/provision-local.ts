import { getPlatformProxy } from "wrangler";
import { getAuth, type Role } from "../src/identity.ts";

const roles = ["patient", "receptionist", "doctor", "admin"] as const;

if (process.argv.includes("--remote")) {
  console.error("This provisioning script writes only to local D1.");
  process.exit(1);
}

const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const [email, role, doctorId, displayName] = args;
const password = process.env.PROVISION_PASSWORD;
const secret = process.env.BETTER_AUTH_SECRET;

if (!email || !roles.includes(role as Role) || !password || password.length < 12 || !secret || secret.length < 32) {
  console.error("Usage: BETTER_AUTH_SECRET=... PROVISION_PASSWORD=... pnpm --dir apps/api account:provision:local <email> <patient|receptionist|doctor|admin> [doctorId] [displayName]");
  process.exit(1);
}

if (role === "doctor" && !doctorId) {
  console.error("A doctor account requires the published doctor id.");
  process.exit(1);
}

const platform = await getPlatformProxy<Pick<Env, "DB">>({ configPath: "wrangler.jsonc", persist: true });
try {
  const env = {
    ...platform.env,
    AUTH_BASE_URL: platform.env.AUTH_BASE_URL ?? "http://127.0.0.1:5173",
    BETTER_AUTH_SECRET: secret,
  };
  const { user } = await getAuth(env).api.signUpEmail({
    body: { email, password, name: displayName || email.split("@")[0] },
  });
  await env.DB.prepare("INSERT INTO clinic_accounts (user_id, role, doctor_id) VALUES (?, ?, ?)")
    .bind(user.id, role, role === "doctor" ? doctorId : null).run();
  if (role === "patient") {
    const patientId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO patients (id, user_id, mrn, display_name, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(patientId, user.id, `MRN-${patientId.slice(0, 8)}`, displayName || email.split("@")[0], new Date().toISOString()).run();
  }
  console.log(`Provisioned local ${role} account for ${email}.`);
} finally {
  await platform.dispose();
}
