import { spawnSync } from "node:child_process";

if (process.argv.includes("--remote")) {
  console.error("Refusing to apply the fictional catalog seed to a remote database.");
  process.exit(1);
}

const result = spawnSync(
  "pnpm",
  ["exec", "wrangler", "d1", "execute", "DB", "--local", "--file", "test/fixtures/public-catalog.sql"],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
