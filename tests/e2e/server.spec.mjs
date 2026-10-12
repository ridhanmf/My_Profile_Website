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
});
