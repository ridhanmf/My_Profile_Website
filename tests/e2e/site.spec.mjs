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
  for (const route of ["home", "collection", "smartpark", "kos", "kos-demo", "kos-role", "kos-app"]) {
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

  test("background dropdown: Modern, Tradisional, Redline, Cyber Mix — applied, remembered, map keeps working", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#smartpark");
    const opts = await page.locator("#sp-theme option").evaluateAll((os) => os.map((o) => o.value));
    expect(opts).toEqual(["modern", "tradisional", "redline", "cyber"]);
    await expect(page.locator("#sp-theme")).toHaveValue("modern");
    const look = () => page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, img: getComputedStyle(document.body).backgroundImage, map: SP.colors().asphalt, ink: getComputedStyle(document.body).color }));
    const modern = await look();
    const expected = { tradisional: "#2a2126", redline: "#151926", cyber: "#17143a" };
    for (const [t, asphalt] of Object.entries(expected)) {
      await page.selectOption("#sp-theme", t);
      await expect(page.locator("body")).toHaveAttribute("data-sp-theme", t);
      const l = await look();
      expect(l.bg).not.toBe(modern.bg);
      expect(l.map).toBe(asphalt);
      expect(l.img).not.toBe("none");
    }
    await page.reload();
    await expect(page.locator("#sp-theme")).toHaveValue("cyber");
    await expect(page.locator("body")).toHaveAttribute("data-sp-theme", "cyber");
    await page.click("#sp-enter");
    await expect(page.locator("#sp-sel")).toContainText("Menunggu di gerbang");
    await page.click('.nav > a[data-route="home"]');
    await expect(page.locator("body")).not.toHaveAttribute("data-sp-theme", /.+/);
    await page.goBack();
    await expect(page.locator("#sp-theme")).toHaveValue("cyber");
    expect(errors).toEqual([]);
  });

  test("hero facts: 2 basement, 100 sensor slots, EV · Wanita · VIP (no Lajur kiri)", async ({ page }) => {
    await page.goto("/#smartpark");
    const facts = page.locator(".sp-hero-facts span");
    await expect(facts).toHaveCount(3);
    await expect(page.locator(".sp-hero-facts")).not.toContainText("Lajur kiri");
    await expect(page.locator(".sp-hero-facts")).toContainText("100 slot bersensor");
  });

  test("ID/EN switch updates the page in place and keeps the simulation", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#smartpark");
    await page.click("#sp-enter");
    await expect(page.locator("#sp-sel")).toContainText("Menunggu di gerbang");
    const carId = await page.evaluate(() => PAGES.smartpark.sel);
    await page.click('.sp-hero [data-setlang="en"]');
    await expect(page.locator('.sp-hero [data-setlang="en"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".sp-hero p")).toContainText("SmartPark is mall parking navigation");
    await expect(page.locator("#sp-sel")).toContainText(`Car #${carId}`);
    await expect(page.locator("#sp-sel")).toContainText("Waiting at the gate");
    await expect(page.locator("#sp-enter")).toContainText("Enter mall");
    await expect(page.locator("#sp-log")).toContainText(`Car #${carId} waiting at the mall entry gate`);
    await expect(page.locator(".sp-hero-facts")).toContainText("EV · Ladies · VIP");
    expect(await page.evaluate(() => PAGES.smartpark.sel)).toBe(carId);
    await page.click('[data-flow="scan"]');
    await expect(page.locator(".modal")).toContainText("Scan QRIS at the gate");
    await page.click("#qris-ok");
    await page.click("#nav-proj");
    await expect(page.locator("#nav-menu")).toContainText("Mall parking navigation");
    await page.click('#nav-menu a[data-route="kos"]');
    await expect(page.locator(".kl-title")).toContainText("Billing for 1,000 rooms");
    await page.goBack();
    await expect(page.locator(".sp-hero p")).toContainText("SmartPark is mall parking navigation");
    await page.click('.sp-hero [data-setlang="id"]');
    await expect(page.locator(".sp-hero p")).toContainText("SmartPark adalah navigasi parkir mal");
    expect(errors).toEqual([]);
  });
});

