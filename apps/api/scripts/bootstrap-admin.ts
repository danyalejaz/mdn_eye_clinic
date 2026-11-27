import { getPlatformProxy } from "wrangler";
import { provisionAccount } from "../src/provision.ts";

const email = process.env.CLINIC_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const name = process.env.CLINIC_BOOTSTRAP_NAME?.trim();
const password = process.env.CLINIC_BOOTSTRAP_PASSWORD;
if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !name || name.length > 120 || !password || password.length < 12 || password.length > 128 || !password.trim()) {
  throw new Error("Set CLINIC_BOOTSTRAP_EMAIL, CLINIC_BOOTSTRAP_NAME and CLINIC_BOOTSTRAP_PASSWORD (12–128 characters).");
}

const state = process.env.CLINIC_LOCAL_STATE;
const proxy = await getPlatformProxy<Pick<Env, "DB">>({
  configPath: "wrangler.jsonc", remoteBindings: false, persist: state ? { path: state } : true,
});
try {
  const id = await provisionAccount(proxy.env.DB, { email, name, password, role: "admin" }, null, crypto.randomUUID());
  if (!id) throw new Error("An administrator already exists or the email is already registered.");
  console.log(`Created local administrator ${id}. Authenticator enrollment is required at sign-in.`);
} finally {
  await proxy.dispose();
}
