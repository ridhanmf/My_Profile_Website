#!/usr/bin/env node
/**
 * Bundles src/ into one self-contained page: dist/index.html.
 *
 * The page is a single file on purpose: in admin mode it can rebuild itself from its own
 * <style id="site-css">, <script id="site-js"> and <script id="site-data"> blocks
 * (see src/core/platform.js -> buildDocument), so the layout here must stay in sync with that.
 *
 * Usage: node scripts/build.mjs [--out dist/index.html] [--auth src/data/admin-auth.json] [--fragment]
 *   --auth      admin credential hash file (default: $ADMIN_AUTH_FILE or src/data/admin-auth.json)
 *   --fragment  omit the document head/tail (for hosts that wrap the page in their own skeleton)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const OUT = resolve(ROOT, opt("--out", "dist/index.html"));
const AUTH_FILE = resolve(ROOT, opt("--auth", process.env.ADMIN_AUTH_FILE || "src/data/admin-auth.json"));
const FRAGMENT = args.includes("--fragment");

/* Script order matters: helpers first, then data, platform, admin, router, engines, pages, boot. */
const JS_FILES = [
  "lib/utils.js", "core/site-data.js", "lib/ui.js", "core/platform.js", "core/admin.js", "core/router.js",
  "lib/illustrations.js", "engine/smartpark.js", "engine/kostbills.js",
  "pages/home.js", "pages/collection.js", "pages/smartpark.js", "pages/kostbills.js", "main.js",
];

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800;900&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">';
const PAGE_PREFIX = "<title>__TITLE__</title>" + FONTS;
const SKELETON_HEAD = readFileSync(join(SRC, "templates/document-head.html"), "utf8"); // used verbatim (incl. final newline)
const TAIL = "\n</body></html>";

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fail = (msg) => { console.error("build: " + msg); process.exit(1); };

/* 1. Styles: every file in src/styles, in name order (00-, 10-, … 99-). */
const css = readdirSync(join(SRC, "styles")).filter((f) => f.endsWith(".css")).sort()
  .map((f) => readFileSync(join(SRC, "styles", f), "utf8").trim()).join("\n\n") + "\n";

/* 2. Scripts, with the two document constants filled in. */
let js = JS_FILES.map((f) => readFileSync(join(SRC, f), "utf8").trim()).join("\n\n") + "\n";
for (const [k, v] of [["__SKELETON_HEAD__", SKELETON_HEAD], ["__PAGE_PREFIX__", PAGE_PREFIX]]) {
  if (!js.includes(`"${k}"`)) fail(`placeholder ${k} not found in scripts`);
  js = js.replace(`"${k}"`, () => JSON.stringify(v));
}

/* 3. Data: inline every "assets/…" image path as a data URI and remember where it came from,
      so an exported site.json can turn untouched images back into paths. */
const data = JSON.parse(readFileSync(join(SRC, "data/site.json"), "utf8"));
delete data.auth;
data.assetSources = {};
(function inline(node, ptr) {
  for (const k of Object.keys(node)) {
    const v = node[k], p = ptr ? `${ptr}.${k}` : k;
    if (typeof v === "string" && /^assets\/[\w./-]+$/.test(v)) {
      const file = join(SRC, v), type = MIME[extname(v).toLowerCase()];
      if (!type) fail(`unsupported asset type: ${v}`);
      if (!existsSync(file)) fail(`missing asset: src/${v} (referenced at ${p})`);
      node[k] = `data:${type};base64,` + readFileSync(file).toString("base64");
      data.assetSources[p] = v;
    } else if (v && typeof v === "object" && k !== "assetSources") inline(v, p);
  }
})(data, "");

/* 4. Admin credential hash (never committed). Without it, admin sign-in reports "not set up". */
if (existsSync(AUTH_FILE)) {
  const a = JSON.parse(readFileSync(AUTH_FILE, "utf8"));
  if (!a.salt || !a.hash || !a.iter) fail(`${AUTH_FILE} is not a credential file (run npm run set-admin)`);
  data.auth = { alg: a.alg || "PBKDF2-SHA256", iter: a.iter, salt: a.salt, hash: a.hash };
} else {
  console.warn("build: no admin credential file found; admin sign-in will be disabled. Run `npm run set-admin`.");
}

/* 5. Safety: nothing in the inline blocks may close its own tag early. */
if (/<\/script|<!--/i.test(js)) fail("unsafe sequence (</script or <!--) in scripts");
if (/<\/style|<\/script|<!--/i.test(css)) fail("unsafe sequence in styles");

const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));
const body =
  PAGE_PREFIX.replace("__TITLE__", esc((data.profile && data.profile.name) || "Portfolio")) +
  `<style id="site-css">${css}</style>` +
  `<div id="app"></div>` +
  `<script type="application/json" id="site-data">${json}</script>` +
  `<script id="site-js">${js}</script>`;
const html = FRAGMENT ? body : SKELETON_HEAD + body + TAIL;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`build: ${OUT.replace(ROOT + "/", "")} ${(html.length / 1024).toFixed(0)} KB · admin ${data.auth ? "enabled" : "disabled"}`);
