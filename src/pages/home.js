/* ===== Home / Portfolio ===== */
PAGES.home = {
  mount(view) {
    const d = adminData();
    const p = d.profile || {};
    const parts = (p.name || "Your Name").trim().split(/\s+/);
    const first = parts.slice(0, -1).join(" ") || parts[0];
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    const roles = p.roles || [];
    const focus = p.focus || [];
    const skills = p.skills || [];
    const contacts = (p.contacts || []).filter((c) => c.value);
    const cars = d.cars || [];
    const bg = p.homeBg ? `url("${String(p.homeBg).replace(/"/g, "%22")}")` : svgUrl(ART.homeDefault());
    const projects = p.projects || [];
    view.innerHTML = `
    <div class="hero-band${p.homeBg ? " has-photo" : ""}" style="--home-bg:${esc(bg)}">
    <section class="hero wrap">
      <div class="hero-grid">
        <div style="min-width:0">
          <div class="eyebrow">${esc(p.location || "")}</div>
          <h1 class="hero-name" style="margin-top:14px"><span>${esc(first)}</span>${last ? `<span class="last">${esc(last)}</span>` : ""}</h1>
          <div class="hero-role">${roles.map((r) => `<span class="role-tag">${esc(r)}</span>`).join("")}</div>
          <p class="hero-about">${esc(p.about || "")}</p>
          <div class="hero-cta">
            <a class="btn primary" href="#projects" data-scroll="projects">See featured projects ${ICON.arrow}</a>
            <a class="btn" href="#contact" data-scroll="contact">Contact</a>
            ${ADMIN.on ? `<button class="btn" id="edit-profile">${ICON.edit} Edit profile</button><button class="btn" id="edit-projects">${ICON.edit} Edit projects</button>` : ""}
          </div>
        </div>
        <figure class="portrait" style="margin:0">
          ${p.photo ? `<img src="${esc(p.photo)}" alt="Portrait of ${esc(p.name || "")}" width="560" height="825">` : ""}
          <figcaption class="portrait-tag"><span>${esc(roles.slice(1, 3).join(" · "))}</span><span>${esc(p.location || "")}</span></figcaption>
        </figure>
      </div>
    </section>
    </div>

    <section class="section wrap" style="padding-top:0">
      <div class="section-head"><h2>What I do</h2><span class="eyebrow">Data · Network · Web · AI</span></div>
      <div class="focus-grid">
        ${focus.map((f) => `<article class="focus art-card" style="--art:${esc(svgUrl(ART[focusArt(f.title)]()))}"><span class="eyebrow">${esc(f.code || "")}</span><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p><div class="chips">${(f.chips || []).map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div></article>`).join("")}
      </div>
      <div class="skill-groups">
        ${skills.map((g) => `<div class="panel skill-group"><h4>${esc(g.group)}</h4><div class="chips">${(g.items || []).map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>`).join("")}
      </div>
    </section>

    <section class="section wrap" id="projects" style="padding-top:0">
      <div class="section-head"><h2>Featured projects</h2><span class="eyebrow">Both run live on this site</span></div>
      <div class="projects">
        <a class="panel project" href="#smartpark">
          <div class="project-body">
            <span class="eyebrow">Mall parking navigation · IoT demo</span>
            <h3>SmartPark</h3>
            <p>Mall parking navigation that helps visitors find an empty slot fast. Scan QRIS at the gate, open the basement map, pick a slot or let auto-select recommend one, then park. Slot status comes from a simulated IoT sensor feed.</p>
            <div class="project-meta"><span class="chip">Basement 1 &amp; 2 · 100 slots</span><span class="chip">EV · Ladies · VIP</span><span class="chip">Drag-and-drop cars</span><span class="chip">No map APIs</span></div>
            <span class="project-link">Open SmartPark ${ICON.arrow}</span>
          </div>
          <div class="project-visual"><canvas id="sp-preview" aria-label="SmartPark map preview"></canvas></div>
        </a>
        <a class="panel project" href="#kos">
          <div class="project-body">
            <span class="eyebrow">Dashboard · Billing · Reporting</span>
            <h3>KostBills</h3>
            <p>A property management dashboard sized for 1,000 boarding-house rooms: tenant records, room availability, monthly bills at a flat Rp850.000 rent, payment status with due-soon alerts, transaction history and revenue summaries, with PDF invoices and reports.</p>
            <div class="project-meta"><span class="chip">1,000 rooms · 10 blocks</span><span class="chip">Search &amp; filters</span><span class="chip">PDF invoices</span><span class="chip">CSV export</span></div>
            <span class="project-link">Open KostBills ${ICON.arrow}</span>
          </div>
          <div class="project-visual" id="kos-preview"></div>
        </a>
      </div>
      <div class="section-head" style="margin-top:clamp(36px,6vw,64px)"><h2>More projects</h2><span class="eyebrow">Data · ML · Computer vision</span></div>
      <div class="proj-grid">
        ${projects.map((pr) => `<article class="proj-card">
          <div class="proj-thumb">${pr.thumb ? `<img src="${esc(pr.thumb)}" alt="${esc(pr.title)} screenshot" loading="lazy">` : ""}${pr.tag ? `<span class="proj-tag">${esc(pr.tag)}</span>` : ""}</div>
          <div class="proj-body">
            <h3>${esc(pr.title)}</h3>
            <p>${esc(pr.desc)}</p>
            <div class="chips">${(pr.stack || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
            ${(/^https?:\/\//i.test(pr.demo || "") || /^https?:\/\//i.test(pr.source || "")) ? `<div class="proj-actions">${/^https?:\/\//i.test(pr.demo || "") ? `<a class="btn primary sm" href="${esc(pr.demo)}" target="_blank" rel="noopener">${ICON.ext} Demo</a>` : ""}${/^https?:\/\//i.test(pr.source || "") ? `<a class="btn sm" href="${esc(pr.source)}" target="_blank" rel="noopener">${CONTACT_ICON.github} Source code</a>` : ""}</div>` : ""}
          </div>
        </article>`).join("")}
      </div>
      <a class="collection-teaser art-card" href="#collection" style="--art:${esc(svgUrl(ART.track()))}">
        <div style="display:grid;gap:6px;max-width:52ch"><span class="eyebrow">Off the clock</span><h3>My diecast collection</h3>
        <p>${cars.length ? `${cars.length} model${cars.length === 1 ? "" : "s"} catalogued, with brand, scale and condition for each.` : "A catalogue of my diecast cars by brand, scale and condition."}</p></div>
        <span class="btn teaser-btn">Browse the collection ${ICON.arrow}</span>
      </a>
    </section>

    <section class="section wrap" id="contact" style="padding-top:0">
      <div class="section-head"><h2>Contact</h2><span class="eyebrow">Email, Instagram or GitHub</span></div>
      <div class="contact-grid">
        ${contacts.map((c) => { const k = contactKind(c.label), link = c.url && /^https?:\/\//i.test(c.url); return `<div class="contact c-${k}">
          <span class="c-icon" aria-hidden="true">${CONTACT_ICON[k]}</span>
          <div class="c-text"><span class="label">${esc(c.label)}</span><span class="value">${esc(c.value)}</span></div>
          ${link ? `<a class="c-action" href="${esc(c.url)}" target="_blank" rel="noopener">Open ${ICON.ext}</a>` : `<button class="c-action" data-copy="${esc(c.value)}">Copy ${ICON.copy}</button>`}
        </div>`; }).join("")}
      </div>
    </section>`;

    view.addEventListener("click", (e) => {
      const s = e.target.closest("[data-scroll]");
      if (s) { e.preventDefault(); document.getElementById(s.dataset.scroll).scrollIntoView({ behavior: "smooth", block: "start" }); }
      const c = e.target.closest("[data-copy]");
      if (c) copyText(c.dataset.copy, c);
    });
    const ep = $("#edit-profile"); if (ep) ep.onclick = openProfileEditor;
    const epj = $("#edit-projects"); if (epj) epj.onclick = openProjectsEditor;
    drawSmartParkPreview($("#sp-preview"));
    drawKosPreview($("#kos-preview"));
    this._onResize = () => drawSmartParkPreview($("#sp-preview"));
    window.addEventListener("resize", this._onResize);
  },
  unmount() { window.removeEventListener("resize", this._onResize); },
};

function drawKosPreview(el) {
  if (!el) return;
  const k = typeof kosSummary === "function" ? kosSummary() : null;
  const cells = [];
  let r = 7;
  for (let i = 0; i < 100; i++) { r = (r * 9301 + 49297) % 233280; const v = r / 233280; cells.push(v < 0.1 ? "v" : v < 0.15 ? "o" : v < 0.17 ? "m" : ""); }
  el.innerHTML = `<div class="mini-kos">
    <div class="kpis">
      <div class="kpi"><b>${k ? k.occ : "88%"}</b><span>Occupancy</span></div>
      <div class="kpi"><b>${k ? k.collected : "Rp 1,1 M"}</b><span>Collected this year</span></div>
      <div class="kpi"><b>${k ? k.overdue : "—"}</b><span>Overdue bills</span></div>
    </div>
    <div class="eyebrow">Blok A · 100 rooms</div>
    <div class="mini-grid">${cells.map((c) => `<i class="${c}"></i>`).join("")}</div>
  </div>`;
}

function openProfileEditor() {
  const p = ADMIN.draft.profile;
  const skillsTxt = (p.skills || []).map((g) => `${g.group}: ${(g.items || []).join(", ")}`).join("\n");
  const contactsTxt = (p.contacts || []).map((c) => [c.label, c.value, c.url || ""].join(" | ").replace(/ \| $/, "")).join("\n");
  const focusTxt = (p.focus || []).map((f) => `${f.title} :: ${f.text} :: ${(f.chips || []).join(", ")}`).join("\n");
  let photo = p.photo, homeBg = p.homeBg || "", spBg = p.spHeroBg || "";
  const m = openModal({
    title: "Edit profile",
    wide: true,
    body: `<div class="form-grid">
      <label class="field"><span>Name</span><input class="input" id="pf-name" value="${esc(p.name)}"></label>
      <label class="field"><span>Location</span><input class="input" id="pf-loc" value="${esc(p.location)}"></label>
      <label class="field"><span>WhatsApp number for purchases (country code, digits only)</span><input class="input" id="pf-wa" inputmode="numeric" value="${esc(p.whatsapp || "")}"></label>
      <label class="field"><span>Role tags (comma separated)</span><input class="input" id="pf-roles" value="${esc((p.roles || []).join(", "))}"></label>
      <label class="field full"><span>About</span><textarea class="input" id="pf-about" rows="4">${esc(p.about)}</textarea></label>
      <label class="field full"><span>What I do — one card per line: Title :: description :: chip, chip</span><textarea class="input" id="pf-focus" rows="3">${esc(focusTxt)}</textarea></label>
      <label class="field full"><span>Skills — one group per line: Group: skill, skill</span><textarea class="input" id="pf-skills" rows="4">${esc(skillsTxt)}</textarea></label>
      <label class="field full"><span>Contacts — one per line: Label | shown value | link (optional, https://…)</span><textarea class="input" id="pf-contacts" rows="4" placeholder="LinkedIn | linkedin.com/in/yourname | https://linkedin.com/in/yourname">${esc(contactsTxt)}</textarea></label>
      <div class="field"><span>Portrait</span><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div class="thumb" style="width:64px;height:80px">${photo ? `<img id="pf-photo-img" src="${esc(photo)}" alt="">` : `<img id="pf-photo-img" alt="">`}</div>
        <label class="btn sm">Replace photo<input type="file" accept="image/*" id="pf-photo" hidden></label></div></div>
      <div class="field"><span>Home background (behind your name)</span><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div class="thumb" style="width:120px;height:68px" id="pf-bg-thumb">${homeBg ? `<img src="${esc(homeBg)}" alt="">` : `<span class="muted" style="font-size:11px;display:grid;place-items:center;height:100%">Default pattern</span>`}</div>
        <label class="btn sm">Upload image<input type="file" accept="image/*" id="pf-bg" hidden></label>
        <button type="button" class="btn sm ghost" id="pf-bg-clear">Use default</button></div>
        <input class="input" id="pf-bg-url" placeholder="…or paste an image URL (https://…)" value="${/^https?:/i.test(homeBg || "") ? esc(homeBg) : ""}"></div>
      <div class="field full"><span>SmartPark header image</span><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div class="thumb" style="width:150px;height:50px" id="pf-sp-thumb"><img src="${esc(spBg || (SITE.assets || {}).spHero || "")}" alt=""></div>
        <label class="btn sm">Upload image<input type="file" accept="image/*" id="pf-sp" hidden></label>
        <button type="button" class="btn sm ghost" id="pf-sp-clear">Use default</button>
        <input class="input" id="pf-sp-url" style="flex:1 1 220px" placeholder="…or paste an image URL (https://…)" value="${/^https?:/i.test(spBg || "") ? esc(spBg) : ""}"></div></div>
    </div>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="pf-save">Apply changes</button>`,
  });
  m.querySelector("#pf-photo").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { photo = await compressImage(f, 800, 0.82); m.querySelector("#pf-photo-img").src = photo; } catch (err) { toast("That file isn't an image this browser can read."); }
  };
  const bgThumb = () => { m.querySelector("#pf-bg-thumb").innerHTML = homeBg ? `<img src="${esc(homeBg)}" alt="">` : `<span class="muted" style="font-size:11px;display:grid;place-items:center;height:100%">Default pattern</span>`; };
  m.querySelector("#pf-bg").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { homeBg = await compressImage(f, 1800, 0.8); m.querySelector("#pf-bg-url").value = ""; bgThumb(); } catch (err) { toast("That file isn't an image this browser can read."); }
  };
  m.querySelector("#pf-bg-clear").onclick = () => { homeBg = ""; m.querySelector("#pf-bg-url").value = ""; bgThumb(); };
  m.querySelector("#pf-bg-url").oninput = (e) => { const u = e.target.value.trim(); if (/^https:\/\//i.test(u)) { homeBg = u; bgThumb(); } };
  const spThumb = () => { m.querySelector("#pf-sp-thumb img").src = spBg || (SITE.assets || {}).spHero || ""; };
  m.querySelector("#pf-sp").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { spBg = await compressImage(f, 1800, 0.8); m.querySelector("#pf-sp-url").value = ""; spThumb(); } catch (err) { toast("That file isn't an image this browser can read."); }
  };
  m.querySelector("#pf-sp-clear").onclick = () => { spBg = ""; m.querySelector("#pf-sp-url").value = ""; spThumb(); };
  m.querySelector("#pf-sp-url").oninput = (e) => { const u = e.target.value.trim(); if (/^https:\/\//i.test(u)) { spBg = u; spThumb(); } };
  m.querySelector("#pf-save").onclick = () => {
    const v = (id) => m.querySelector(id).value.trim();
    p.name = v("#pf-name"); p.location = v("#pf-loc"); p.whatsapp = v("#pf-wa").replace(/\D/g, ""); p.about = v("#pf-about");
    p.roles = v("#pf-roles").split(",").map((s) => s.trim()).filter(Boolean);
    p.focus = v("#pf-focus").split("\n").map((l) => l.split("::").map((s) => s.trim())).filter((a) => a[0]).map((a, i) => ({ code: (p.focus[i] && p.focus[i].code) || "", title: a[0], text: a[1] || "", chips: (a[2] || "").split(",").map((s) => s.trim()).filter(Boolean) }));
    p.skills = v("#pf-skills").split("\n").map((l) => { const i = l.indexOf(":"); return i < 0 ? null : { group: l.slice(0, i).trim(), items: l.slice(i + 1).split(",").map((s) => s.trim()).filter(Boolean) }; }).filter(Boolean);
    p.contacts = v("#pf-contacts").split("\n").map((l) => l.split("|").map((s) => s.trim())).filter((a) => a[0] && a[1]).map((a) => ({ label: a[0], value: a[1], url: a[2] || "" }));
    p.photo = photo; p.homeBg = homeBg; p.spHeroBg = spBg;
    closeModal(); markDirty(); renderChrome(); route();
    toast("Profile updated. Publish to make it live.");
  };
}

function openProjectsEditor() {
  const list = ADMIN.draft.profile.projects = ADMIN.draft.profile.projects || [];
  const thumbs = list.map((p) => p.thumb || "");
  const m = openModal({
    title: "Edit projects", wide: true,
    body: `<p class="muted" style="font-size:13px">Demo and Source code buttons appear only when a link starting with https:// is filled in.</p>` + list.map((p, i) => `
      <fieldset class="proj-edit"><legend>${esc(p.title || "Project " + (i + 1))}</legend><div class="form-grid">
        <label class="field"><span>Title</span><input class="input" data-k="title" data-i="${i}" value="${esc(p.title)}"></label>
        <label class="field"><span>Label (over the thumbnail)</span><input class="input" data-k="tag" data-i="${i}" value="${esc(p.tag || "")}"></label>
        <label class="field full"><span>Short description</span><textarea class="input" rows="2" data-k="desc" data-i="${i}">${esc(p.desc)}</textarea></label>
        <label class="field full"><span>Tech stack (comma separated)</span><input class="input" data-k="stack" data-i="${i}" value="${esc((p.stack || []).join(", "))}"></label>
        <label class="field"><span>Demo URL</span><input class="input" data-k="demo" data-i="${i}" placeholder="https://…" value="${esc(p.demo || "")}"></label>
        <label class="field"><span>Source code URL</span><input class="input" data-k="source" data-i="${i}" placeholder="https://github.com/…" value="${esc(p.source || "")}"></label>
        <div class="field full"><span>Thumbnail</span><div style="display:flex;gap:12px;align-items:center"><div class="thumb" style="width:120px;height:68px"><img data-thumb="${i}" src="${esc(thumbs[i])}" alt=""></div><label class="btn sm">Replace<input type="file" accept="image/*" data-file="${i}" hidden></label></div></div>
      </div></fieldset>`).join(""),
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="pj-save">Apply changes</button>`,
  });
  m.querySelectorAll("[data-file]").forEach((inp) => inp.onchange = async (e) => {
    const i = +inp.dataset.file, f = e.target.files[0]; if (!f) return;
    try { thumbs[i] = await compressImage(f, 1000, 0.8); m.querySelector(`[data-thumb="${i}"]`).src = thumbs[i]; } catch (err) { toast("That file isn't an image this browser can read."); }
  });
  m.querySelector("#pj-save").onclick = () => {
    m.querySelectorAll("[data-k]").forEach((el) => {
      const p = list[+el.dataset.i], k = el.dataset.k, v = el.value.trim();
      p[k] = k === "stack" ? v.split(",").map((x) => x.trim()).filter(Boolean) : v;
    });
    list.forEach((p, i) => p.thumb = thumbs[i]);
    closeModal(); markDirty(); route(); toast("Projects updated. Publish to make them live.");
  };
}
