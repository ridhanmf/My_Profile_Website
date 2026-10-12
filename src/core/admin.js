/* ---------- Admin authentication ----------
   Username + password are verified against a salted PBKDF2-SHA256 hash that the build merges into
   the site data from a git-ignored file (the plain password never appears in the page or the repo).
   What actually protects the live site is a second, server-side check:
   - artifact mode:   publish() is refused for anyone who isn't the artifact's owner or an editor.
   - standalone mode: edits only download a site.json file; changing the live site still needs
                      push access to the GitHub repository. */
const AUTH = { SESSION_MS: 30 * 60 * 1000, MAX_FAILS: 5, LOCK_MS: 5 * 60 * 1000 };
const b64 = { enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))), dec: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)) };
async function pbkdf2(secret, saltBytes, iter) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: iter }, key, 256);
}
function safeEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function verifyCredentials(user, pass) {
  const A = SITE.auth; if (!A || !crypto.subtle) return false;
  const got = b64.enc(await pbkdf2(user.trim() + ":" + pass, b64.dec(A.salt), A.iter));
  return safeEqual(got, A.hash);
}
async function makeCredential(user, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iter = 310000;
  return { alg: "PBKDF2-SHA256", iter, salt: b64.enc(salt), hash: b64.enc(await pbkdf2(user.trim() + ":" + pass, salt, iter)) };
}
const lockState = () => store.get("kb-admin-lock", { fails: 0, until: 0 });
function sessionValid() { const x = sess.get("kb-admin-session"); return !!(x && x.exp > Date.now()); }
function touchSession() { if (ADMIN.on) sess.set("kb-admin-session", { exp: Date.now() + AUTH.SESSION_MS }); }
["click", "keydown"].forEach((ev) => document.addEventListener(ev, touchSession, { passive: true }));
setInterval(() => { if (ADMIN.on && !sessionValid()) { stopAdmin(); toast("Signed out after 30 minutes of inactivity.", 4000); } }, 30000);

/* ---------- Admin state ---------- */
const ADMIN = {
  on: false,
  csrf: "",          // server mode: token from the PHP session, sent with every change
  draft: null,       // working copy of SITE while editing
  dirty: false,
};
function adminData() { return ADMIN.on && ADMIN.draft ? ADMIN.draft : SITE; }
function startAdmin() {
  const saved = sess.get("kb-admin-draft");
  ADMIN.draft = saved && saved.base === SITE.rev ? saved.data : JSON.parse(JSON.stringify(SITE));
  ADMIN.dirty = !!(saved && saved.base === SITE.rev && saved.dirty);
  ADMIN.on = true;
  sess.set("kb-admin-session", { exp: Date.now() + AUTH.SESSION_MS });
  renderChrome(); route();
}
function stopAdmin() {
  if (SERVER && ADMIN.csrf) { api("auth.php?action=logout", { method: "POST" }); ADMIN.csrf = ""; }
  ADMIN.on = false; ADMIN.draft = null; ADMIN.dirty = false;
  sess.del("kb-admin-session"); sess.del("kb-admin-draft");
  renderChrome(); route();
}
function markDirty() {
  ADMIN.dirty = true;
  sess.set("kb-admin-draft", { base: SITE.rev, data: ADMIN.draft, dirty: true });
  renderSaveBar();
}
async function publishDraft(btn) {
  if (!ADMIN.on || !sessionValid()) { stopAdmin(); toast("Your admin session ended. Sign in again to publish."); return; }
  if (SERVER) return saveToServer(btn);
  if (STANDALONE) return exportDraft();
  if (!CAP.artifact) { toast("Saving isn't available in this view."); return; }
  const next = JSON.parse(JSON.stringify(ADMIN.draft));
  next.rev = (SITE.rev || 0) + 1;
  const html = buildDocument(next);
  if (btn) { btn.disabled = true; btn.textContent = "Publishing…"; }
  sess.set("kb-route", location.hash || "#home");
  sess.set("kb-flash", "Published. Visitors now see your changes.");
  sess.del("kb-admin-draft");
  try {
    await CAP.artifact.publish(html);
  } catch (e) {
    sess.del("kb-flash");
    sess.set("kb-admin-draft", { base: SITE.rev, data: ADMIN.draft, dirty: true });
    if (btn) { btn.disabled = false; btn.textContent = "Publish changes"; }
    const code = e && e.code;
    if (code === "conflict") toast("A newer version was published. Reloading it now.");
    else if (code === "not_writer" || code === "not_granted" || code === "consent_required") toast("This account can't publish changes to the site.");
    else if (code === "too_large") toast("The site is over the size limit. Remove some photos and try again.", 5000);
    else if (code === "rate_limited") toast("Publishing too often. Wait a minute and try again.");
    else toast("Publishing failed. Try again in a moment.");
  }
}

