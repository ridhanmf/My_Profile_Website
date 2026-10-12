import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";

/* Test-only credentials (see tests/fixtures/admin-auth.json). Not the site's real admin login. */
const ADMIN = { user: "e2e-admin", pass: "e2e-password-123" };

/* Fail a test on any uncaught error or console error (network errors for blocked fonts/CDNs excluded). */
function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_|Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  return errors;
}

async function signIn(page, user = ADMIN.user, pass = ADMIN.pass) {
  await page.click("#admin-open");
  await page.fill("#lg-user", user);
  await page.fill("#lg-pass", pass);
  await page.click("#lg-go");
}

/* window.claude stub: makes the page behave as the owner of a Claude artifact. */
const ARTIFACT_OWNER = `window.__published = null; window.claude = { use: async (n) => {
  if (n === "user") return { isOwner: async () => true, canEdit: async () => true };
  if (n === "artifact") return { publish: async (h) => { window.__published = h; return { version: "v" }; } };
  if (n === "downloads") return { save: async (r) => { window.__saved = r.filename; return { status: "saved" }; } };
  return null; } };`;
const ARTIFACT_VISITOR = `window.claude = { use: async (n) => {
  if (n === "user") return { isOwner: async () => false, canEdit: async () => false };
  if (n === "artifact") return { publish: async () => { throw { code: "not_writer" }; } };
  return null; } };`;

