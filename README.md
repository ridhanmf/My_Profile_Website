# Ridhan Firdaus — Portfolio

A personal portfolio for **Ridhan Firdaus**, an IT graduate working across data analysis, network operations (NOC), web development and AI. Everything lives under one domain.

The navbar has three entries: **Home**, **MyCollection** and **Project**. Project opens a menu with SmartPark and KostBills. Both project pages have a 🇮🇩 ID / 🇬🇧 EN switch. The choice updates the page in place, is shared by SmartPark and KostBills, and is remembered in the browser.

| Page | What it is |
|---|---|
| **Home** (`#home`) | Introduction, roles (Data Analyst · NOC Engineer · Web Developer · AI Engineer), skills, contacts and four project cards: YourMajor Recommendation, Sneaker Analyst, Flight Price Prediction and Car Logo Prediction. |
| **My Collection** (`#collection`) | A diecast car garage. Visitors can browse, search and filter, and each car has a WhatsApp "buy" button. The admin can add, edit and delete cars with photos, brand, scale, condition and price. |
| **SmartPark** (`#smartpark`) | An IoT smart-parking demo for a two-level mall basement with 50 slots per level. You enter at the gate, pay with QRIS, then auto-park or drag a car onto a slot. A car can drive B1 → ramp → B2 → ramp → B1 → exit. Traffic keeps left, as in Indonesia, and slot sensors are simulated with a short delay. A **background dropdown** offers four looks, and the choice is remembered:
  - **Modern** (navy).
  - **Tradisional**: a subtle batik kawung pattern with a tumpal border.
  - **Redline**: red and blue light lines.
  - **Cyber Mix**: a violet, cyan and magenta tech mesh. |
| **KostBills** (`#kos`) | A promotional landing page with an ID/EN language switch. It covers the hero, a live dashboard visual, room-class stats, interactive feature tabs, how it works, a revenue simulator, FAQ and WhatsApp contact. **Coba Demo KostBills** opens the role picker. |
| **Role picker** (`#kos-role`) | Try **Admin**, **Management** or **Pengunjung Demo** without a password on the demo's sample data (Admin can change it, Management sees overview/bills/reports, the visitor only looks). On Hostinger each Admin/Management card also has a password sign-in for live data, enforced by the API. |
| **KostBills demo** (`#kos-demo`) | The no-password demo roles (Admin editable, Management and visitor read-only): a billing dashboard for a 1,000-room boarding house, with an ID/EN switch. Each block has 10 **Premium** rooms (floor 3, rooms 16–25), 5 **Expensive** rooms (floor 4, rooms 21–25) and 85 **Regular** rooms, and every class pays the same flat rent. It covers tenants, room availability and room classes, monthly bills (flat Rp850.000 all-in, electricity on prepaid token), payment status (Paid, Partial, Unpaid, Due Soon, Overdue), transactions, revenue reports, month/year filters, CSV export, PDF invoices and reports, the tenant-phone preview and WhatsApp reminder previews. Its sample data lives only in the browser and is never mixed with live data. |
| **KostBills dashboard** (`#kos-app`) | Live data in MySQL for Admin and Management: everything in the demo plus check-in/check-out, room prices per class, the profit model (Rp5.000 commission or markup), 1/6/12-month payments with discounts, payment links (PayPro adapter, simulation until configured), webhooks, WhatsApp bills and reminders (simulation or WhatsApp Cloud API), tenant archive, users and an audit log. |

SmartPark and the KostBills demo run entirely in the browser with no backend and no paid map APIs. SmartPark draws its map on a `<canvas>`. The KostBills demo keeps its sample data in `localStorage`. The KostBills Admin/Management dashboard needs the PHP + MySQL API in `server/api` (Hostinger).

## Tech

