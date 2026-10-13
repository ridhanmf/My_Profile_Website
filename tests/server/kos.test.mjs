/* KostBills operational API (server/api/kos.php, pay.php, webhook.php, cron.php) on PHP's built-in server
   with SQLite. Covers roles, billing without duplicates, both profit models, payment links and webhooks,
   WhatsApp sending and reminders, checkout history separation, long-term payments and demo isolation.
   Skipped when PHP isn't installed. Test data only: no real names or phone numbers. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const hasPhp = spawnSync("php", ["-v"]).status === 0;
const PORT = 4196, BASE = `http://127.0.0.1:${PORT}`, WA_PORT = 4198;
const TOKEN = "test-setup-token-0123456789abcdef";
const SIM_SECRET = "test-sim-secret-not-for-production";
const CRON_KEY = "test-cron-key-0123456789abcdef";
let dir, srv, waSrv;
const waCalls = [];

function writeConfig({ today, env = {} } = {}) {
  const e = { SIM_WEBHOOK_SECRET: SIM_SECRET, CRON_KEY, PUBLIC_BASE_URL: "https://kos.example", ...env };
  const php = `<?php return ['dsn' => 'sqlite:${join(dir, "db.sqlite")}', 'setup_token' => '${TOKEN}'${today ? `, 'kos_today' => '${today}'` : ""}, 'env' => ${"[" + Object.entries(e).map(([k, v]) => `'${k}' => '${v}'`).join(", ") + "]"}];`;
  writeFileSync(join(dir, "api/config.php"), php);
}

before(async () => {
  if (!hasPhp) return;
  dir = mkdtempSync(join(tmpdir(), "kb-kos-"));
  cpSync(join(ROOT, "server/api"), join(dir, "api"), { recursive: true });
  writeConfig({ today: "2026-10-05" });
  // Stand-in for graph.facebook.com so the Cloud API driver can be exercised without sending anything.
  waSrv = createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c));
    req.on("end", () => { waCalls.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) }); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ messages: [{ id: "wamid.TEST" + waCalls.length }] })); });
  }).listen(WA_PORT, "127.0.0.1");
  srv = spawn("php", ["-S", `127.0.0.1:${PORT}`, "-t", dir], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + "/api/auth.php"); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
});
after(() => { if (srv) srv.kill(); if (waSrv) waSrv.close(); if (dir) rmSync(dir, { recursive: true, force: true }); });

/* Separate cookie jars per role. */
function client() {
  const jar = {}; let csrf = "";
  async function call(path, { method = "GET", json, form, headers: extra = {}, raw } = {}) {
    const headers = { Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "), ...extra };
    let body;
    if (json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
    if (form) { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
    if (raw !== undefined) body = raw;
    if (method !== "GET" && csrf && !headers["X-CSRF-Token"]) headers["X-CSRF-Token"] = csrf;
    const res = await fetch(BASE + path, { method, headers, body, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"); const [k, v] = kv.split("="); if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c) || v === "deleted") delete jar[k]; else jar[k] = v; }
    const text = await res.text(); let data = null; try { data = JSON.parse(text); } catch {}
    return { status: res.status, data, text };
  }
  return {
    call,
    async login(username, password) { const r = await call("/api/auth.php?action=login", { method: "POST", json: { username, password } }); if (r.data && r.data.csrf) csrf = r.data.csrf; return r; },
    get: (a) => call("/api/kos.php?action=" + a),
    post: (a, json = {}) => call("/api/kos.php?action=" + a, { method: "POST", json }),
  };
}
const admin = client(), mgmt = client(), visitor = client();
const state = async () => (await admin.get("state")).data;
const billOf = (s, tenantId, period) => s.bills.find((b) => +b.tenant_id === tenantId && b.period_start === period);
const sign = (raw) => "sha256=" + createHmac("sha256", SIM_SECRET).update(raw).digest("hex");
const tokenOf = (url) => new URL(url).searchParams.get("t");
async function webhook(payload, sig) {
  const raw = JSON.stringify(payload);
  return visitor.call("/api/webhook.php?gateway=simulation", { method: "POST", raw, headers: { "Content-Type": "application/json", "X-KB-Signature": sig || sign(raw) } });
}
const now = () => Math.floor(Date.now() / 1000);
const opt = { skip: !hasPhp && "PHP not installed" };
const T = {}; // tenant ids

test("1. roles: admin, management and visitor rights are enforced by the API", opt, async () => {
  let r = await visitor.call("/api/setup.php", { method: "POST", form: { token: TOKEN, username: "owner", password: "owner-password-1", password2: "owner-password-1" } });
  assert.match(r.text, /Berhasil!/);
  r = await visitor.get("public"); assert.equal(r.status, 200); assert.equal(r.data.demo_enabled, true);
  r = await visitor.get("state"); assert.equal(r.status, 401, "visitors get no operational data");
  r = await visitor.post("generate", { period: "2026-10" }); assert.equal(r.status, 401);

  r = await admin.login("owner", "owner-password-1"); assert.equal(r.status, 200); assert.equal(r.data.role, "admin");
  r = await admin.post("user_create", { username: "manajer", password: "short", role: "management" }); assert.equal(r.status, 422);
  r = await admin.post("user_create", { username: "manajer", password: "manager-pass-1", role: "management" }); assert.equal(r.status, 200);
  r = await admin.call("/api/kos.php?action=generate", { method: "POST", json: { period: "2026-10" }, headers: { "X-CSRF-Token": "wrong" } });
  assert.equal(r.status, 403, "CSRF token required");

  r = await mgmt.login("manajer", "manager-pass-1"); assert.equal(r.data.role, "management");
  r = await mgmt.call("/api/auth.php"); assert.equal(r.data.admin, false); assert.equal(r.data.role, "management");
  r = await mgmt.get("state"); assert.equal(r.status, 200); assert.equal(r.data.role, "management");
  assert.equal(r.data.wa, undefined); assert.equal(r.data.audit, undefined); assert.equal(r.data.users, undefined);
  for (const a of ["generate", "settings", "price", "checkin", "checkout", "pay_manual", "paylink", "wa_send", "user_create", "sim_webhook", "void_bill"]) {
    r = await mgmt.post(a, { period: "2026-10", profit_model: "markup" });
    assert.equal(r.status, 403, `management must not be able to call ${a}`); assert.equal(r.data.error, "forbidden");
  }
  r = await mgmt.call("/api/site.php", { method: "POST", json: { baseRev: 0, data: { profile: {}, cars: [] } } });
  assert.equal(r.status, 403, "management cannot edit the portfolio content either");

  r = await admin.get("state");
  assert.equal(r.data.rooms.length, 1000);
  assert.deepEqual(Object.fromEntries(["Regular", "Premium", "Expensive"].map((t) => [t, r.data.rooms.filter((x) => x.type === t).length])), { Regular: 850, Premium: 100, Expensive: 50 });
  assert.equal(r.data.tenants.length, 0, "operational data starts empty: no demo tenants are copied in");
  assert.equal(r.data.integration.payment.name, "simulation"); assert.equal(r.data.integration.wa.name, "simulation");

  r = await admin.post("settings", { demo_enabled: false }); assert.equal(r.status, 200);
  r = await visitor.get("public"); assert.equal(r.data.demo_enabled, false, "demo role can be switched off");
  await admin.post("settings", { demo_enabled: true });
});

test("2. monthly billing without duplicates; tenant without phone shows what is missing", opt, async () => {
  let r = await admin.post("checkin", { room: "A-101", name: "Penghuni Uji Satu", phone: "0812 0000 0001", job: "Tester", check_in: "2026-10-05", months: 1 });
  assert.equal(r.status, 200, JSON.stringify(r.data)); T.a = +r.data.tenant.id;
  assert.equal(r.data.tenant.phone, "081200000001"); assert.equal(r.data.bill.total, 850000); assert.equal(r.data.bill.due_date, "2026-10-05");
  r = await admin.post("checkin", { room: "A-101", name: "Orang Lain", phone: "", check_in: "2026-10-05" });
  assert.equal(r.status, 409, "one active tenant per room");
  r = await admin.post("checkin", { room: "A-102", name: "X", phone: "12345", check_in: "2026-10-05" }); assert.equal(r.status, 422, "bad phone rejected");
  r = await admin.post("checkin", { room: "A-102", name: "Penghuni Tanpa Nomor", phone: "", check_in: "2026-10-01" }); T.nophone = +r.data.tenant.id;

  r = await admin.post("generate", { period: "2026-10" }); assert.equal(r.data.created, 0, "October already billed at check-in");
  r = await admin.post("generate", { period: "2026-11" }); assert.equal(r.data.created, 2);
  assert.equal(r.data.wa["simulated"], 1); assert.equal(r.data.wa["skipped:no_phone"], 1, "tenant without a number is reported, not guessed");
  r = await admin.post("generate", { period: "2026-11" }); assert.equal(r.data.created, 0, "running again creates nothing");
  r = await admin.post("generate", { period: "2027-03" }); assert.equal(r.status, 422, "cannot bill far ahead");
  r = await admin.post("generate", { period: "2026-13" }); assert.equal(r.status, 422);
  const s = await state();
  assert.equal(s.bills.filter((b) => +b.tenant_id === T.a).length, 2);
  r = await admin.call("/api/cron.php?key=nope"); assert.equal(r.status, 403);
  r = await admin.call("/api/cron.php?key=" + CRON_KEY); assert.equal(r.status, 200); assert.equal(r.data.generate.created, 0, "cron is idempotent too");
});

test("3. profit models: commission vs markup, base price untouched by markup", opt, async () => {
  let s = await state();
  assert.equal(s.settings.profit_model, "commission");
  const oct = billOf(s, T.a, "2026-10");
  assert.equal(+oct.base_price, 850000); assert.equal(+oct.markup, 0); assert.equal(+oct.sale_price, 850000); assert.equal(+oct.profit, 0);
  let r = await admin.post("pay_manual", { bill_id: +oct.id, amount: 900000, method: "QRIS", date: "2026-10-05" });
  assert.equal(r.status, 422, "overpayment refused"); assert.equal(r.data.balance, 850000);
  r = await admin.post("pay_manual", { bill_id: +oct.id, amount: 850000, method: "Bayar di jalan", date: "2026-10-05" }); assert.equal(r.status, 422);
  r = await admin.post("pay_manual", { bill_id: +oct.id, amount: 850000, method: "QRIS", date: "2026-10-05" });
  assert.equal(r.data.paid_off, true);
  s = await state();
  assert.deepEqual(s.commissions.map((c) => [c.period, +c.n, +c.total]), [["2026-10", 1, 5000]]);
  r = await admin.post("pay_manual", { bill_id: +oct.id, amount: 1000, method: "QRIS", date: "2026-10-05" }); assert.equal(r.status, 409, "paid bill takes no more money");

  r = await admin.post("settings", { profit_model: "markup", markup: { Regular: 5000, Premium: 7500, Expensive: 10000 } }); assert.equal(r.status, 200);
  s = await state();
  assert.deepEqual(s.types.map((t) => [t.type, t.base, t.markup, t.sale]), [["Regular", 850000, 5000, 855000], ["Premium", 850000, 7500, 857500], ["Expensive", 850000, 10000, 860000]]);
  r = await admin.post("settings", { markup: { Regular: 20000, Premium: 7500, Expensive: 10000 } });
  s = await state(); assert.equal(s.types[0].base, 850000, "changing markup never changes the base price"); assert.equal(s.types[0].sale, 870000);
  await admin.post("settings", { markup: { Regular: 5000, Premium: 7500, Expensive: 10000 } });
  r = await admin.post("checkin", { room: "B-101", name: "Penghuni Uji Dua", phone: "081200000002", check_in: "2026-10-03", months: 1 });
  T.b = +r.data.tenant.id;
  assert.deepEqual([r.data.bill.base_price, r.data.bill.markup, r.data.bill.sale_price, r.data.bill.total, r.data.bill.profit, r.data.bill.profit_model].map(String), ["850000", "5000", "855000", "855000", "5000", "markup"]);
  r = await admin.post("pay_manual", { bill_id: +r.data.bill.id, amount: 855000, method: "Cash", date: "2026-10-04" });
  s = await state();
  assert.equal(s.commissions.reduce((a, c) => a + +c.total, 0), 5000, "markup bills never create commission rows (no double counting)");
  assert.equal(+billOf(s, T.a, "2026-11").sale_price, 850000, "bills keep the price they were issued with");
  r = await admin.post("price", { type: "Premium", base_price: 900000 }); assert.equal(r.status, 200);
  r = await admin.post("price", { type: "Premium", base_price: -5 }); assert.equal(r.status, 422);
  s = await state(); assert.equal(s.types[1].base, 900000); assert.equal(s.types[1].markup, 7500);
  assert.ok(s.audit.some((a) => a.action === "price.base") && s.audit.some((a) => a.action === "settings.update"), "price changes are audited");
  await admin.post("price", { type: "Premium", base_price: 850000 });
  await admin.post("settings", { profit_model: "commission" });
});

test("4. payment link + webhook: only a verified notification marks a bill paid, once", opt, async () => {
  let s = await state();
  const nov = billOf(s, T.a, "2026-11");
  let r = await admin.post("paylink", { bill_id: +nov.id }); assert.equal(r.status, 200);
  const url = r.data.url; assert.match(url, /^https:\/\/kos\.example\/api\/pay\.php\?t=[a-f0-9]{40}$/);
  r = await admin.post("paylink", { bill_id: +nov.id }); assert.equal(r.data.url, url, "one active link per bill"); assert.equal(r.data.reused, true);
  const token = tokenOf(url);
  r = await visitor.call("/api/pay.php?t=" + token);
  assert.match(r.text, /Mode simulasi/); assert.match(r.text, /Rp850\.000/);
  s = await state(); assert.equal(billOf(s, T.a, "2026-11").status, "open", "opening the link does not mark anything paid");
  r = await visitor.call("/api/pay.php?t=" + "0".repeat(40)); assert.match(r.text, /tidak ditemukan/);

  const ok = { token, ref: "SIM-REF-0001", status: "success", amount: 850000, timestamp: now() };
  r = await webhook(ok, "sha256=" + "0".repeat(64)); assert.equal(r.status, 401, "bad signature rejected");
  r = await webhook({ ...ok, timestamp: now() - 3600 }); assert.equal(r.status, 401, "old notification rejected");
  r = await webhook({ ...ok, amount: 1000 }); assert.equal(r.status, 422, "amount must match the link");
  s = await state(); assert.equal(billOf(s, T.a, "2026-11").status, "open");
  r = await webhook(ok); assert.equal(r.status, 200); assert.equal(r.data.result, "success");
  s = await state(); const b = billOf(s, T.a, "2026-11");
  assert.equal(b.status, "paid"); assert.equal(+b.paid, 850000);
  r = await webhook(ok); assert.equal(r.data.result, "duplicate_delivery", "same delivery processed once");
  r = await webhook({ ...ok, timestamp: now() + 1 }); assert.equal(r.data.result, "already_success", "no double payment");
  s = await state();
  assert.equal(s.trx.filter((t) => t.code === b.code).length, 1);
  assert.equal(+s.commissions.find((c) => c.period === "2026-11").n, 1);
  assert.equal(s.tenants.find((t) => +t.id === T.a).paid_until, "2026-12-04", "lease extended to the end of the paid period");
  r = await admin.post("paylink", { bill_id: +b.id }); assert.equal(r.status, 409, "no link for a paid bill");
  r = await visitor.call("/api/pay.php?t=" + token); assert.match(r.text, /sudah lunas|diterima/);

  // failed and expired
  const decB = (await admin.post("generate", { period: "2026-11" })) && billOf(await state(), T.b, "2026-11");
  r = await admin.post("paylink", { bill_id: +decB.id }); const t2 = tokenOf(r.data.url);
  r = await webhook({ token: t2, ref: "SIM-REF-0002", status: "failed", amount: +decB.total, timestamp: now() }); assert.equal(r.data.result, "failed");
  s = await state(); assert.equal(s.payments.find((p) => p.ref === "SIM-REF-0002").status, "failed"); assert.equal(billOf(s, T.b, "2026-11").status, "open");
  r = await admin.post("paylink", { bill_id: +decB.id }); const t3 = tokenOf(r.data.url); assert.notEqual(t3, t2);
  s = await state();
  r = await admin.post("sim_webhook", { payment_id: +s.payments.find((p) => p.status === "pending" && p.code === decB.code).id, status: "expired" });
  assert.equal(r.data.result, "expired");
  s = await state(); assert.equal(s.payments.filter((p) => p.code === decB.code && p.status === "expired").length, 1);
  r = await mgmt.post("sim_webhook", { payment_id: 1, status: "success" }); assert.equal(r.status, 403);
  r = await visitor.call("/api/webhook.php?gateway=paypro", { method: "POST", raw: "{}", headers: { "Content-Type": "application/json" } });
  assert.equal(r.status, 501, "PayPro adapter refuses until it is implemented from the official docs");
});

test("5. WhatsApp: bill message content, reminders by schedule without duplicates, resend, Cloud API driver", opt, async () => {
  let s = await state();
  const issued = s.wa.find((m) => m.kind === "issued" && +m.tenant_id === T.a);
  assert.ok(issued, "bill message logged when November was generated");
  for (const part of ["Penghuni Uji Satu", "A-101", "November 2026", "Rp850.000", "5 Nov 2026", "Belum dibayar", "https://kos.example/api/pay.php?t="]) assert.ok(issued.body.includes(part), `message contains ${part}`);
  assert.equal(issued.to_phone, "081200000001"); assert.equal(issued.status, "simulated");

  // H-7 for tenant B's December bill (due 3 Dec): 26 Nov
  writeConfig({ today: "2026-11-26" });
  assert.equal((await admin.post("generate", { period: "2026-12" })).status, 200);
  let r = await admin.post("reminders_run"); assert.equal(r.status, 200);
  s = await state();
  const decB = billOf(s, T.b, "2026-12");
  assert.equal(s.wa.filter((m) => +m.bill_id === +decB.id && m.kind === "before_7").length, 1);
  assert.match(s.wa.find((m) => m.kind === "before_7").body, /jatuh tempo 7 hari lagi/);
  r = await admin.post("reminders_run");
  s = await state(); assert.equal(s.wa.filter((m) => +m.bill_id === +decB.id && m.kind === "before_7").length, 1, "no duplicate reminder");
  writeConfig({ today: "2026-12-04" }); // H+1
  await admin.post("reminders_run");
  s = await state(); assert.ok(s.wa.some((m) => +m.bill_id === +decB.id && m.kind === "after_1"));
  r = await admin.post("wa_send", { bill_id: +decB.id }); assert.equal(r.data.wa.status, "simulated");
  r = await admin.post("wa_send", { bill_id: +decB.id }); assert.equal(r.status, 429, "resend is rate limited");
  r = await admin.post("settings", { reminders_before: [5, 2], reminders_after: [2] }); assert.equal(r.status, 200);
  r = await admin.post("settings", { reminders_before: [-1] }); assert.equal(r.status, 422);
  s = await state(); assert.deepEqual(s.settings.reminders_before, [5, 2]);

  // next day, so the one-minute resend limit no longer applies
  writeConfig({ today: "2026-12-05", env: { WA_DRIVER: "cloud_api", WA_CLOUD_TOKEN: "test-token", WA_PHONE_NUMBER_ID: "123456", WA_API_BASE: `http://127.0.0.1:${WA_PORT}`, WA_TEMPLATE_NAME: "tagihan_kos" } });
  r = await admin.post("wa_send", { bill_id: +decB.id });
  assert.equal(r.data.wa.status, "sent"); assert.equal(r.data.wa.driver, "cloud_api");
  const call = waCalls.at(-1);
  assert.equal(call.url, "/v21.0/123456/messages"); assert.equal(call.auth, "Bearer test-token");
  assert.equal(call.body.to, "6281200000002"); assert.equal(call.body.template.name, "tagihan_kos");
  assert.deepEqual(call.body.template.components[0].parameters.slice(0, 2).map((p) => p.text), ["Penghuni Uji Dua", "B-101"]);
  writeConfig({ today: "2026-12-05", env: { WA_DRIVER: "cloud_api" } });
  s = await state(); assert.equal(s.integration.wa.name, "simulation", "Cloud API without credentials falls back to simulation"); assert.deepEqual(s.integration.wa.missing, ["WA_CLOUD_TOKEN", "WA_PHONE_NUMBER_ID"]);
  writeConfig({ today: "2026-12-04" });
});

test("8. long-term payment: 1/6/12-month totals, discount, prepaid months never billed twice, lease extended", opt, async () => {
  let r = await admin.post("checkin", { room: "C-101", name: "Penghuni Uji Tiga", phone: "081200000003", check_in: "2026-12-04", months: 1 }); T.c = +r.data.tenant.id;
  r = await admin.post("prepay_quote", { tenant_id: T.c, months: 1 }); assert.equal(r.data.quote.total, 850000);
  r = await admin.post("prepay_quote", { tenant_id: T.c, months: 6 });
  assert.equal(r.data.quote.total, 5100000); assert.equal(r.data.quote.period_start, "2027-01", "starts at the first month not billed yet");
  assert.equal(r.data.quote.start_date, "2027-01-04"); assert.equal(r.data.quote.end_date, "2027-07-03");
  r = await admin.post("prepay_quote", { tenant_id: T.c, months: 12 }); assert.equal(r.data.quote.total, 10200000);
  r = await admin.post("prepay_quote", { tenant_id: T.c, months: 3 }); assert.equal(r.status, 422);
  await admin.post("settings", { discount_pct: { 6: 5, 12: 10 } });
  r = await admin.post("prepay_quote", { tenant_id: T.c, months: 12 });
  assert.equal(r.data.quote.subtotal, 10200000); assert.equal(r.data.quote.discount, 1020000); assert.equal(r.data.quote.total, 9180000);
  r = await admin.post("settings", { discount_pct: { 6: 60, 12: 0 } }); assert.equal(r.status, 422);
  r = await admin.post("prepay_create", { tenant_id: T.c, months: 6, send_wa: true });
  assert.equal(r.status, 200); const pre = r.data.bill;
  assert.equal(+pre.total, 4845000); assert.equal(+pre.discount_amount, 255000); assert.equal(pre.kind, "prepay"); assert.equal(r.data.wa.status, "simulated");
  r = await admin.post("prepay_create", { tenant_id: T.c, months: 6 }); assert.equal(+r.data.bill.months, 6);
  assert.equal(r.data.bill.period_start, "2027-07", "a second prepayment continues after the first, never overlapping");
  await admin.post("void_bill", { bill_id: +r.data.bill.id, reason: "uji pembatalan" });
  writeConfig({ today: "2027-01-02" });
  r = await admin.post("generate", { period: "2027-01" });
  let s = await state();
  assert.equal(s.bills.filter((b) => +b.tenant_id === T.c && b.period_start === "2027-01").length, 1, "January is covered by the prepayment: no monthly bill");
  const link = await admin.post("paylink", { bill_id: +pre.id });
  r = await webhook({ token: tokenOf(link.data.url), ref: "SIM-REF-PRE6", status: "success", amount: 4845000, timestamp: now() });
  assert.equal(r.data.result, "success");
  s = await state();
  assert.equal(s.tenants.find((t) => +t.id === T.c).paid_until, "2027-07-03", "lease extended by six months");
  assert.equal(s.commissions.filter((c) => c.period >= "2027-01" && c.period <= "2027-06").reduce((a, c) => a + +c.n, 0), 6, "commission once per covered month");
  writeConfig({ today: "2027-02-02" });
  r = await admin.post("generate", { period: "2027-02" });
  s = await state(); assert.equal(s.bills.filter((b) => +b.tenant_id === T.c && b.period_start === "2027-02").length, 0, "no monthly bill inside a prepaid period");
  await admin.post("settings", { discount_pct: { 6: 0, 12: 0 }, profit_model: "markup" });
  r = await admin.post("prepay_quote", { tenant_id: T.c, months: 6 });
  assert.equal(r.data.quote.total, 5130000); assert.equal(r.data.quote.profit, 30000, "markup model: profit = markup × months");
  await admin.post("settings", { profit_model: "commission" });
});

test("6. checkout: history stays with the old tenant, new tenant starts clean, no automatic refund", opt, async () => {
  writeConfig({ today: "2027-02-10" });
  let r = await admin.post("checkout", { tenant_id: T.c, date: "2027-02-10" });
  assert.equal(r.status, 200);
  assert.equal(r.data.prepaid_months_after, 4, "March–June were prepaid");
  assert.equal(r.data.refund, "none_automatic"); assert.match(r.data.refund_policy, /Tidak ada refund otomatis/);
  r = await admin.post("checkout", { tenant_id: T.c, date: "2027-02-10" }); assert.equal(r.status, 409);
  let s = await state();
  assert.equal(s.rooms.find((x) => x.id === "C-101").status, "Vacant");
  const oldBills = s.bills.filter((b) => +b.tenant_id === T.c);
  assert.ok(oldBills.length >= 2, "old tenant's bills are kept for audit");
  r = await admin.post("checkin", { room: "C-101", name: "Penghuni Uji Empat", phone: "081200000004", check_in: "2027-02-10", months: 1 });
  T.d = +r.data.tenant.id;
  s = await state();
  const newBills = s.bills.filter((b) => +b.tenant_id === T.d);
  assert.equal(newBills.length, 1); assert.equal(newBills[0].status, "open"); assert.equal(+newBills[0].paid, 0, "new tenant inherits no payment status");
  assert.equal(s.tenants.find((t) => +t.id === T.d).paid_until, null, "and no lease from the old tenant");
  assert.ok(oldBills.every((b) => +b.tenant_id === T.c), "old bills still point to the old tenant");
  assert.ok(s.audit.some((a) => a.action === "tenant.checkout"));
  r = await mgmt.post("checkout", { tenant_id: T.d, date: "2027-02-10" }); assert.equal(r.status, 403);
});

test("7. demo and operational data stay apart; sessions and audit", opt, async () => {
  const s = await state();
  const names = s.tenants.map((t) => t.name);
  assert.ok(names.every((n) => n.startsWith("Penghuni ")), "only tenants created through the API");
  const m = (await mgmt.get("state")).data;
  assert.ok(m.tenants.every((t) => t.phone === undefined && t.job === undefined), "management sees no phone numbers");
  assert.equal(m.bills.length, s.bills.length);
  let r = await admin.post("user_delete", { id: 1 }); assert.equal(r.status, 409, "cannot delete yourself");
  r = await admin.call("/api/_kos.php"); assert.equal(r.status, 404);
  r = await admin.call("/api/_gateways.php"); assert.equal(r.status, 404);
  r = await mgmt.call("/api/auth.php?action=logout", { method: "POST" }); assert.equal(r.status, 200);
  r = await mgmt.get("state"); assert.equal(r.status, 401);
});
