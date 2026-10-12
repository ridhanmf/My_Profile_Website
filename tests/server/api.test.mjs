/* Exercises the PHP API (server/api) end to end with PHP's built-in server and SQLite.
   Skipped automatically when PHP isn't installed. On Hostinger the same code runs on MySQL. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const hasPhp = spawnSync("php", ["-v"]).status === 0;
const PORT = 4195, BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "test-setup-token-0123456789abcdef";
let dir, srv;

before(async () => {
  if (!hasPhp) return;
  dir = mkdtempSync(join(tmpdir(), "kb-api-"));
  cpSync(join(ROOT, "server/api"), join(dir, "api"), { recursive: true });
  writeFileSync(join(dir, "api/config.php"), `<?php return ['dsn' => 'sqlite:${join(dir, "db.sqlite")}', 'setup_token' => '${TOKEN}'];`);
  writeFileSync(join(dir, "index.html"), "<!doctype html><p>site</p>");
  srv = spawn("php", ["-S", `127.0.0.1:${PORT}`, "-t", dir], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + "/index.html"); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
});
after(() => { if (srv) srv.kill(); if (dir) rmSync(dir, { recursive: true, force: true }); });

/* Tiny cookie jar so the PHP session survives between requests. */
const jar = {};
async function call(path, { method = "GET", json, form, csrf, origin } = {}) {
  const headers = { Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") };
  let body;
  if (json) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  if (form) { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (origin) headers.Origin = origin;
  let res;
  try { res = await fetch(BASE + path, { method, headers, body, redirect: "manual" }); }
  catch (e) { throw new Error(`${method} ${path}: ${e.cause ? e.cause.code || e.cause.message : e.message}`); }
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"); const [k, v] = kv.split("="); if (/expires=Thu, 01 Jan 1970|Max-Age=0/i.test(c) || v === "deleted") delete jar[k]; else jar[k] = v; }
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, text };
}
const site = (name) => ({ v: 1, rev: 0, profile: { name }, cars: [{ id: "c1", name: "Supra", brand: "Hot Wheels" }], auth: { hash: "should-not-be-stored" } });

test("API: setup, sign-in, saving and protections", { skip: !hasPhp && "PHP not installed" }, async () => {
  let r = await call("/api/auth.php");
  assert.equal(r.status, 200); assert.equal(r.data.configured, false); assert.equal(r.data.admin, false);
  r = await call("/api/site.php?rev=0");
  assert.deepEqual(r.data, { ok: true, empty: true });
  r = await call("/api/auth.php?action=login", { method: "POST", json: { username: "x", password: "y" } });
  assert.equal(r.status, 503);

  // private files are not served as endpoints
  r = await call("/api/_lib.php"); assert.equal(r.status, 404);

  // setup: wrong token, weak password, then success; afterwards the form is gone
  r = await call("/api/setup.php"); assert.match(r.text, /tersambung \(sqlite\)/);
  r = await call("/api/setup.php", { method: "POST", form: { token: "nope", username: "ridhan", password: "long-password-1", password2: "long-password-1" } });
  assert.match(r.text, /Setup token salah/);
  r = await call("/api/setup.php", { method: "POST", form: { token: TOKEN, username: "ridhan", password: "short", password2: "short" } });
  assert.match(r.text, /minimal 10 karakter/);
  r = await call("/api/setup.php", { method: "POST", form: { token: TOKEN, username: "ridhan", password: "long-password-1", password2: "long-password-1" } });
  assert.match(r.text, /Berhasil!/);
  r = await call("/api/setup.php", { method: "POST", form: { token: TOKEN, username: "evil", password: "long-password-2", password2: "long-password-2" } });
  assert.match(r.text, /Setup sudah selesai/); assert.doesNotMatch(r.text, /<form/);

  // sign-in
  r = await call("/api/auth.php?action=login", { method: "POST", json: { username: "ridhan", password: "wrong-password" } });
  assert.equal(r.status, 401); assert.equal(r.data.attempts_left, 4);
  r = await call("/api/auth.php?action=login", { method: "POST", json: { username: "ridhan", password: "long-password-1" }, origin: "https://evil.example" });
  assert.equal(r.status, 403);
  r = await call("/api/auth.php?action=login", { method: "POST", json: { username: "ridhan", password: "long-password-1" } });
  assert.equal(r.status, 200); const csrf = r.data.csrf; assert.equal(csrf.length, 64);
  r = await call("/api/auth.php"); assert.equal(r.data.admin, true); assert.equal(r.data.csrf, csrf);

  // saving needs the CSRF token
  r = await call("/api/site.php", { method: "POST", json: { baseRev: 0, data: site("A") } });
  assert.equal(r.status, 403);
  r = await call("/api/site.php", { method: "POST", json: { baseRev: 0, data: { profile: {} } }, csrf });
  assert.equal(r.status, 422);
  r = await call("/api/site.php", { method: "POST", json: { baseRev: 0, data: site("Ridhan Firdaus") }, csrf });
  assert.equal(r.status, 200); assert.equal(r.data.rev, 1);

  // visitors get the saved content; credentials were stripped
  r = await call("/api/site.php?rev=0");
  assert.equal(r.data.rev, 1); assert.equal(r.data.data.profile.name, "Ridhan Firdaus"); assert.equal(r.data.data.auth, undefined); assert.equal(r.data.data.rev, 1);
  r = await call("/api/site.php?rev=1"); assert.deepEqual(r.data, { ok: true, unchanged: true, rev: 1 });

  // stale edits are refused instead of overwriting newer content
  r = await call("/api/site.php", { method: "POST", json: { baseRev: 0, data: site("Old tab") }, csrf });
  assert.equal(r.status, 409); assert.equal(r.data.rev, 1);
  r = await call("/api/site.php", { method: "POST", json: { baseRev: 1, data: site("Second save") }, csrf });
  assert.equal(r.data.rev, 2);

  // change login (needs the current password), then old password stops working
  r = await call("/api/auth.php?action=password", { method: "POST", json: { current: "bad", username: "ridhan2", password: "another-long-pass" }, csrf });
  assert.equal(r.status, 403);
  r = await call("/api/auth.php?action=password", { method: "POST", json: { current: "long-password-1", username: "ridhan2", password: "another-long-pass" }, csrf });
  assert.equal(r.status, 200); const csrf2 = r.data.csrf;
  r = await call("/api/auth.php?action=logout", { method: "POST", csrf: csrf2 });
  assert.equal(r.status, 200);
  r = await call("/api/auth.php"); assert.equal(r.data.admin, false);
  r = await call("/api/site.php", { method: "POST", json: { baseRev: 2, data: site("x") }, csrf: csrf2 });
  assert.equal(r.status, 401);
  r = await call("/api/auth.php?action=login", { method: "POST", json: { username: "ridhan", password: "long-password-1" } });
  assert.equal(r.status, 401);
  r = await call("/api/auth.php?action=login", { method: "POST", json: { username: "ridhan2", password: "another-long-pass" } });
  assert.equal(r.status, 200);
});

test("API: lockout after five failed sign-ins", { skip: !hasPhp && "PHP not installed" }, async () => {
  for (const k of Object.keys(jar)) delete jar[k];
  let r;
  for (let i = 0; i < 5; i++) r = await call("/api/auth.php?action=login", { method: "POST", json: { username: "ridhan2", password: "nope-" + i } });
  assert.equal(r.status, 429);
  r = await call("/api/auth.php?action=login", { method: "POST", json: { username: "ridhan2", password: "another-long-pass" } });
  assert.equal(r.status, 429, "even the right password is refused while locked");
  assert.ok(r.data.retry_after > 0);
});