- Plain HTML, CSS and JavaScript (ES2020). No framework and no runtime dependencies.
- A small Node build script bundles everything into one self-contained `dist/index.html`. CSS, JS, data and images are all inlined.
- Hash routing, CSS custom-property theming (Auto/Light/Dark) and a responsive layout down to 360 px.
- Canvas 2D for the SmartPark map. It uses Dijkstra routing over a lane graph plus pure-pursuit steering.
- WebCrypto PBKDF2-SHA256 for the admin login.
- jsPDF 2.5.1, loaded on demand from cdnjs, for the KostBills PDFs.
- Tests use `node:test` for the unit tests and Playwright for the end-to-end tests.

## Project structure

```
.
├── src/
│   ├── main.js                 # boot()
│   ├── lib/                    # utils (DOM, format, storage, icons), ui (toast, modal), illustrations
│   ├── core/                   # site-data, platform (hosting mode, downloads, theme), admin (auth), router
│   ├── engine/                 # smartpark.js, kostbills.js — pure logic, unit-tested
│   ├── pages/                  # home, collection, smartpark, kostbills — rendering + interaction
│   ├── styles/                 # 00-tokens-base … 99-print-motion (concatenated in name order)
│   ├── data/site.json          # profile, projects, contacts, collection (editable content)
│   ├── assets/images/          # portrait, SmartPark hero, project thumbnails
│   └── templates/document-head.html
├── server/api/                 # PHP API for Hostinger (+ MySQL): setup, auth, site, kos (KostBills),
│                               #   pay.php (payment page), webhook.php (gateway callbacks), cron.php (daily job),
│                               #   _kos.php (billing rules), _gateways.php (PayPro / WhatsApp drivers)
├── scripts/
│   ├── build.mjs               # src → dist/index.html
│   ├── package-hostinger.mjs   # dist/hostinger/*.zip (index.html + api/) for PHP + MySQL hosting
│   ├── set-admin.mjs           # .env → src/data/admin-auth.json (hash only, git-ignored)
│   └── serve.mjs               # static server for dist/
├── tests/
│   ├── unit/                   # SmartPark + KostBills engine tests
│   ├── e2e/site.spec.mjs       # Playwright: routes, admin, SmartPark flow, KostBills flow
│   ├── e2e/server.spec.mjs     # Playwright: Hostinger mode (page + PHP API on PHP's built-in server)
│   ├── server/api.test.mjs     # PHP API: setup, sign-in, CSRF, lockout, saving, conflicts
│   ├── server/kos.test.mjs     # KostBills API: roles, billing, profit models, webhooks, WhatsApp, checkout, prepay
│   └── fixtures/admin-auth.json  # TEST-ONLY credential hash (user "e2e-admin")
├── .env.example
└── playwright.config.mjs
```

## Run locally

You need **Node.js 22 or newer**.

```bash
git clone https://github.com/ridhanmf/my_profile_website.git
cd my_profile_website
git checkout portfolio-v2

# 1. (optional) set the admin login
cp .env.example .env          # then fill in ADMIN_USERNAME and ADMIN_PASSWORD
npm run set-admin             # writes src/data/admin-auth.json (salted hash, git-ignored)

# 2. build and serve
npm start                     # builds dist/index.html and serves it at http://localhost:4173
```

`npm run build` only builds the page. Because `dist/index.html` is fully self-contained, you can also open it straight from disk.

Without step 1 the site works normally, but the footer's **Admin login** will report that admin sign-in isn't set up.

## Admin and editing content

There are two ways to change the content:

- **Edit `src/data/site.json`** for the profile, roles, skills, contacts, projects, background images and cars, then run `npm run build`. Images can be paths under `src/assets/` (for example `"assets/images/portrait.jpg"`) and are inlined at build time.
- **Use the in-page admin.** Sign in from **Admin login** in the footer, then edit the profile, projects and collection directly on the page. On a static host such as GitHub Pages or a local server, **Export site data** downloads a `site.json` file. Replace `src/data/site.json` with it, rebuild and commit. Images you didn't change are turned back into their asset paths. Credentials are never included in the export.

### How the login is protected

