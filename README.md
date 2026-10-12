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
| **KostBills** (`#kos`) | A promotional landing page with an ID/EN language switch. It covers the hero, a live dashboard visual, room-class stats, interactive feature tabs, how it works, a revenue simulator, FAQ and WhatsApp contact. **Coba Demo KostBills** opens the demo. |
| **KostBills demo** (`#kos-demo`) | A billing dashboard for a 1,000-room boarding house, with an ID/EN switch. Each block has 10 **Premium** rooms (floor 3, rooms 16–25), 5 **Expensive** rooms (floor 4, rooms 21–25) and 85 **Regular** rooms, and every class pays the same flat rent. It covers tenants, room availability and room classes, monthly bills (flat Rp850.000 all-in, electricity on prepaid token), payment status (Paid, Partial, Unpaid, Due Soon, Overdue), transactions, revenue reports, month/year filters, CSV export, PDF invoices and reports, and one-click WhatsApp reminders. A back link returns to the landing page. |

Everything runs in the browser with no backend and no paid map APIs. SmartPark draws its map on a `<canvas>`. KostBills keeps its demo data in `localStorage`, so a reset restores a fresh dataset.

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
├── server/api/                 # PHP API for Hostinger: setup.php, auth.php, site.php (+ MySQL)
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
- the KostBills demo: filters, the Rp850.000 payment rule, overpayment rejection, WhatsApp reminders, CSV export and pagination

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

For later updates, upload `website-hostinger-update.zip` (or only `index.html`) and extract it over the old files.

## Notes

- Every WhatsApp button uses `profile.whatsapp` in `src/data/site.json` (currently `081224504181`). The local `08…` form is turned into `62…` for wa.me automatically. In the KostBills demo, reminders go to this number, not to the sample tenants.
- The SmartPark sensor feed is a simulation. Readings arrive with a short delay to mimic real ultrasonic sensors, but no hardware is involved.
- KostBills uses generated demo data. The names and phone numbers are fictional.
