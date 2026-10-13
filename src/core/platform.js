/* ---------- Capabilities (owner admin + self-publish + downloads) ----------
   Two hosting modes share one codebase:
   - artifact:   hosted as a Claude artifact; window.claude provides user/artifact/downloads and the
                 owner publishes edits straight to the live page.
   - standalone: any static host (GitHub Pages, local server). Admin edits are exported as
                 site.json and committed to src/data/ before rebuilding. */
const STANDALONE = !(window.claude && typeof window.claude.use === "function");
/* Server mode (e.g. Hostinger with PHP + MySQL): the build sets API_BASE (like "api/"). Content is
   then loaded from and saved to the database through the PHP API in server/api. */
const API_BASE = "__API_BASE__";
const SERVER = STANDALONE && !!API_BASE;
async function api(path, { method = "GET", json } = {}) {
  const headers = { Accept: "application/json" };
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const csrf = KSESS.csrf || ADMIN.csrf;
  if (method !== "GET" && csrf) headers["X-CSRF-Token"] = csrf;
  let res;
  try { res = await fetch(API_BASE + path, { method, headers, body: json === undefined ? undefined : JSON.stringify(json), credentials: "same-origin", cache: "no-store" }); }
  catch (e) { return { ok: false, status: 0, error: "network" }; }
  let data = {};
  try { data = await res.json(); } catch (e) { data = { error: "bad_response" }; }
  return { ...data, status: res.status, ok: res.ok && data.ok !== false };
}
/* KostBills sign-in (Admin or Management) through the same PHP session as the site admin.
   The role only changes what the page shows; the API checks the role again on every request. */
const KSESS = { role: null, username: "", csrf: "" };
const KOS_PUBLIC = { demo: null };
async function kosPublic() {
  if (!SERVER) { KOS_PUBLIC.demo = true; return KOS_PUBLIC; }
  const r = await api("kos.php?action=public");
  KOS_PUBLIC.demo = r.ok ? !!r.demo_enabled : true; // no server data yet: the demo stays available
  return KOS_PUBLIC;
}
/* Swap the page's content for newer content (from the server) without reloading. */
function replaceSite(data) {
  Object.keys(SITE).forEach((k) => { delete SITE[k]; });
  Object.assign(SITE, data);
  SITE.cars = SITE.cars || [];
}
const CAP = { checked: false, owner: false, artifact: null, downloads: null, ready: null };
CAP.ready = (async () => {
  const use = window.claude && typeof window.claude.use === "function" ? (n) => window.claude.use(n).catch(() => null) : async () => null;
  const [user, artifact, downloads] = await Promise.all([use("user"), use("artifact"), use("downloads")]);
  CAP.artifact = artifact; CAP.downloads = downloads;
  try { CAP.owner = user ? !!(await user.isOwner()) || !!(await user.canEdit()) : false; } catch (e) { CAP.owner = false; }
  CAP.checked = true;
  renderChrome();
  return CAP;
})();

async function saveFile(filename, data) {
  await CAP.ready;
  if (!CAP.downloads) return STANDALONE ? browserDownload(filename, data) : (toast("Downloads aren't available in this view."), false);
  try { await CAP.downloads.save({ filename, data }); return true; }
  catch (e) {
    if (e && e.code === "declined") return false;
    toast(e && e.code === "rate_limited" ? "A download prompt is already open." : "Couldn't save the file here.");
    return false;
  }
}

function browserDownload(filename, data) {
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/i.test(filename) ? "application/json" : /\.csv$/i.test(filename) ? "text/csv" : /\.pdf$/i.test(filename) ? "application/pdf" : "application/octet-stream" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) { toast("Couldn't save the file here."); return false; }
}

/* ---------- Colour theme (standalone only; inside Claude the host sets data-theme) ---------- */
const THEME = {
  modes: ["auto", "light", "dark"],
  get() { const t = store.get("kb-theme", "auto"); return THEME.modes.includes(t) ? t : "auto"; },
  apply(t) {
    if (!STANDALONE) return;
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    const b = document.getElementById("theme-btn");
    if (b) { b.dataset.mode = t; b.setAttribute("aria-label", `Colour theme: ${t}. Click to change.`); b.title = `Theme: ${t[0].toUpperCase() + t.slice(1)}`; b.querySelector("span").textContent = t[0].toUpperCase() + t.slice(1); }
  },
  cycle() { const n = THEME.modes[(THEME.modes.indexOf(THEME.get()) + 1) % THEME.modes.length]; store.set("kb-theme", n); THEME.apply(n); },
};

/* The page rebuilds its own document from its source blocks + new data, then publishes it. */
const SKELETON_HEAD = "__SKELETON_HEAD__";
const PAGE_PREFIX = "__PAGE_PREFIX__";
function buildDocument(data) {
  const css = document.getElementById("site-css").textContent;
  const js = document.getElementById("site-js").textContent;
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));
  const sc = "scr" + "ipt";
  return SKELETON_HEAD + PAGE_PREFIX.replace("__TITLE__", esc((data.profile && data.profile.name) || "Portfolio")) +
    `<style id="site-css">${css}</style>` +
    `<div id="app"></div>` +
    `<${sc} type="application/json" id="site-data">${json}</${sc}>` +
    `<${sc} id="site-js">${js}</${sc}>` +
    "\n</body></html>";
}

