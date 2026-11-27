import { readFileSync } from "node:fs";

const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const placeholder = /"database_id"\s*:\s*"00000000-0000-0000-0000-000000000000"/;

if (placeholder.test(config)) {
  console.error("Refusing to deploy. wrangler.jsonc still has the local-only D1 database id.");
  process.exit(1);
}