- The password is never stored. `npm run set-admin` writes a salted **PBKDF2-SHA256 hash** (310,000 iterations) to `src/data/admin-auth.json`. That file and `.env` are both git-ignored.
- After 5 wrong attempts, sign-in locks for 5 minutes. A session ends after 30 minutes without activity.
- The built page contains the hash, so anyone can read it from the page source. Use a long, unique password.
- On a static host, the login only unlocks the editor in your own browser. Changing the live site still requires push access to this repository.
- When the page is hosted as a Claude artifact, publishing is also checked server-side and only the artifact's owner or editors can publish.

## Tests

```bash
npm run test:unit    # node:test — SmartPark routing/keep-left/ramps, KostBills billing rules
npm run test:e2e     # Playwright (first time: npx playwright install chromium)
npm test             # both
```

The end-to-end tests build a separate copy of the page using the **test-only** credentials in `tests/fixtures/` and serve it on port 4174. They cover:

- every route on desktop and mobile, with no console errors and no horizontal scroll
- the navbar and its Project menu (desktop and mobile, Escape and outside click), and the theme switch
- admin sign-in, a rejected wrong password, lockout, adding a car, the WhatsApp link and exporting `site.json`
- artifact-mode publishing, including a byte-for-byte self-rebuild check
- the full SmartPark journey, the background dropdown (all four looks), the hero facts and the ID/EN switch, which keeps the running simulation
- the KostBills landing page: ID/EN switch, room-class stats, FAQ, feature tabs, revenue simulator, WhatsApp links, Coba Demo and back navigation
- the KostBills demo in both languages, including room classes and filters
- the KostBills demo visitor role: read-only (no payment, check-in or generate controls, even through a crafted call), filters, WhatsApp previews, CSV export and pagination, and exporting a tenant registered earlier in that browser
- Hostinger mode KostBills: Admin imports the test tenant, bills, sends WhatsApp (simulation), opens a payment link (nothing changes), simulated callback marks it paid, 6/12-month quotes, markup model, management account, checkout and a clean next tenant; Management sees only its four sections and gets 403 from the API; the demo visitor never calls the live API and the demo role can be switched off

`tests/server/kos.test.mjs` runs the KostBills API on PHP's built-in server with SQLite and covers the seven required scenarios plus long-term payments (see "KostBills: roles, payments and WhatsApp" below).

## Deploying

The output is a single static file, `dist/index.html`, and any static host works.

- **GitHub Pages:** build to `docs/` with `npm run build -- --out docs/index.html`, commit it, then set Pages to *Deploy from branch → `/docs`*. If you want the admin login on the live site, run `npm run set-admin` before building.
- **Netlify / Vercel / Cloudflare Pages:** use the build command `npm run build` and the output directory `dist`.

### Hostinger (PHP + MySQL): admin edits saved straight to the live site

`npm run build:hostinger` creates `dist/hostinger/`. The folder contains:

- `website-hostinger-install.zip`, for the first install. It holds `index.html`, the `api/` folder and an `api/config.php` with a freshly generated setup token.
- `website-hostinger-update.zip`, for later updates. It holds the same files except `config.php` and `setup.php`, so your database settings are never overwritten.

In this mode the page loads its content from MySQL through `api/site.php`. **Save changes** in the admin writes to the database straight away, with no rebuild or re-upload. The login is checked by PHP (`password_hash`), and the admin session is an HttpOnly cookie protected by a CSRF token. After 5 failed sign-ins from an IP, sign-in is locked for 5 minutes. A save from an out-of-date tab is refused rather than overwriting newer content.

First install on Hostinger:

1. In hPanel go to **Databases → MySQL Databases** and create a database and a user. Note the database name, the user and the password.
2. Upload `website-hostinger-install.zip` to `public_html` and extract it. You should end up with `public_html/index.html` and `public_html/api/`.
3. In File Manager, open `public_html/api/config.php` and fill in `db_name`, `db_user` and `db_pass`. Keep `db_host` as `localhost`. Leave the `setup_token` as generated.
4. Open `https://your-domain/api/setup.php`, enter the setup token from `config.php`, then choose the admin username and password (at least 10 characters).
5. Delete `api/setup.php`. Then open the site and use **Admin login** in the footer.

