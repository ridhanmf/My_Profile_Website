/* ---------- Router ---------- */
const PAGES = {};
/* Top-level links, and the projects grouped under the "Project" menu. */
const NAV = [["home", "Home"], ["collection", "MyCollection"]];
const PROJECT_NAV = [
  ["smartpark", "SmartPark", ["Navigasi parkir mal · simulasi IoT", "Mall parking navigation · IoT simulation"], '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>'],
  ["kos", "KostBills", ["Manajemen tagihan kos 1.000 kamar", "Billing for a 1,000-room boarding house"], '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01"/>'],
];
const ROUTE_TITLE = { home: "Home", collection: "MyCollection", smartpark: "SmartPark", kos: "KostBills", "kos-demo": "Demo KostBills" };
const PROJECT_OF = { smartpark: "smartpark", kos: "kos", "kos-demo": "kos" };
let current = null;
function routeName() {
  const h = (location.hash || "").replace(/^#/, "");
  return PAGES[h] ? h : "home";
}
function go(name) {
  if (location.hash === "#" + name) route();
  else location.hash = name;
}
function route() {
  const name = routeName();
  if (current && current.unmount) { try { current.unmount(); } catch (e) {} }
  closeModal();
  const old = $("#view");
  const view = old.cloneNode(false); // fresh element drops the previous page's listeners
  old.replaceWith(view);
  current = PAGES[name];
  document.body.dataset.page = name;
  current.mount(view);
  $$(".nav > a").forEach((a) => a.setAttribute("aria-current", a.dataset.route === name ? "page" : "false"));
  $("#nav-proj").setAttribute("aria-current", PROJECT_OF[name] ? "page" : "false");
  renderProjectMenu();
  closeProjectMenu();
  const p = SITE.profile || {};
  document.title = name === "home" ? (p.name || "Portfolio") : `${ROUTE_TITLE[name]} · ${p.name || "Portfolio"}`;
  renderSaveBar();
  if (!routing.first) window.scrollTo(0, 0);
  routing.first = false;
}
const routing = { first: true };

/* ---------- Project menu ---------- */
function renderProjectMenu() {
  const m = $("#nav-menu"); if (!m) return;
  const cur = PROJECT_OF[routeName()];
  m.innerHTML = PROJECT_NAV.map(([k, l, d, ic]) => `<a href="#${k}" data-route="${k}" aria-current="${k === cur}"><span class="nm-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg></span><b>${l}</b><small>${pick(d)}</small></a>`).join("");
}
function setProjectMenu(open) {
  const b = $("#nav-proj"), m = $("#nav-menu"); if (!b || !m) return;
  b.setAttribute("aria-expanded", String(open)); m.hidden = !open;
}
const closeProjectMenu = () => setProjectMenu(false);
function wireProjectMenu() {
  const b = $("#nav-proj"), m = $("#nav-menu");
  b.onclick = (e) => { e.stopPropagation(); const open = b.getAttribute("aria-expanded") !== "true"; setProjectMenu(open); if (open) m.querySelector("a").focus({ preventScroll: true }); };
  m.addEventListener("click", (e) => { if (e.target.closest("a")) closeProjectMenu(); });
  m.addEventListener("keydown", (e) => {
    const items = $$("a", m), i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("#nav-drop")) closeProjectMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && b.getAttribute("aria-expanded") === "true") { closeProjectMenu(); b.focus(); } });
}

function renderChrome() {
  const p = adminData().profile || {};
  const initials = (p.name || "R").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  $("#brand-mark").textContent = initials.slice(0, 1);
  $("#brand-name").textContent = p.name || "Portfolio";
  const slot = $("#admin-slot");
  slot.innerHTML = ADMIN.on ? `<button class="admin-chip" id="admin-chip" style="cursor:pointer;border-style:solid">Admin</button>` : "";
  const chip = $("#admin-chip"); if (chip) chip.onclick = openAdminDialog;
  $("#foot-name").textContent = `© ${new Date().getFullYear()} ${p.name || ""}`;
}