/* Standalone: hand the edited data back as site.json, with credentials removed and
   unchanged inlined images turned back into their asset paths. */
function exportableData(draft) {
  const out = JSON.parse(JSON.stringify(draft));
  delete out.auth;
  const back = new Map();
  Object.entries(SITE.assetSources || {}).forEach(([ptr, path]) => {
    const val = ptr.split(".").reduce((o, k) => (o == null ? o : o[k]), SITE);
    if (typeof val === "string") back.set(val, path);
  });
  delete out.assetSources;
  const walk = (o) => { for (const k in o) { const v = o[k]; if (typeof v === "string" && back.has(v)) o[k] = back.get(v); else if (v && typeof v === "object") walk(v); } };
  walk(out);
  out.rev = (SITE.rev || 0) + 1;
  return out;
}
async function exportDraft() {
  const ok = await saveFile("site.json", JSON.stringify(exportableData(ADMIN.draft), null, 2) + "\n");
  if (!ok) return;
  ADMIN.dirty = false;
  sess.set("kb-admin-draft", { base: SITE.rev, data: ADMIN.draft, dirty: false });
  renderSaveBar();
  toast("site.json downloaded. Replace src/data/site.json with it, then run npm run build.", 6000);
}

/* Server mode: save the draft to the database; visitors get it on their next page load. */
async function saveToServer(btn) {
  const draft = JSON.parse(JSON.stringify(ADMIN.draft));
  delete draft.auth; delete draft.assetSources;
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
  const r = await api("site.php", { method: "POST", json: { baseRev: SITE.rev || 0, data: draft } });
  if (r.ok) {
    draft.rev = r.rev;
    replaceSite(draft);
    ADMIN.draft = JSON.parse(JSON.stringify(SITE)); ADMIN.dirty = false;
    sess.del("kb-admin-draft");
    renderChrome(); route();
    toast("Saved. Visitors now see your changes.", 3500);
    return;
  }
  if (btn) { btn.disabled = false; btn.textContent = "Save changes"; }
  if (r.status === 401) { ADMIN.csrf = ""; stopAdmin(); toast("Your admin session ended. Sign in again, then save.", 4500); }
  else if (r.status === 409) toast("Newer changes were saved from another tab or device. Copy your edits, reload the page, and edit again.", 6500);
  else if (r.status === 413) toast("The site is over the size limit. Use smaller photos and try again.", 5000);
  else if (r.status === 0) toast("Couldn't reach the server. Check your connection and try again.");
  else toast(r.message || "Saving failed. Try again in a moment.", 4500);
}

