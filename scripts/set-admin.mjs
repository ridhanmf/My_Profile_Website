#!/usr/bin/env node
/**
 * Creates the admin credential hash used by the site's sign-in form.
 *
 * Reads ADMIN_USERNAME and ADMIN_PASSWORD from .env (or the environment) and writes
 * src/data/admin-auth.json with a salted PBKDF2-SHA256 hash. The plain password is never stored.
 * That JSON file is git-ignored; the build merges it into the page.
 *
 * Usage: npm run set-admin            (uses .env)
 *        node scripts/set-admin.mjs --out path/to/file.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pbkdf2Sync, randomBytes } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const i = args.indexOf("--out");
const OUT = resolve(ROOT, i >= 0 && args[i + 1] ? args[i + 1] : "src/data/admin-auth.json");

const env = { ...process.env };
const envFile = join(ROOT, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (env[m[1]] === undefined) env[m[1]] = v;
  }
}
const user = (env.ADMIN_USERNAME || "").trim();
const pass = env.ADMIN_PASSWORD || "";
if (!user || !pass) { console.error("set-admin: set ADMIN_USERNAME and ADMIN_PASSWORD in .env (copy .env.example first)."); process.exit(1); }
if (pass.length < 8) { console.error("set-admin: ADMIN_PASSWORD must be at least 8 characters."); process.exit(1); }

/* Must match src/core/admin.js: PBKDF2-SHA256 over "username:password", 32-byte key. */
const iter = 310000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(`${user}:${pass}`, salt, iter, 32, "sha256");
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ alg: "PBKDF2-SHA256", iter, salt: salt.toString("base64"), hash: hash.toString("base64") }, null, 2) + "\n");
console.log(`set-admin: wrote ${OUT.replace(ROOT + "/", "")} for user "${user}". Run npm run build to apply it.`);