test.describe("routing and layout", () => {
  for (const route of ["home", "collection", "smartpark", "kos", "kos-demo"]) {
    test(`#${route} renders without errors (desktop + mobile)`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`/#${route}`);
      if (route === "home" || route === "collection") await expect(page.locator(`.nav > a[data-route="${route}"]`)).toHaveAttribute("aria-current", "page");
      else await expect(page.locator("#nav-proj")).toHaveAttribute("aria-current", "page");
      await expect(page.locator("body")).toHaveAttribute("data-page", route);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  }

  test("navbar: Home, MyCollection and a Project menu with SmartPark and KostBills", async ({ page }) => {
    await page.goto("/#does-not-exist");
    await expect(page.locator("body")).toHaveAttribute("data-page", "home");
    expect(await page.locator(".nav > a").allInnerTexts()).toEqual(["Home", "MyCollection"]);
    await expect(page.locator("#nav-proj")).toHaveText(/Project/);
    await expect(page.locator("#nav-menu")).toBeHidden();
    await page.click("#nav-proj");
    await expect(page.locator("#nav-proj")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#nav-menu a")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.locator("#nav-menu")).toBeHidden();
    await page.click("#nav-proj");
    await page.click('#nav-menu a[data-route="smartpark"]');
    await expect(page).toHaveURL(/#smartpark$/);
    await expect(page.locator("#nav-menu")).toBeHidden();
    await page.click("#nav-proj");
    await page.click('#nav-menu a[data-route="kos"]');
    await expect(page).toHaveURL(/#kos$/);
    await expect(page.locator(".kl-title")).toBeVisible();
    await page.click("#nav-proj");
    await page.mouse.click(20, 400);
    await expect(page.locator("#nav-menu")).toBeHidden();
    await page.click('.nav > a[data-route="collection"]');
    await expect(page.locator(".col-stat")).toContainText("Total Items");
  });

  test("Project menu works on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#home");
    await page.click("#nav-proj");
    const box = await page.locator("#nav-menu").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await page.click('#nav-menu a[data-route="kos"]');
    await expect(page).toHaveURL(/#kos$/);
  });

  test("theme switch cycles Auto → Light → Dark and is remembered", async ({ page }) => {
    await page.goto("/#home");
    const btn = page.locator("#theme-btn");
    await expect(btn).toHaveAttribute("data-mode", "auto");
    await btn.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await btn.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(13, 17, 22)");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.locator("#theme-btn").click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });
});

test.describe("home", () => {
  test("roles, contacts and the four project cards", async ({ page }) => {
    await page.goto("/#home");
    const role = page.locator(".hero-role");
    for (const r of ["Data Analyst", "NOC Engineer", "Web Developer", "AI Engineer"]) await expect(role).toContainText(r);
    await expect(page.locator("body")).not.toContainText(/open to work/i);
    const contact = page.locator("#contact");
    await expect(contact.locator('a[href="https://instagram.com/ridhnfirdaus"]')).toHaveCount(1);
    await expect(contact.locator('a[href="https://github.com/ridhanmf"]')).toHaveCount(1);
    await expect(contact).toContainText("ridhanmuhammad25@gmail.com");
    await expect(page.locator(".proj-card")).toHaveCount(4);
    await expect(page.locator(".proj-thumb img")).toHaveCount(4);
    for (const t of ["YourMajor", "Sneaker", "Flight Price", "Car Logo"]) await expect(page.locator(".proj-grid")).toContainText(t);
    await expect(page.locator('.proj-grid a[href^="https://github.com/ridhanmf/"]')).toHaveCount(4);
  });
});

test.describe("admin (standalone build)", () => {
  test("visitors can browse but not edit", async ({ page }) => {
    await page.goto("/#collection");
    await expect(page.locator("#add-car")).toHaveCount(0);
    await expect(page.locator("#admin-chip")).toHaveCount(0);
    await expect(page.locator("#admin-open")).toHaveCount(1);
  });

  test("wrong password is rejected and nothing unlocks", async ({ page }) => {
    await page.goto("/#collection");
    await signIn(page, ADMIN.user, "wrong-password");
    await expect(page.locator("#lg-msg")).toContainText("Wrong username or password");
    await expect(page.locator("#admin-chip")).toHaveCount(0);
  });

  test("sign in, add a car, WhatsApp link, export site.json without credentials", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#collection");
    await signIn(page);
    await expect(page.locator("#admin-chip")).toBeVisible();
    await page.click("#add-car");
    await page.fill("#f-name", "Toyota Supra MK4");
    await page.fill("#f-brand", "Hot Wheels");
    await page.fill("#f-price", "95000");
    await page.click("#f-save");
    await expect(page.locator(".car")).toHaveCount(1);
    await expect(page.locator(".col-stat")).toContainText("1");
    await expect(page.locator(".car .btn.wa")).toHaveAttribute("href", /^https:\/\/wa\.me\/6281224504181\?text=/);
    await expect(page.locator("#sb-pub")).toHaveText("Export site data");

    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#sb-pub")]);
    expect(download.suggestedFilename()).toBe("site.json");
    const data = JSON.parse(readFileSync(await download.path(), "utf8"));
    expect(data.cars.map((c) => c.name)).toEqual(["Toyota Supra MK4"]);
    expect(data.auth).toBeUndefined();
    expect(data.assetSources).toBeUndefined();
    expect(data.profile.photo).toBe("assets/images/portrait.jpg");
    expect(data.assets.spHero).toBe("assets/images/smartpark-hero.jpg");
    expect(JSON.stringify(data)).not.toContain(ADMIN.pass);
    await expect(page.locator("#sb-pub")).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test("lockout after five failed attempts", async ({ page }) => {
    await page.goto("/#collection");
    await page.click("#admin-open");
    for (let i = 0; i < 5; i++) {
      await page.fill("#lg-user", "someone");
      await page.fill("#lg-pass", "nope-" + i);
      await page.click("#lg-go");
      await page.waitForFunction(() => { const b = document.getElementById("lg-go"); return b && !b.disabled; });
    }
    await expect(page.locator("#lg-msg")).toContainText(/locked/i);
  });
});

test.describe("admin (Claude artifact mode)", () => {
  test("owner publishes; the page rebuilds itself byte-for-byte", async ({ page }) => {
    await page.addInitScript(ARTIFACT_OWNER);
    await page.goto("/#collection");
    const served = await page.evaluate(() => fetch("/").then((r) => r.text()));
    expect(await page.evaluate(() => buildDocument(SITE))).toBe(served);
    await expect(page.locator("#theme-btn")).toHaveCount(0);
    await signIn(page);
    await expect(page.locator("#admin-chip")).toBeVisible();
    await page.click("#add-car");
    await page.fill("#f-name", "Nissan Skyline R34");
    await page.fill("#f-brand", "Tomica");
    await page.click("#f-save");
    await expect(page.locator("#sb-pub")).toHaveText("Publish changes");
    await page.click("#sb-pub");
    await expect.poll(() => page.evaluate(() => window.__published && window.__published.length)).toBeGreaterThan(1000);
    const pub = await page.evaluate(() => window.__published);
    expect(pub).toContain("Nissan Skyline R34");
    expect(pub).not.toContain(ADMIN.pass);
  });

  test("correct password without write access cannot edit", async ({ page }) => {
    await page.addInitScript(ARTIFACT_VISITOR);
    await page.goto("/#collection");
    await signIn(page);
    await expect(page.locator("#lg-msg")).toContainText("can't save changes");
    await expect(page.locator("#admin-chip")).toHaveCount(0);
  });
});

test.describe("SmartPark", () => {
  test("enter → QRIS → auto park → finish & exit", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#smartpark");
    await expect(page.locator("#sp-sel")).toContainText("Belum ada mobil terpilih");
    for (const k of ["EV", "Wanita", "VIP"]) await expect(page.locator("#sp-cats")).toContainText(k);
    expect(await page.evaluate(() => SP.GEO[1].N.ENT[1] === 674 && SP.GEO[1].N.EXIT[1] === 674)).toBe(true);

    await page.selectOption("#sp-kind", "EV");
    await page.click("#sp-enter");
    await page.click('[data-flow="scan"]');
    await expect(page.locator(".qris svg")).toHaveCount(1);
    await page.click("#qris-ok");
    await page.locator('[data-flow="autoSel"]').click({ timeout: 20_000 });
    await expect(page.locator("#sp-sel")).toContainText(/Parkir di B[12]-/, { timeout: 40_000 });
    await expect(page.locator("#sp-log")).toContainText("SENSOR", { timeout: 10_000 });

    await page.locator('[data-flow="finish"]').click();
    await expect(page.locator("#sp-flow")).toContainText("Sudah keluar", { timeout: 60_000 });
    await page.click('[data-level="2"]');
    await expect(page.locator("#sp-av-title")).toContainText("Ketersediaan · Basement 2");
    expect(errors).toEqual([]);
  });

  test("reset clears the simulation", async ({ page }) => {
    await page.goto("/#smartpark");
    await page.click("#sp-enter");
    await page.click("#sp-reset");
    await expect(page.locator("#sp-sel")).toContainText("Belum ada mobil terpilih");
  });

  test("Modern / Tradisional theme switch is applied, remembered and keeps the map working", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#smartpark");
    await expect(page.locator('[data-sptheme="modern"]')).toHaveAttribute("aria-pressed", "true");
    const modernBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.click('[data-sptheme="tradisional"]');
    await expect(page.locator("body")).toHaveAttribute("data-sp-theme", "tradisional");
    const trad = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, img: getComputedStyle(document.body).backgroundImage, map: SP.colors().asphalt }));
    expect(trad.bg).not.toBe(modernBg);
    expect(trad.img).toContain("data:image/svg+xml");
    expect(trad.map).toBe("#2a2126");
    await page.reload();
    await expect(page.locator('[data-sptheme="tradisional"]')).toHaveAttribute("aria-pressed", "true");
    await page.click("#sp-enter");
    await expect(page.locator("#sp-sel")).toContainText("Menunggu di gerbang");
    await page.click('.nav > a[data-route="home"]');
    await expect(page.locator("body")).not.toHaveAttribute("data-sp-theme", /.+/);
    expect(errors).toEqual([]);
  });
});