For later updates, upload `website-hostinger-update.zip` (or only `index.html`) and extract it over the old files. New KostBills tables are created automatically the first time the dashboard or API is used; nothing is deleted.

## KostBills: roles, payments and WhatsApp

### Roles

| Role | Sign-in | Can see | Can change |
|---|---|---|---|
| Admin | password (`kb_admins`, `password_hash`) | everything | everything (rooms, tenants, prices, bills, payments, users, settings) |
| Management | password | overview, monthly bills, revenue reports, profit | nothing: every write endpoint returns 403 |
| Pengunjung Demo | none | the demo with sample data | nothing; there is no server behind the demo |
| Admin / Management (demo) | none | the demo with sample data (Management: overview, bills, reports) | Admin demo: sample data in that browser only, never live data |

The first Admin is created by `api/setup.php`. Further Admin and Management accounts are created by an Admin under **Pengguna** (passwords of 10+ characters, stored hashed; no default passwords). The demo roles (visitor, Admin demo, Management demo) can be switched off under **Pengaturan → Mode demo** or forced off with `KOS_DEMO_ENABLED=0`.

### Billing rules

- Every bill belongs to one **tenant** and covers whole months. `kos_bill_months (tenant_id, period)` is a primary key, so a month can be billed only once per tenant, whether by a monthly bill or a prepayment. **Generate Tagihan** and the daily cron are safe to run again.
- Due day = the move-in day. The first bill starts in the move-in month, or the current month for someone who moved in before the system was used.
- Each bill stores `base_price`, `markup`, `sale_price`, `subtotal`, `discount_bp`, `discount_amount`, `total`, `profit_model` and `profit`. Changing prices or the model only affects new bills.
- **Profit model A (commission):** rooms are billed at the base price; when a month is paid, one `kos_commissions` row (default Rp5.000) is written per tenant per month (unique, so never twice).
- **Profit model B (markup):** sale price = base + markup per class (e.g. Regular Rp850.000 + Rp5.000 = Rp855.000); `profit` = markup × months. Markup is a setting and never changes `kos_room_types.base_price`.
- **Long-term payment:** 1, 6 or 12 months from the first month not billed yet. Total = sale price × months − admin discount (6 and 12 months, default 0%, max 50%). Regular Rp850.000 → 6 months Rp5.100.000, 12 months Rp10.200.000. A verified payment extends `paid_until`; prepaid months are never billed again.
- **Checkout:** the tenant becomes inactive (`active_room` NULL frees the room), unpaid bills for later months are cancelled, the tenant's bills stay attached to them (archive, reports, audit) and never appear for the next tenant. Prepaid months after move-out are reported with the admin's refund policy; nothing is refunded automatically.
- Every price change, setting change, bill, payment, WhatsApp send, checkout and user change goes to `kos_audit`. Changes run in database transactions; amounts and inputs are validated on the server.

### Payments (PayPro) and the webhook

- One active payment link per bill, for the full remaining balance: `https://DOMAIN/api/pay.php?t=<random token>`. Opening it never changes anything.
- A bill becomes **Lunas** only through `api/webhook.php?gateway=…` after the gateway driver verifies the signature. Statuses: pending, success, failed, expired. A success is never downgraded, the amount must match the link, a repeated delivery is processed once, and money arriving for a bill that is already paid is recorded and flagged instead of counted twice.
- `PAYMENT_DRIVER=simulation` (default): no money moves. The pay page says so; an Admin can send a signed test callback from **Pembayaran online**.
- `PAYMENT_DRIVER=paypro`: **not active yet.** I couldn't find public API documentation for a PayPro gateway that serves Indonesia (the "PayPro" gateways found are PayPro Pakistan and PayPro Global). The adapter in `server/api/_gateways.php` (`kos_paypro_create_checkout`, `kos_paypro_verify`) has the contract written out; fill both in from the documentation PayPro gives you with your merchant account, set `KOS_PAYPRO_ADAPTER_IMPLEMENTED = true`, set `PAYPRO_API_BASE`, `PAYPRO_MERCHANT_ID`, `PAYPRO_API_KEY`, `PAYPRO_WEBHOOK_SECRET`, register `https://DOMAIN/api/webhook.php?gateway=paypro` as the callback URL, and test in PayPro's sandbox first. Until then the webhook answers 501 and links can't be created with that driver.

