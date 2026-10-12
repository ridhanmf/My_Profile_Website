/* ===== My Collection ===== */
const SCALES = ["1:64", "1:43", "1:32", "1:24", "1:18", "1:12", "Other"];
const CONDITIONS = ["Mint in box", "Mint loose", "Good", "Fair", "Customized"];
const COMMON_BRANDS = ["Hot Wheels", "Matchbox", "Tomica", "Mini GT", "Inno64", "Tarmac Works", "Kyosho", "Majorette", "Maisto", "Bburago", "AutoArt", "Pop Race", "Greenlight", "Era Car"];
const COND_CLASS = { "Mint in box": "ok", "Mint loose": "ok", Good: "info", Fair: "warn", Customized: "plain" };

const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3c.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';
function waLink(c) {
  const num = String((adminData().profile || {}).whatsapp || "6281234567890").replace(/\D/g, "");
  const msg = `Halo ${(adminData().profile || {}).name || ""}, saya tertarik membeli diecast ${c.brand} ${c.name} (${c.scale}, ${c.condition})${c.price ? ` dengan harga ${idr(c.price)}` : ""}. Apakah masih tersedia?`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}
function waButton(c, size) {
  return `<a class="btn wa${size ? " " + size : ""}" href="${esc(waLink(c))}" target="_blank" rel="noopener">${WA_ICON} Buy via WhatsApp</a>`;
}

