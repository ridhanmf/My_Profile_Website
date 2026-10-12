/* ---------- Router ---------- */
const PAGES = {};
const NAV = [
  ["home", "Home"],
  ["collection", "My Collection"],
  ["smartpark", "SmartPark"],
  ["kos", "KostBills"],
];
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
  $$(".nav a").forEach((a) => a.setAttribute("aria-current", a.dataset.route === name ? "page" : "false"));
  const p = SITE.profile || {};
  document.title = name === "home" ? (p.name || "Portfolio") : `${NAV.find((n) => n[0] === name)[1]} · ${p.name || "Portfolio"}`;
  renderSaveBar();
  if (!routing.first) window.scrollTo(0, 0);
  routing.first = false;
}
const routing = { first: true };

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
  if (STANDALONE) meter = "Static copy · export site.json and commit it to publish";
  else {
    const size = buildDocument(ADMIN.draft).length;
    meter = `Site size ${(size / 1048576).toFixed(1)} MB of 16 MB${size > 13 * 1048576 ? " · near the limit, remove photos before adding more" : ""}`;
  }
  const label = STANDALONE ? "Export site data" : "Publish changes";
  bar.innerHTML = `<div style="display:grid;gap:2px"><b>${ADMIN.dirty ? (STANDALONE ? "You have unexported changes" : "You have unpublished changes") : "Admin mode · no changes yet"}</b><span class="meter">${meter}</span></div>
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

function boot() {
  const app = $("#app");
  app.innerHTML = `
  <header class="topbar"><div class="wrap">
    <a class="brand" href="#home" aria-label="Home"><span class="brand-mark" id="brand-mark">R</span><span class="brand-name" id="brand-name"></span></a>
    <span id="admin-slot"></span>
    <nav class="nav" aria-label="Pages">${NAV.map(([k, l]) => `<a href="#${k}" data-route="${k}">${l}</a>`).join("")}</nav>
    ${STANDALONE ? `<button class="theme-btn" id="theme-btn" type="button"><i aria-hidden="true"></i><span>Auto</span></button>` : ""}
  </div></header>
  <main id="view"></main>
  <footer class="footer"><div class="wrap"><span id="foot-name"></span><span><button class="btn ghost sm" id="admin-open" style="padding:2px 6px;color:var(--muted)">${ICON.lock} Admin login</button></span></div></footer>`;
  $("#admin-open").onclick = openAdminDialog;
  if (STANDALONE) { $("#theme-btn").onclick = THEME.cycle; THEME.apply(THEME.get()); }
  renderChrome();
  window.addEventListener("hashchange", route);
  const back = sess.get("kb-route");
  if (back && !location.hash) { sess.del("kb-route"); history.replaceState(null, "", back); }
  else sess.del("kb-route");
  if (sessionValid()) {
    CAP.ready.then(() => { if ((STANDALONE || (CAP.owner && CAP.artifact)) && SITE.auth && !ADMIN.on) startAdmin(); else sess.del("kb-admin-session"); });
  }
  route();
  const flash = sess.get("kb-flash"); if (flash) { sess.del("kb-flash"); setTimeout(() => toast(flash, 3500), 300); }
}