function renderSaveBar() {
  const old = $("#save-bar"); if (old) old.remove();
  if (!ADMIN.on) return;
  const name = routeName();
  if (name !== "home" && name !== "collection") return;
  const bar = document.createElement("div");
  bar.id = "save-bar"; bar.className = "save-bar wrap";
  let meter;
  if (SERVER) {
    const kb = JSON.stringify(ADMIN.draft).length / 1048576;
    meter = `Saved to your website's database · ${kb.toFixed(1)} MB of 15 MB${kb > 12 ? " · near the limit, use smaller photos" : ""}`;
  } else if (STANDALONE) meter = "Static copy · export site.json and commit it to publish";
  else {
    const size = buildDocument(ADMIN.draft).length;
    meter = `Site size ${(size / 1048576).toFixed(1)} MB of 16 MB${size > 13 * 1048576 ? " · near the limit, remove photos before adding more" : ""}`;
  }
  const label = SERVER ? "Save changes" : STANDALONE ? "Export site data" : "Publish changes";
  bar.innerHTML = `<div style="display:grid;gap:2px"><b>${ADMIN.dirty ? (SERVER ? "You have unsaved changes" : STANDALONE ? "You have unexported changes" : "You have unpublished changes") : "Admin mode · no changes yet"}</b><span class="meter">${meter}</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="sb-exit">${ADMIN.dirty ? "Discard" : "Exit admin"}</button><button class="btn sm primary" id="sb-pub" ${ADMIN.dirty ? "" : "disabled"}>${label}</button></div>`;
  $("#view").appendChild(bar);
  bar.querySelector("#sb-exit").onclick = () => {
    if (!ADMIN.dirty) return stopAdmin();
    openModal({ title: "Discard unpublished changes?", body: "<p>Your edits in this tab will be lost. The published site stays as it is.</p>",
      foot: `<button class="btn" data-close>Keep editing</button><button class="btn danger" id="disc">Discard</button>`,
      onMount: (m) => m.querySelector("#disc").onclick = () => { closeModal(); stopAdmin(); } });
  };
  bar.querySelector("#sb-pub").onclick = (e) => publishDraft(e.currentTarget);
}

/* Server mode: show the content built into the page at once, then switch to newer content saved in
   the database (if any) and resume an admin session that is still open on the server. */
async function loadFromServer() {
  const r = await api("site.php?rev=" + (SITE.rev || 0));
  if (r.ok && r.data && !ADMIN.on) { replaceSite(r.data); renderChrome(); route(); }
  const a = await api("auth.php");
  if (a.ok && a.admin && !ADMIN.on) { ADMIN.csrf = a.csrf; startAdmin(); }
  else if (!(a.ok && a.admin)) sess.del("kb-admin-session");
}

function boot() {
  const app = $("#app");
  app.innerHTML = `
  <header class="topbar"><div class="wrap">
    <a class="brand" href="#home" aria-label="Home"><span class="brand-mark" id="brand-mark">R</span><span class="brand-name" id="brand-name"></span></a>
    <span id="admin-slot"></span>
    <nav class="nav" aria-label="Halaman">${NAV.map(([k, l]) => `<a href="#${k}" data-route="${k}">${l}</a>`).join("")}
      <div class="nav-drop" id="nav-drop">
        <button class="nav-proj" id="nav-proj" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="nav-menu">Project <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="nav-menu" id="nav-menu" hidden></div>
      </div>
    </nav>
    ${STANDALONE ? `<button class="theme-btn" id="theme-btn" type="button"><i aria-hidden="true"></i><span>Auto</span></button>` : ""}
  </div></header>
  <main id="view"></main>
  <footer class="footer"><div class="wrap"><span id="foot-name"></span><span><button class="btn ghost sm" id="admin-open" style="padding:2px 6px;color:var(--muted)">${ICON.lock} Admin login</button></span></div></footer>`;
  $("#admin-open").onclick = openAdminDialog;
  renderProjectMenu();
  wireProjectMenu();
  /* Language change: refresh the menu and let the current page update its text in place. */
  document.addEventListener("langchange", () => {
    renderProjectMenu();
    $$("[data-setlang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setlang === LANG.get())));
    if (current && current.onLang) current.onLang();
  });
  if (STANDALONE) { $("#theme-btn").onclick = THEME.cycle; THEME.apply(THEME.get()); }
  renderChrome();
  window.addEventListener("hashchange", route);
  const back = sess.get("kb-route");
  if (back && !location.hash) { sess.del("kb-route"); history.replaceState(null, "", back); }
  else sess.del("kb-route");
  if (SERVER) loadFromServer();
  else if (sessionValid()) {
    CAP.ready.then(() => { if ((STANDALONE || (CAP.owner && CAP.artifact)) && SITE.auth && !ADMIN.on) startAdmin(); else sess.del("kb-admin-session"); });
  }
  route();
  const flash = sess.get("kb-flash"); if (flash) { sess.del("kb-flash"); setTimeout(() => toast(flash, 3500), 300); }
}