test.describe("KostBills", () => {
  test("landing page: language switch, feature tabs, simulator, WhatsApp, Coba Demo and back", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#kos");
    await expect(page.locator(".kl-title")).toContainText("Tagihan 1.000 kamar kos");
    await expect(page.locator("#kl-demo")).toHaveText(/Coba Demo KostBills/);
    const stats = page.locator(".kl-stats");
    await expect(stats).not.toContainText("kamar dikelola");
    await expect(stats).not.toContainText("blok × 4 lantai");
    await expect(stats).not.toContainText("tarif flat");
    await expect(stats.locator("b[data-count]")).toHaveCount(5);
    expect(await stats.locator("b[data-count]").evaluateAll((bs) => bs.slice(0, 3).map((b) => b.dataset.count))).toEqual(["850", "100", "50"]);
    await expect(page.locator(".kl-faq details")).toHaveCount(3);
    await expect(page.locator(".kl-faq")).not.toContainText(/listrik ikut ditagihkan|electricity billed/i);
    await page.click('.kl-hero [data-setlang="en"]');
    await expect(page.locator(".kl-title")).toContainText("Billing for 1,000 rooms");
    await expect(page.locator("#kl-demo")).toHaveText(/Try the KostBills Demo/);
    await page.reload();
    await expect(page.locator(".kl-title")).toContainText("Billing for 1,000 rooms");
    await page.click('.kl-hero [data-setlang="id"]');
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

    // "Coba Demo KostBills" opens the role picker first
    await page.click("#kl-demo");
    await expect(page).toHaveURL(/#kos-role$/);
    await expect(page.locator(".kos-hero h1")).toHaveText("Pilih peran");
    await expect(page.locator(".role-card")).toHaveCount(3);
    await expect(page.locator('[data-role-card="admin"] .role-off')).toContainText("memerlukan server"); // no PHP behind this static build
    await expect(page.locator('[data-role-card="management"] .role-off')).toHaveCount(1);
    await page.click("#role-visitor");
    await expect(page).toHaveURL(/#kos-demo$/);
    await expect(page.locator(".kos-hero h1")).toHaveText("Demo KostBills");
    await expect(page.locator(".demo-note")).toContainText("Pengunjung Demo · hanya lihat");
    await page.goBack();
    await expect(page).toHaveURL(/#kos-role$/);
    await page.goBack();
    await expect(page).toHaveURL(/#kos$/);
    await expect(page.locator(".kl-title")).toBeVisible();
    await page.goForward();
    await expect(page.locator(".kos-hero h1")).toHaveText("Pilih peran");
    await page.click(".kos-back");
    await expect(page).toHaveURL(/#kos$/);
    expect(errors).toEqual([]);
  });

  test("demo visitor: read-only — filters, Due Soon, WhatsApp preview, CSV, but no way to change data", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#kos-demo");
    await expect(page.locator(".kpi-row").first()).toContainText("Total Terkumpul Tahun Ini");
    const stats = await page.evaluate(() => ({
      rooms: KOS.D.rooms.length,
      nonFlat: KOS.D.bills.filter((b) => KOS.total(b) !== 850000).length,
      overpaid: KOS.D.bills.filter((b) => b.paid > 850000).length,
    }));
    expect(stats).toEqual({ rooms: 1000, nonFlat: 0, overpaid: 0 });
    await expect(page.locator('[data-act="reset-demo"]')).toHaveCount(0);
    await expect(page.locator("#kos-nav .kn-role")).toHaveAttribute("href", "#kos-role");

    await page.click('[data-kv="bills"]');
    await expect(page.locator("#kb-mo")).toHaveCount(1);
    await expect(page.locator("#kb-year")).toHaveCount(1);
    await page.selectOption("#kb-status", "Due Soon");
    const pills = await page.locator("table.t tbody .pill").allInnerTexts();
    expect(pills.length).toBeGreaterThan(0);
    expect(new Set(pills)).toEqual(new Set(["Segera jatuh tempo"]));
    await expect(page.locator("table.t tbody .wa-ic").first()).toHaveAttribute("href", /^https:\/\/wa\.me\/6281224504181\?text=Halo/);
    await expect(page.locator("[data-pay]")).toHaveCount(0);
    await expect(page.locator('[data-act^="gen:"]')).toHaveCount(0);

    // even a crafted call can't change the demo data in this role
    const before = await page.evaluate(() => KOS.D.bills.length);
    await page.evaluate(() => PAGES["kos-demo"].act("gen", KOS.addMonths(KOS.months()[0], 1)));
    expect(await page.evaluate(() => KOS.D.bills.length)).toBe(before);

    await page.click('[data-kv="rooms"]');
    await page.locator(".room.occ").first().click();
    await expect(page.locator(".modal")).toContainText("hanya bisa melihat");
    await expect(page.locator('.modal [data-act^="checkout"], .modal #ci-form')).toHaveCount(0);
    await page.click(".modal [data-close]");
    await page.click('[data-kv="bills"]');

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

  test("demo: no fact cards, room classes, and the ID/EN switch translates everything", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#kos-demo");
    await expect(page.locator(".kos-facts")).toHaveCount(0);
    await expect(page.locator(".kos-hero")).not.toContainText("sudah termasuk semua");
    await page.click('[data-kv="rooms"]');
    const cards = page.locator(".class-card");
    await expect(cards).toHaveCount(3);
    expect(await cards.locator("b").allInnerTexts()).toEqual(["850", "100", "50"]);
    await expect(page.locator(".room.t-premium")).toHaveCount(10);
    await expect(page.locator(".room.t-expensive")).toHaveCount(5);
    await page.selectOption("#kr-type", "Expensive");
    await page.click('[data-rmode="table"]');
    await page.click('[data-rblock=""]');
    await expect(page.locator(".pager")).toContainText("1–50 dari 50");
    await expect(page.locator("table.t tbody .rtype").first()).toHaveText("Expensive");

    await page.click('.kos-hero [data-setlang="en"]');
    await expect(page.locator(".kos-hero h1")).toHaveText("KostBills Demo");
    await expect(page.locator(".kos-back")).toContainText("Back to the KostBills page");
    await expect(page.locator("#kos-nav")).toContainText("Monthly bills");
    await expect(page.locator(".pager")).toContainText("1–50 of 50");
    await expect(page.locator("#kr-type")).toHaveValue("Expensive");
    await page.click('[data-kv="bills"]');
    await page.selectOption("#kb-status", "Due Soon");
    expect(new Set(await page.locator("table.t tbody .pill").allInnerTexts())).toEqual(new Set(["Due soon"]));
    await expect(page.locator("[data-pay]")).toHaveCount(0);
    await expect(page.locator(".demo-note")).toContainText("Demo visitor · view only");
    await page.click('[data-kv="overview"]');
    await expect(page.locator(".kpi-row").first()).toContainText("Total Collected This Year");
    await page.reload();
    await expect(page.locator(".kos-hero h1")).toHaveText("KostBills Demo");
    await page.click('.kos-hero [data-setlang="id"]');
    await expect(page.locator(".kos-hero h1")).toHaveText("Demo KostBills");
    expect(errors).toEqual([]);
  });

  test("tenant phone simulation: H-7 reminder as the tenant sees it", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#kos-demo");
    await page.click('[data-kv="bills"]');
    await page.selectOption("#kb-status", "Due Soon");
    const sevenDays = await page.evaluate(() => KOS.D.bills.find((b) => KOS.status(b) === "Due Soon" && KOS.daysUntil(b.due) === 7 && b.month === KOS.ym(new Date())));
    test.skip(!sevenDays, "no bill is exactly 7 days from its due date today");
    await page.fill("#kb-q", sevenDays.roomId);
    await page.locator(`[data-phone="${sevenDays.id}"]`).click();
    await expect(page.locator(".modal")).toContainText("Tampilan di HP penghuni");
    await expect(page.locator(".modal .pill").first()).toContainText("H-7");
    await expect(page.locator(".tp-msg").first()).toContainText("jatuh tempo 7 hari lagi");
    await expect(page.locator(".tp-card")).toContainText(sevenDays.id);
    await expect(page.locator(".modal a.btn.wa")).toHaveAttribute("href", /^https:\/\/wa\.me\/6281224504181\?text=Halo/);
    await expect(page.locator(".modal #tp-pay")).toHaveCount(0); // visitors can't record payments
    expect(errors).toEqual([]);
  });

  test("demo: a tenant the visitor registered earlier in this browser can be exported for the Admin", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/#kos-demo");
    // Recreate what an earlier version of the demo allowed: a hand-made check-in kept in this browser.
    await page.evaluate(() => { const r = KOS.D.rooms.find((x) => x.status === "Vacant"); KOS.checkIn(r, { name: "Penghuni Uji E2E", phone: "0812-0000-0099", job: "Tester", date: KOS.today() }); });
    await page.waitForTimeout(500);
    await page.reload();
    await page.click('[data-kv="tenants"]');
    await expect(page.locator(".mine-panel")).toContainText("Penghuni Uji E2E");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click('[data-act="export-mine"]')]);
    expect(download.suggestedFilename()).toBe("kostbills-penghuni-saya.json");
    const data = JSON.parse(readFileSync(await download.path(), "utf8"));
    expect(data.kind).toBe("kostbills-tenants");
    expect(data.tenants.map((t) => [t.name, t.phone])).toEqual([["Penghuni Uji E2E", "0812-0000-0099"]]);
    expect(errors).toEqual([]);
  });
});