function openAdminDialog() {
  if (ADMIN.on) {
    openModal({
      title: "Admin mode",
      body: SERVER
        ? `<p>You're signed in as admin. <b>Save changes</b> writes them to your website's database, and visitors see them right away. The session ends after 30 minutes without activity.</p>`
        : STANDALONE
        ? `<p>You're signed in as admin on a static copy of the site. Edits stay in this tab until you export them as <code>site.json</code>; commit that file to publish them. The session ends after 30 minutes without activity.</p><p class="muted">To change the admin login, edit <code>.env</code> and run <code>npm run set-admin</code>, then rebuild.</p>`
        : `<p>You're signed in as admin. Changes stay in this tab until you publish them. The session ends after 30 minutes without activity.</p>`,
      foot: `${STANDALONE && !SERVER ? "" : `<button class="btn" id="admin-pw">Change login</button>`}<button class="btn" data-close>Keep editing</button><button class="btn danger" id="admin-exit">${ADMIN.dirty ? "Discard changes and sign out" : "Sign out"}</button>`,
      onMount: (m) => {
        m.querySelector("#admin-exit").onclick = () => { closeModal(); stopAdmin(); toast("Signed out."); };
        const pw = m.querySelector("#admin-pw"); if (pw) pw.onclick = openChangeLogin;
      },
    });
    return;
  }
  const m = openModal({
    title: "Admin sign-in",
    body: `<form id="login-form" class="form-grid" novalidate autocomplete="on">
      <label class="field full"><span>Username</span><input class="input" id="lg-user" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
      <label class="field full"><span>Password</span><input class="input" id="lg-pass" name="password" type="password" autocomplete="current-password" required></label>
      <p class="full" id="lg-msg" role="alert" style="color:var(--bad);font-size:13.5px" hidden></p>
      <button type="submit" hidden></button>
    </form>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="lg-go">Sign in</button>`,
  });
  const msg = m.querySelector("#lg-msg"), go = m.querySelector("#lg-go");
  const say = (t) => { msg.textContent = t; msg.hidden = false; };
  const submit = async () => {
    if (SERVER) return submitServer();
    const lk = lockState();
    if (lk.until > Date.now()) return say(`Too many failed attempts. Try again in ${Math.ceil((lk.until - Date.now()) / 60000)} minute(s).`);
    const user = m.querySelector("#lg-user").value, pass = m.querySelector("#lg-pass").value;
    if (!user.trim() || !pass) return say("Enter your username and password.");
    if (!SITE.auth) return say("Admin login isn't set up on this build. Run npm run set-admin, then rebuild the site.");
    go.disabled = true; go.textContent = "Checking…"; msg.hidden = true;
    let ok = false;
    try { ok = await verifyCredentials(user, pass); } catch (e) { ok = false; }
    if (!ok) {
      const fails = (lk.until > Date.now() ? lk.fails : (lk.fails || 0)) + 1;
      const locked = fails >= AUTH.MAX_FAILS;
      store.set("kb-admin-lock", { fails: locked ? 0 : fails, until: locked ? Date.now() + AUTH.LOCK_MS : 0 });
      go.disabled = false; go.textContent = "Sign in";
      m.querySelector("#lg-pass").value = "";
      return say(locked ? "Too many failed attempts. Sign-in is locked for 5 minutes." : `Wrong username or password. ${AUTH.MAX_FAILS - fails} attempt(s) left.`);
    }
    store.del("kb-admin-lock");
    await CAP.ready;
    if (!STANDALONE && (!CAP.artifact || !CAP.owner)) {
      go.disabled = false; go.textContent = "Sign in";
      return say("Login details are correct, but this view can't save changes. Open the site while signed in to the Claude account that owns it.");
    }
    closeModal(); startAdmin(); toast("Signed in as admin.");
  };
  /* Server mode: the PHP API checks the password and enforces the lockout. */
  const submitServer = async () => {
    const user = m.querySelector("#lg-user").value, pass = m.querySelector("#lg-pass").value;
    if (!user.trim() || !pass) return say("Enter your username and password.");
    go.disabled = true; go.textContent = "Checking…"; msg.hidden = true;
    const r = await api("auth.php?action=login", { method: "POST", json: { username: user.trim(), password: pass } });
    go.disabled = false; go.textContent = "Sign in";
    if (r.ok) { ADMIN.csrf = r.csrf; closeModal(); startAdmin(); toast("Signed in as admin."); return; }
    m.querySelector("#lg-pass").value = "";
    if (r.status === 401) return say(`Wrong username or password. ${r.attempts_left} attempt(s) left.`);
    if (r.status === 429) return say(`Too many failed attempts. Try again in ${Math.max(1, Math.ceil((r.retry_after || 300) / 60))} minute(s).`);
    if (r.status === 503 || r.status === 404) return say("Admin sign-in isn't set up on this server yet. Open api/setup.php to create the admin account.");
    if (r.status === 0) return say("Couldn't reach the server. Check your connection and try again.");
    return say(r.message || "Sign-in failed. Try again in a moment.");
  };
  go.onclick = submit;
  m.querySelector("#login-form").addEventListener("submit", (e) => { e.preventDefault(); submit(); });
}

