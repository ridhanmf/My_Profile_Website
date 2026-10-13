import { test, expect } from "playwright/test";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Hostinger mode end to end: the built page + the PHP API on PHP's built-in server, with SQLite
   standing in for MySQL. Skipped when PHP isn't installed. */
const hasPhp = spawnSync("php", ["-v"]).status === 0;
const PORT = 4197, BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "e2e-setup-token-0123456789abcdef";
let dir, srv;

test.describe("Hostinger mode (PHP API)", () => {
  test.skip(!hasPhp, "PHP not installed");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "kb-host-"));
    execFileSync(process.execPath, ["scripts/build.mjs", "--api", "api/", "--no-auth", "--out", join(dir, "index.html")]);
    cpSync("server/api", join(dir, "api"), { recursive: true, filter: (f) => !f.endsWith("config.php") || f.endsWith("example.php") });
    writeFileSync(join(dir, "api/config.php"), `<?php return ['dsn' => 'sqlite:${join(dir, "db.sqlite")}', 'setup_token' => '${TOKEN}'];`);
    srv = spawn("php", ["-S", `127.0.0.1:${PORT}`, "-t", dir], { stdio: "ignore" });
    for (let i = 0; i < 50; i++) { try { await fetch(BASE + "/index.html"); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  });
  test.afterAll(() => { if (srv) srv.kill(); if (dir) rmSync(dir, { recursive: true, force: true }); });

  test("before setup the site works and sign-in explains what to do", async ({ page }) => {
    await page.goto(BASE + "/#collection");
    await expect(page.locator(".col-stat")).toContainText("Total Items");
    await page.click("#admin-open");
    await page.fill("#lg-user", "ridhan"); await page.fill("#lg-pass", "whatever-123");
    await page.click("#lg-go");
    await expect(page.locator("#lg-msg")).toContainText("api/setup.php");
  });

  test("setup page creates the admin, then locks itself", async ({ page }) => {
    await page.goto(BASE + "/api/setup.php");
    await expect(page.locator("body")).toContainText("tersambung");
    await page.fill('input[name="token"]', TOKEN);
    await page.fill('input[name="username"]', "ridhan");
    await page.fill('input[name="password"]', "kos-portfolio-2026");
    await page.fill('input[name="password2"]', "kos-portfolio-2026");
    await page.click('button[type="submit"]');
    await expect(page.locator(".msg")).toContainText("Berhasil");
    await page.goto(BASE + "/api/setup.php");
    await expect(page.locator("form")).toHaveCount(0);
  });

  test("admin saves a car; a fresh visitor sees it without any re-upload", async ({ page, browser }) => {
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + "/#collection");
    await page.click("#admin-open");
    await page.fill("#lg-user", "ridhan"); await page.fill("#lg-pass", "wrong-password");
    await page.click("#lg-go");
    await expect(page.locator("#lg-msg")).toContainText("Wrong username or password. 4 attempt(s) left.");
    await page.fill("#lg-pass", "kos-portfolio-2026");
    await page.click("#lg-go");
    await expect(page.locator("#admin-chip")).toBeVisible();
    await page.click("#add-car");
    await page.fill("#f-name", "Nissan GT-R R35"); await page.fill("#f-brand", "Mini GT"); await page.fill("#f-price", "150000");
    await page.click("#f-save");
    await expect(page.locator("#sb-pub")).toHaveText("Save changes");
    await page.click("#sb-pub");
    await expect(page.locator(".toast")).toContainText("Saved. Visitors now see your changes.");
    await expect(page.locator("#sb-pub")).toBeDisabled();

    // the admin session survives a reload (server-side session)
    await page.reload();
    await expect(page.locator("#admin-chip")).toBeVisible();

    const visitor = await browser.newContext();
    const v = await visitor.newPage();
    await v.goto(BASE + "/#collection");
    await expect(v.locator(".car")).toHaveCount(1);
    await expect(v.locator(".car")).toContainText("Nissan GT-R R35");
    await expect(v.locator("#add-car")).toHaveCount(0);
    expect(await v.evaluate(() => JSON.stringify(SITE).includes('"auth"'))).toBe(false);
    await visitor.close();

    // sign out ends the server session
    await page.click("#admin-chip");
    await page.click("#admin-exit");
    await page.reload();
    await expect(page.locator("#admin-chip")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("private API files are not readable from the web", async ({ request }) => {
    const r = await request.get(BASE + "/api/_lib.php");
    expect(r.status()).toBe(404);
    const c = await request.get(BASE + "/api/config.php");
    expect(await c.text()).not.toContain(TOKEN);
  });

  test("KostBills: Admin imports the test tenant, bills, sends WhatsApp (simulation), takes a payment, prepays, checks out", async ({ page }) => {
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    // A tenant the person registered by hand in the demo, in this browser (test data, not a real person)
    await page.goto(BASE + "/#kos-demo");
    await page.evaluate(() => { const r = KOS.D.rooms.find((x) => x.status === "Vacant"); KOS.checkIn(r, { name: "Penghuni Uji E2E", phone: "0812-0000-0099", job: "Tester", date: KOS.today() }); });
    await page.waitForTimeout(500);

    await page.goto(BASE + "/#kos-role");
    const form = page.locator('form[data-login="admin"]');
    await form.locator('input[name="username"]').fill("ridhan");
    await form.locator('input[name="password"]').fill("kos-portfolio-2026");
    await form.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/#kos-app$/);
    await expect(page.locator(".ops-who")).toContainText("Admin");
    await expect(page.locator(".ops-empty")).toContainText("Belum ada penghuni"); // live data starts empty, apart from the demo
    await expect(page.locator("#kos-nav [data-kv]")).toHaveCount(13);

    await page.click('[data-kv="auto"]');
    const row = page.locator("tr", { hasText: "Penghuni Uji E2E" });
    await expect(row).toContainText("dari browser ini");
    await row.locator("[data-imp-room]").fill("A-101");
    await row.locator('[data-op^="import:"]').click();
    await expect(page.locator(".toast")).toContainText("diimpor ke A-101");
    await expect(page.locator("tr", { hasText: "Penghuni Uji E2E" })).toContainText("sudah diimpor");

    await page.click('[data-kv="bills"]');
    await expect(page.locator("table.t tbody tr")).toHaveCount(1);
    await page.locator('[data-op^="wa:"]').first().click();
    await expect(page.locator(".toast")).toContainText("simulasi");
    await page.locator('[data-op^="link:"]').first().click();
    await expect(page.locator(".modal input.mono")).toHaveValue(/\/api\/pay\.php\?t=[a-f0-9]{40}$/);
    const link = await page.locator(".modal input.mono").inputValue();
    await page.click(".modal [data-close]");
    const pay = await page.context().newPage();
    await pay.goto(link);
    await expect(pay.locator("body")).toContainText("Mode simulasi");
    await pay.close();
    await page.click('[data-kv="bills"]');
    await expect(page.locator("table.t tbody .pill").first()).not.toHaveText("Lunas"); // opening the link paid nothing

    await page.click('[data-kv="pays"]');
    await page.locator('[data-op$=":success"]').first().click();
    await expect(page.locator(".toast")).toContainText("success");
    await expect(page.locator("table.t tbody .pill").first()).toHaveText("Berhasil");
    await page.click('[data-kv="bills"]');
    await expect(page.locator("table.t tbody .pill").first()).toHaveText("Lunas");

    // long-term payment: 6 months of Regular at Rp850.000, commission model, no discount
    await page.click('[data-kv="tenants"]');
    await page.locator('[data-op^="prepay:"]').first().click();
    await expect(page.locator("#pp-q")).toContainText("5.100.000");
    await page.click('[data-pm="12"]');
    await expect(page.locator("#pp-q")).toContainText("10.200.000");
    await page.click('[data-pm="6"]');
    await expect(page.locator("#pp-q")).toContainText("5.100.000");
    await page.click("#pp-go");
    await expect(page.locator(".toast").first()).toContainText("5.100.000");

    // markup model: base price stays, sale price = base + markup
    await page.click('[data-kv="settings"]');
    await page.check('form[data-form="profit"] input[value="markup"]');
    await page.click('form[data-form="profit"] button[type="submit"]');
    await expect(page.locator(".toast")).toContainText("Model keuntungan disimpan");
    await expect(page.locator('form[data-form="prices"] input[name="base_Regular"]')).toHaveValue("850000");
    await page.click('[data-kv="profit"]');
    await expect(page.locator("#kos-main")).toContainText("Markup harga kamar");
    await expect(page.locator("#kos-main")).toContainText("855.000");

    // a management account
    await page.click('[data-kv="users"]');
    await page.fill('form[data-form="user"] input[name="username"]', "manajer");
    await page.fill('form[data-form="user"] input[name="password"]', "manager-pass-1");
    await page.click('form[data-form="user"] button[type="submit"]');
    await expect(page.locator("table.t")).toContainText("manajer");

    // checkout: the next tenant of A-101 starts clean
    await page.click('[data-kv="rooms"]');
    await page.locator('.room[data-room="A-101"]').click();
    await page.locator('.modal [data-op^="checkout:"]').click();
    await expect(page.locator(".modal .refund-policy")).toContainText("Tidak ada refund otomatis");
    await page.click("#co-yes");
    await expect(page.locator(".toast")).toContainText("Kamar A-101 kosong");
    await page.locator('.room[data-room="A-101"]').click();
    await expect(page.locator(".modal")).toContainText("Kamar kosong: tidak ada penghuni aktif");
    await page.fill('.modal form[data-form="checkin"] input[name="name"]', "Penghuni Uji Baru");
    await page.fill('.modal form[data-form="checkin"] input[name="phone"]', "081200000123");
    await page.click('.modal form[data-form="checkin"] button[type="submit"]');
    await expect(page.locator(".modal")).toContainText("Tagihan Penghuni Uji Baru");
    await expect(page.locator(".modal table.t tbody tr")).toHaveCount(1);
    await expect(page.locator(".modal table.t")).toContainText("-T0002");
    await expect(page.locator(".modal table.t")).not.toContainText("-T0001"); // none of the previous tenant's bills
    await expect(page.locator(".modal")).toContainText("1 penghuni sebelumnya ada di Arsip penghuni");
    await page.click(".modal [data-close]");
    await page.click('[data-kv="archive"]');
    await expect(page.locator("table.t")).toContainText("Penghuni Uji E2E");
    await page.click('[data-kv="audit"]');
    await expect(page.locator("table.t")).toContainText("tenant.checkout");
    expect(errors).toEqual([]);
  });

  test("KostBills: Management sees only reports and cannot change data, even through the API", async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + "/#kos-role");
    const form = page.locator('form[data-login="management"]');
    await form.locator('input[name="username"]').fill("manajer");
    await form.locator('input[name="password"]').fill("manager-pass-1");
    await form.locator('button[type="submit"]').click();
    await expect(page.locator(".ops-who")).toContainText("Management");
    expect(await page.locator("#kos-nav [data-kv]").evaluateAll((b) => b.map((x) => x.dataset.kv))).toEqual(["overview", "bills", "reports", "profit"]);
    await page.click('[data-kv="bills"]');
    await expect(page.locator("table.t tbody tr").first()).toBeVisible();
    await expect(page.locator('[data-pay], [data-op^="link:"], [data-op^="wa:"], [data-act^="gen:"]')).toHaveCount(0);
    const r = await page.evaluate(async () => [await api("kos.php?action=generate", { method: "POST", json: { period: KOS.today().slice(0, 7) } }), await api("kos.php?action=settings", { method: "POST", json: { profit_model: "commission" } })]);
    expect(r.map((x) => x.status)).toEqual([403, 403]);
    const st = await page.evaluate(() => api("kos.php?action=state"));
    expect(st.tenants.every((t) => t.phone === undefined)).toBe(true);
    await page.click('[data-kv="profit"]');
    await expect(page.locator("#kos-main")).toContainText("Komisi tercatat");
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test("KostBills: the demo visitor never touches live data; the admin can switch the demo role off", async ({ browser, page }) => {
    const ctx = await browser.newContext(); const v = await ctx.newPage();
    const calls = []; v.on("request", (r) => { if (r.url().includes("/api/kos.php")) calls.push(r.url().split("?")[1]); });
    await v.goto(BASE + "/#kos-role");
    await v.click("#role-visitor");
    await expect(v.locator(".demo-note")).toContainText("Pengunjung Demo");
    await v.click('[data-kv="bills"]');
    expect(await v.evaluate(() => KOS.MODE)).toBe("demo");
    expect(calls.every((c) => c === "action=public")).toBe(true);
    expect(await v.evaluate(() => api("kos.php?action=state").then((r) => r.status))).toBe(401);

    await page.goto(BASE + "/#kos-role");
    const form = page.locator('form[data-login="admin"]');
    if (await form.count()) { await form.locator('input[name="username"]').fill("ridhan"); await form.locator('input[name="password"]').fill("kos-portfolio-2026"); await form.locator('button[type="submit"]').click(); }
    else await page.goto(BASE + "/#kos-app");
    await page.click('[data-kv="settings"]');
    await page.uncheck('form[data-form="general"] input[name="demo_enabled"]');
    await page.click('form[data-form="general"] button[type="submit"]');
    await expect(page.locator(".toast")).toContainText("Disimpan");
    await v.goto(BASE + "/#kos-role");
    await v.reload();
    await expect(v.locator('[data-role-card="visitor"] .role-off')).toContainText("dinonaktifkan");
    await v.goto(BASE + "/#kos-demo"); await v.reload();
    await expect(v.locator(".empty")).toContainText("Mode demo dinonaktifkan");
    await page.check('form[data-form="general"] input[name="demo_enabled"]');
    await page.click('form[data-form="general"] button[type="submit"]');
    await ctx.close();
  });
});