test.describe("KostBills", () => {
  test("landing page: language switch, feature tabs, simulator, WhatsApp, Coba Demo and back", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#kos");
    await expect(page.locator(".kl-title")).toContainText("Tagihan 1.000 kamar kos");
    await expect(page.locator("#kl-demo")).toHaveText(/Coba Demo KostBills/);
    await page.click('[data-lang="en"]');
    await expect(page.locator(".kl-title")).toContainText("Billing for 1,000 rooms");
    await expect(page.locator("#kl-demo")).toHaveText(/Try the KostBills Demo/);
    await page.reload();
    await expect(page.locator(".kl-title")).toContainText("Billing for 1,000 rooms");
    await page.click('[data-lang="id"]');
    await expect(page.locator(".kl-title")).toContainText("Tagihan 1.000 kamar kos");

    for (const k of ["rooms", "bills", "status", "reminder", "wa", "reports"]) {
      await page.click(`[data-feature="${k}"]`);
      await expect(page.locator(`[data-feature="${k}"]`)).toHaveAttribute("aria-selected", "true");
    }
    await page.click('[data-feature="wa"]');
    await expect(page.locator(".kl-bubble")).toContainText("Mohon segera melakukan pembayaran");
    await expect(page.locator(".kl-chat a.kl-btn-wa")).toHaveAttribute("href", /^https:\/\/wa\.me\/6281224504181\?text=/);
    await expect(page.locator(".kl-hero a.kl-btn-wa")).toHaveAttribute("href", /^https:\/\/wa\.me\/6281224504181\?text=/);
    await page.click('[data-feature="bills"]');
    await page.click("[data-gen]");
    await expect(page.locator("#kl-gen")).toContainText("tagihan dibuat");

    await page.locator("#klc-rooms").fill("500");
    await page.locator("#klc-rate").fill("100");
    await expect(page.locator("#klc-month")).toHaveText("Rp 425 jt");

    await page.click("#kl-demo");
    await expect(page).toHaveURL(/#kos-demo$/);
    await expect(page.locator(".kos-hero h1")).toHaveText("Demo KostBills");
    await page.goBack();
    await expect(page).toHaveURL(/#kos$/);
    await expect(page.locator(".kl-title")).toBeVisible();
    await page.goForward();
    await expect(page.locator(".kos-hero h1")).toHaveText("Demo KostBills");
    await page.click(".kos-back");
    await expect(page).toHaveURL(/#kos$/);
    expect(errors).toEqual([]);
  });

  test("demo: filters, Due Soon, Rp850.000 payment, overpayment rejected, WhatsApp reminder, CSV export", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#kos-demo");
    await expect(page.locator(".kpi-row").first()).toContainText("Total Terkumpul Tahun Ini");
    const stats = await page.evaluate(() => ({
      rooms: KOS.D.rooms.length,
      nonFlat: KOS.D.bills.filter((b) => KOS.total(b) !== 850000).length,
      overpaid: KOS.D.bills.filter((b) => b.paid > 850000).length,
    }));
    expect(stats).toEqual({ rooms: 1000, nonFlat: 0, overpaid: 0 });

    await page.click('[data-kv="bills"]');
    await expect(page.locator("#kb-mo")).toHaveCount(1);
    await expect(page.locator("#kb-year")).toHaveCount(1);
    await page.selectOption("#kb-status", "Due Soon");
    const pills = await page.locator("table.t tbody .pill").allInnerTexts();
    expect(pills.length).toBeGreaterThan(0);
    expect(new Set(pills)).toEqual(new Set(["Segera jatuh tempo"]));
    await expect(page.locator("table.t tbody .wa-ic").first()).toHaveAttribute("href", /^https:\/\/wa\.me\/6281224504181\?text=Halo/);

    await page.locator("[data-pay]").first().click();
    await expect(page.locator("#py-amt")).toHaveValue("850000");
    await page.fill("#py-amt", "900000");
    await page.click("#py-save");
    await expect(page.locator("#py-err")).toContainText("Sisa tagihan");
    await page.fill("#py-amt", "850000");
    await page.click("#py-save");
    await expect(page.locator(".toast")).toContainText("Rp 850.000");

    await page.selectOption("#kb-status", "");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click('[data-act="csv-bills"]')]);
    expect(download.suggestedFilename()).toMatch(/^kostbills-tagihan-.*\.csv$/);
    const csv = readFileSync(await download.path(), "utf8");
    expect(csv.split("\n")[0]).toContain("Invoice");

    const next = page.locator('[data-pager$=":1"]').first();
    await next.click();
    await expect(page.locator('[data-pager$=":-1"]').first()).toBeEnabled();

    for (const view of ["rooms", "tenants", "trx", "reports", "overview"]) {
      await page.click(`[data-kv="${view}"]`);
      await expect(page.locator(`[data-kv="${view}"]`)).toHaveAttribute("aria-current", /page|true/);
    }
    expect(errors).toEqual([]);
  });
});