function openChangeLogin() {
  if (SERVER) return openChangeLoginServer();
  const m = openModal({
    title: "Change admin login",
    body: `<p class="muted">The new login is stored as a salted hash. It takes effect after you publish.</p>
      <div class="form-grid">
        <label class="field full"><span>New username</span><input class="input" id="cl-user" autocomplete="username" autocapitalize="off"></label>
        <label class="field"><span>New password (8+ characters)</span><input class="input" id="cl-pass" type="password" autocomplete="new-password"></label>
        <label class="field"><span>Repeat password</span><input class="input" id="cl-pass2" type="password" autocomplete="new-password"></label>
        <p class="full" id="cl-msg" role="alert" style="color:var(--bad);font-size:13.5px" hidden></p>
      </div>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="cl-save">Update login</button>`,
  });
  m.querySelector("#cl-save").onclick = async (e) => {
    const u = m.querySelector("#cl-user").value.trim(), p1 = m.querySelector("#cl-pass").value, p2 = m.querySelector("#cl-pass2").value;
    const say = (t) => { const x = m.querySelector("#cl-msg"); x.textContent = t; x.hidden = false; };
    if (!u) return say("Enter a username.");
    if (p1.length < 8) return say("Use at least 8 characters for the password.");
    if (p1 !== p2) return say("The two passwords don't match.");
    e.currentTarget.disabled = true;
    ADMIN.draft.auth = await makeCredential(u, p1);
    closeModal(); markDirty(); toast("Login updated. Publish to make it take effect.", 3500);
  };
}

/* Server mode: change the admin login on the server (needs the current password). */
function openChangeLoginServer() {
  const m = openModal({
    title: "Change admin login",
    body: `<p class="muted">The new login is checked by your server and stored as a password hash in the database.</p>
      <div class="form-grid">
        <label class="field full"><span>Current password</span><input class="input" id="cl-cur" type="password" autocomplete="current-password"></label>
        <label class="field full"><span>New username</span><input class="input" id="cl-user" autocomplete="username" autocapitalize="off"></label>
        <label class="field"><span>New password (10+ characters)</span><input class="input" id="cl-pass" type="password" autocomplete="new-password"></label>
        <label class="field"><span>Repeat password</span><input class="input" id="cl-pass2" type="password" autocomplete="new-password"></label>
        <p class="full" id="cl-msg" role="alert" style="color:var(--bad);font-size:13.5px" hidden></p>
      </div>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="cl-save">Update login</button>`,
  });
  m.querySelector("#cl-save").onclick = async (e) => {
    const btn = e.currentTarget;
    const cur = m.querySelector("#cl-cur").value, u = m.querySelector("#cl-user").value.trim(), p1 = m.querySelector("#cl-pass").value, p2 = m.querySelector("#cl-pass2").value;
    const say = (t) => { const x = m.querySelector("#cl-msg"); x.textContent = t; x.hidden = false; };
    if (!cur) return say("Enter your current password.");
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(u)) return say("Use 3–64 letters, numbers, dots, dashes or underscores for the username.");
    if (p1.length < 10) return say("Use at least 10 characters for the password.");
    if (p1 !== p2) return say("The two passwords don't match.");
    btn.disabled = true;
    const r = await api("auth.php?action=password", { method: "POST", json: { current: cur, username: u, password: p1 } });
    btn.disabled = false;
    if (r.ok) { ADMIN.csrf = r.csrf; closeModal(); toast("Login updated. Use the new username and password next time.", 4000); return; }
    say(r.message || "Couldn't update the login.");
  };
}