PAGES.collection = {
  state: { q: "", brand: "", scale: "", cond: "", sort: "new" },
  mount(view) {
    const st = this.state;
    const cars = adminData().cars;
    const brands = [...new Set(cars.map((c) => c.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    view.innerHTML = `
    <div class="col-hero" style="--art:${esc(svgUrl(ART.track()))}">
      <div class="wrap col-hero-in">
        <div style="min-width:0"><div class="eyebrow">Off the clock · Diecast garage</div><h1>My Collection</h1>
        <p>Diecast models I've collected, logged by brand, scale and condition. Search by name or filter by brand to find a specific model, then ask about it on WhatsApp.</p></div>
        <div class="col-hero-side">
          <div class="col-stat"><b class="num">${cars.length}</b><span>Total Items</span></div>
          ${ADMIN.on ? `<button class="btn primary" id="add-car">${ICON.plus} Add car</button>` : ""}
        </div>
      </div>
    </div>
    <div class="wrap col-wrap">
      <div class="toolbar col-toolbar">
        <label class="search"><span class="sr">Search the collection</span>${ICON.search}<input class="input" id="c-q" type="search" placeholder="Search name, brand, series…" value="${esc(st.q)}"></label>
        <label><span class="sr">Brand</span><select class="select" id="c-brand"><option value="">All brands</option>${brands.map((b) => `<option ${b === st.brand ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></label>
        <label><span class="sr">Scale</span><select class="select" id="c-scale"><option value="">All scales</option>${SCALES.map((s) => `<option ${s === st.scale ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label><span class="sr">Condition</span><select class="select" id="c-cond"><option value="">Any condition</option>${CONDITIONS.map((s) => `<option ${s === st.cond ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label><span class="sr">Sort</span><select class="select" id="c-sort">
          ${[["new", "Newest first"], ["name", "Name A–Z"], ["brand", "Brand A–Z"], ["pdesc", "Price: high to low"], ["pasc", "Price: low to high"]].map(([v, l]) => `<option value="${v}" ${v === st.sort ? "selected" : ""}>${l}</option>`).join("")}
        </select></label>
      </div>
      <div id="c-results"></div>
    </div>`;
    const upd = () => {
      st.q = $("#c-q").value; st.brand = $("#c-brand").value; st.scale = $("#c-scale").value; st.cond = $("#c-cond").value; st.sort = $("#c-sort").value;
      this.renderGrid();
    };
    $("#c-q").addEventListener("input", upd);
    ["#c-brand", "#c-scale", "#c-cond", "#c-sort"].forEach((s) => $(s).addEventListener("change", upd));
    const add = $("#add-car"); if (add) add.onclick = () => openCarEditor(null);
    view.addEventListener("click", (e) => {
      const card = e.target.closest("[data-car]"); if (card) openCarDetail(card.dataset.car);
      if (e.target.closest("#c-clear")) { Object.assign(st, { q: "", brand: "", scale: "", cond: "" }); route(); }
      if (e.target.closest("#c-first")) openCarEditor(null);
    });
    this.renderGrid();
  },
  renderGrid() {
    const st = this.state;
    const all = adminData().cars;
    const q = st.q.trim().toLowerCase();
    let list = all.filter((c) => (!st.brand || c.brand === st.brand) && (!st.scale || c.scale === st.scale) && (!st.cond || c.condition === st.cond) &&
      (!q || [c.name, c.brand, c.series, c.year, c.notes, c.scale].join(" ").toLowerCase().includes(q)));
    const by = {
      new: (a, b) => (b.added || "").localeCompare(a.added || "") || (b.order || 0) - (a.order || 0),
      name: (a, b) => a.name.localeCompare(b.name),
      brand: (a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name),
      pdesc: (a, b) => (+b.price || 0) - (+a.price || 0),
      pasc: (a, b) => (+a.price || 0) - (+b.price || 0),
    }[st.sort];
    list = list.slice().sort(by);
    const el = $("#c-results"); if (!el) return;
    if (!all.length) {
      el.innerHTML = `<div class="empty col-empty"><div class="col-empty-art" style="--art:${esc(svgUrl(ART.track()))}"></div><h3>No cars logged yet</h3>
        <p>${ADMIN.on ? "Add your first model with a photo, brand, scale, condition and price. It appears here for visitors once you publish." : "The collection is being catalogued. Check back soon to browse models by brand, scale and condition."}</p>
        ${ADMIN.on ? `<button class="btn primary" id="c-first">${ICON.plus} Add your first car</button>` : ""}</div>`;
      return;
    }
    if (!list.length) {
      el.innerHTML = `<div class="empty"><h3>No matches</h3><p>No model matches those filters. Try a shorter search or clear the filters.</p><button class="btn" id="c-clear">Clear filters</button></div>`;
      return;
    }
    el.innerHTML = `<p class="col-count">Showing ${list.length} of ${all.length} item${all.length === 1 ? "" : "s"}</p>
      <div class="car-grid">${list.map((c) => `
      <article class="car">
        <button class="car-open" data-car="${esc(c.id)}" aria-label="View ${esc(c.brand + " " + c.name)}">
        <div class="car-photo">${c.photos && c.photos[0] ? `<img src="${esc(c.photos[0])}" alt="" loading="lazy">` : `<span class="noimg">No photo</span>`}
          <span class="scale">${esc(c.scale)}</span>${c.photos && c.photos.length > 1 ? `<span class="count">${c.photos.length} photos</span>` : ""}</div>
        <div class="car-body"><span class="car-brand">${esc(c.brand)}${c.series ? " · " + esc(c.series) : ""}</span>
          <span class="car-name">${esc(c.name)}</span>
          <div class="car-foot"><span class="car-price num">${c.price ? idr(c.price) : "—"}</span><span class="pill ${COND_CLASS[c.condition] || ""}">${esc(c.condition)}</span></div>
        </div>
        </button>
        <div class="car-buy">${waButton(c, "sm")}</div>
      </article>`).join("")}</div>`;
  },
};

function openCarDetail(id) {
  const c = adminData().cars.find((x) => x.id === id); if (!c) return;
  const photos = c.photos || [];
  const m = openModal({
    title: esc(c.name), wide: true,
    body: `<div class="detail-grid">
      <div style="display:grid;gap:10px;min-width:0">
        <div class="detail-photo">${photos[0] ? `<img id="d-main" src="${esc(photos[0])}" alt="${esc(c.name)}">` : `<div style="height:100%;display:grid;place-items:center" class="muted">No photo</div>`}</div>
        ${photos.length > 1 ? `<div class="thumbs">${photos.map((p, i) => `<button class="thumb" data-i="${i}" style="padding:0;cursor:pointer"><img src="${esc(p)}" alt="Photo ${i + 1}"></button>`).join("")}</div>` : ""}
      </div>
      <div style="display:grid;gap:14px;align-content:start">
        <div><div class="car-brand">${esc(c.brand)}</div><div class="car-price num" style="font-size:34px;margin-top:4px">${c.price ? idr(c.price) : "Price not set"}</div></div>
        <dl class="spec">
          <dt>Brand</dt><dd>${esc(c.brand)}</dd>
          <dt>Scale</dt><dd>${esc(c.scale)}</dd>
          <dt>Condition</dt><dd><span class="pill ${COND_CLASS[c.condition] || ""}">${esc(c.condition)}</span></dd>
          ${c.series ? `<dt>Series</dt><dd>${esc(c.series)}</dd>` : ""}
          ${c.year ? `<dt>Year</dt><dd>${esc(c.year)}</dd>` : ""}
          ${c.added ? `<dt>Logged</dt><dd>${esc(new Date(c.added).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</dd>` : ""}
        </dl>
        ${c.notes ? `<p style="color:var(--ink-2)">${esc(c.notes)}</p>` : ""}
      </div></div>`,
    foot: (ADMIN.on ? `<button class="btn danger" id="d-del">Delete</button><button class="btn" id="d-edit">${ICON.edit} Edit</button>` : "") + waButton(c),
  });
  $$(".thumbs [data-i]", m).forEach((b) => b.onclick = () => { m.querySelector("#d-main").src = photos[+b.dataset.i]; });
  if (ADMIN.on) {
    m.querySelector("#d-edit").onclick = () => openCarEditor(c.id);
    m.querySelector("#d-del").onclick = () => {
      openModal({ title: `Delete ${esc(c.name)}?`, body: "<p>This removes the car and its photos from the collection when you publish.</p>",
        foot: `<button class="btn" data-close>Cancel</button><button class="btn danger" id="del-yes">Delete car</button>`,
        onMount: (mm) => mm.querySelector("#del-yes").onclick = () => {
          ADMIN.draft.cars = ADMIN.draft.cars.filter((x) => x.id !== c.id);
          closeModal(); markDirty(); route(); toast("Car deleted. Publish to update the site.");
        } });
    };
  }
}

function openCarEditor(id) {
  const existing = id ? ADMIN.draft.cars.find((x) => x.id === id) : null;
  const c = existing ? JSON.parse(JSON.stringify(existing)) : { id: uid(), name: "", brand: "", scale: "1:64", condition: "Mint in box", price: "", series: "", year: "", notes: "", photos: [], added: new Date().toISOString().slice(0, 10) };
  const brands = [...new Set([...ADMIN.draft.cars.map((x) => x.brand), ...COMMON_BRANDS])].filter(Boolean).sort();
  const m = openModal({
    title: existing ? "Edit car" : "Add a car", wide: true,
    body: `<form id="car-form" class="form-grid" novalidate>
      <label class="field full"><span>Car name *</span><input class="input" id="f-name" required placeholder="e.g. Nissan Skyline GT-R (R34)" value="${esc(c.name)}"></label>
      <label class="field"><span>Brand *</span><input class="input" id="f-brand" list="brand-list" required placeholder="e.g. Hot Wheels" value="${esc(c.brand)}"><datalist id="brand-list">${brands.map((b) => `<option value="${esc(b)}">`).join("")}</datalist></label>
      <label class="field"><span>Scale</span><select class="select" id="f-scale">${SCALES.map((s) => `<option ${s === c.scale ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label class="field"><span>Condition</span><select class="select" id="f-cond">${CONDITIONS.map((s) => `<option ${s === c.condition ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label class="field"><span>Price (Rp)</span><input class="input num" id="f-price" type="number" min="0" step="1000" inputmode="numeric" placeholder="e.g. 125000" value="${esc(c.price)}"></label>
      <label class="field"><span>Series / line</span><input class="input" id="f-series" placeholder="e.g. Car Culture" value="${esc(c.series)}"></label>
      <label class="field"><span>Release year</span><input class="input" id="f-year" inputmode="numeric" placeholder="e.g. 2023" value="${esc(c.year)}"></label>
      <label class="field full"><span>Notes</span><textarea class="input" id="f-notes" rows="2" placeholder="Where you got it, variant, box condition…">${esc(c.notes)}</textarea></label>
      <div class="field full"><span>Photos (first one is the cover; click a photo to make it the cover)</span>
        <div class="thumbs" id="f-thumbs"></div>
        <label class="drop" id="f-drop">Drop photos here or <b>choose files</b><input type="file" id="f-files" accept="image/*" multiple hidden></label>
      </div>
      <p class="full muted" id="f-err" style="color:var(--bad)" hidden></p>
    </form>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="f-save">${existing ? "Save changes" : "Add to collection"}</button>`,
  });
  const thumbs = m.querySelector("#f-thumbs");
  const drawThumbs = () => {
    thumbs.innerHTML = c.photos.map((p, i) => `<div class="thumb${i === 0 ? " cover" : ""}" data-i="${i}" title="Make cover" style="cursor:pointer"><img src="${esc(p)}" alt=""><button type="button" data-rm="${i}" aria-label="Remove photo">×</button></div>`).join("");
  };
  drawThumbs();
  thumbs.onclick = (e) => {
    const rm = e.target.closest("[data-rm]");
    if (rm) { c.photos.splice(+rm.dataset.rm, 1); drawThumbs(); return; }
    const t = e.target.closest("[data-i]");
    if (t && +t.dataset.i > 0) { const [p] = c.photos.splice(+t.dataset.i, 1); c.photos.unshift(p); drawThumbs(); }
  };
  const addFiles = async (files) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    const drop = m.querySelector("#f-drop"); drop.textContent = "Processing photos…";
    for (const f of imgs.slice(0, 6)) {
      try { c.photos.push(await compressImage(f)); } catch (e) { toast(`Couldn't read ${f.name}.`); }
    }
    drop.innerHTML = `Drop photos here or <b>choose files</b><input type="file" id="f-files" accept="image/*" multiple hidden>`;
    bindInput(); drawThumbs();
  };
  const bindInput = () => { m.querySelector("#f-files").onchange = (e) => addFiles(e.target.files); };
  bindInput();
  const drop = m.querySelector("#f-drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); });
  const save = () => {
    const v = (s) => m.querySelector(s).value.trim();
    c.name = v("#f-name"); c.brand = v("#f-brand"); c.scale = v("#f-scale"); c.condition = v("#f-cond");
    c.price = v("#f-price") ? Math.max(0, Math.round(+v("#f-price"))) : ""; c.series = v("#f-series"); c.year = v("#f-year"); c.notes = v("#f-notes");
    const err = m.querySelector("#f-err");
    if (!c.name || !c.brand) { err.textContent = "Add a car name and a brand before saving."; err.hidden = false; return; }
    if (existing) Object.assign(existing, c);
    else { c.order = Date.now(); ADMIN.draft.cars.push(c); }
    closeModal(); markDirty(); route();
    toast(existing ? "Changes saved. Publish to update the site." : `${c.name} added. Publish to update the site.`);
  };
  m.querySelector("#f-save").onclick = save;
  m.querySelector("#car-form").addEventListener("submit", (e) => { e.preventDefault(); save(); });
}