### WhatsApp

- `WA_DRIVER=simulation` (default): messages are written to `kos_wa_messages` with status `simulated` and nothing is sent. From the log the Admin can open a message in WhatsApp by hand.
- `WA_DRIVER=cloud_api`: the official WhatsApp Business Cloud API (Meta). Set `WA_CLOUD_TOKEN` and `WA_PHONE_NUMBER_ID`. Messages to tenants who haven't written in the last 24 hours need an approved template: set `WA_TEMPLATE_NAME` (and `WA_TEMPLATE_LANG`, default `id`) for a template whose body has 7 variables in this order: name, room, period, amount, due date, status, payment link. Without credentials the driver falls back to simulation. Not tested against Meta's live API from this project.
- A message goes out when a bill is created (if enabled), then at the configured days before and after the due date (default H-7, H-3, H-1, H+1, H+3, H+7). Each automatic message is sent at most once per bill (`dedupe` key); **Kirim Ulang WhatsApp** is a deliberate resend, limited to once a minute per bill.
- A tenant without a valid number is listed under **Otomatisasi → Perlu dikonfigurasi**. Numbers are never guessed.

### Daily job

hPanel → Advanced → Cron Jobs, once a day (for example 07:00): `php /home/USER/domains/DOMAIN/public_html/api/cron.php`. It expires old links, creates the current month's bills and sends due reminders. Alternatively call `https://DOMAIN/api/cron.php?key=CRON_KEY` with a 24+ character `CRON_KEY`.

### Environment variables

Set them as real environment variables or in `api/config.php` → `'env'` (git-ignored, blocked from the web). See `server/api/config.example.php`.

| Variable | Purpose |
|---|---|
| `PUBLIC_BASE_URL` | Site address used in payment links (otherwise learned from the Admin's browser) |
| `CRON_KEY` | Secret for `cron.php?key=` |
| `KOS_DEMO_ENABLED` | `0` forces the demo role off |
| `PAYMENT_DRIVER` | `simulation` or `paypro` |
| `PAYPRO_API_BASE`, `PAYPRO_MERCHANT_ID`, `PAYPRO_API_KEY`, `PAYPRO_WEBHOOK_SECRET` | PayPro credentials |
| `SIM_WEBHOOK_SECRET` | Optional secret for simulated callbacks (otherwise random, kept in the database) |
| `WA_DRIVER` | `simulation` or `cloud_api` |
| `WA_CLOUD_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_API_VERSION`, `WA_TEMPLATE_NAME`, `WA_TEMPLATE_LANG` | WhatsApp Cloud API |

### Database tables

Added: `kos_settings`, `kos_room_types`, `kos_rooms` (1,000 rooms seeded empty), `kos_tenants`, `kos_bills`, `kos_bill_months`, `kos_payments`, `kos_webhook_events`, `kos_commissions`, `kos_wa_messages`, `kos_audit`. Changed: `kb_admins` gets a `role` column (`admin` or `management`; existing accounts become `admin`).

### Test tenant from the demo

A tenant someone registered by hand in an older version of the demo exists only in that browser's `localStorage`, not in any database. **Otomatisasi → Penghuni uji dari demo** reads it automatically in the same browser; from another browser, use **Penghuni → Ekspor untuk Admin** in the demo and choose the file. Missing data (such as the WhatsApp number) is shown instead of guessed.

## Notes

- Every WhatsApp button uses `profile.whatsapp` in `src/data/site.json` (currently `081224504181`). The local `08…` form is turned into `62…` for wa.me automatically. In the KostBills demo, reminders go to this number, not to the sample tenants.
- The SmartPark sensor feed is a simulation. Readings arrive with a short delay to mimic real ultrasonic sensors, but no hardware is involved.
- KostBills uses generated demo data. The names and phone numbers are fictional.
