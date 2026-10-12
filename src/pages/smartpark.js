/* ===== SmartPark page: controls, drag & drop, visitor flow, sensor feed. Text follows LANG (ID/EN). ===== */
function drawSmartParkPreview(cv) {
  if (!cv) return;
  const box = cv.parentElement.getBoundingClientRect(); if (!box.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = box.width * dpr; cv.height = box.height * dpr;
  const g = cv.getContext("2d");
  const st = SP.createState(1);
  let r = 11; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  SP.SLOTS.forEach((s) => {
    const v = rnd();
    const occ = v < 0.6;
    st.display[s.id] = occ ? "occupied" : v < 0.66 ? "reserved" : "free";
    if (occ) st.cars.push({ id: 0, x: s.cx, y: s.cy, a: s.angle + (rnd() - .5) * .06, v: 0, kind: s.cat !== "Regular" ? s.cat : "Regular", color: ["#d23a3a", "#f4f4f2", "#9aa3ad", "#1d232b", "#2f63d6", "#e9b52f"][Math.floor(rnd() * 6)] });
  });
  ["A5", "A7", "A9"].forEach((id) => { st.display[id] = "free"; st.cars = st.cars.filter((c) => Math.hypot(c.x - SP.SLOT[id].cx, c.y - SP.SLOT[id].cy) > 1); });
  st.cars.push({ id: 0, x: 935, y: 210, a: 0, v: 60, kind: "Regular", color: "#2f63d6" });
  g.fillStyle = SP.colors().surface2; g.fillRect(0, 0, cv.width, cv.height);
  const s = Math.min(box.width / SP.W, box.height / SP.H);
  g.setTransform(dpr * s, 0, 0, dpr * s, (box.width - SP.W * s) / 2 * dpr, (box.height - SP.H * s) / 2 * dpr);
  SP.draw(g, st, SP.colors());
}

function spHeroUrl() {
  const u = (adminData().profile || {}).spHeroBg || (SITE.assets || {}).spHero || "";
  return u ? `url("${String(u).replace(/"/g, "%22")}")` : "none";
}

/* Page backgrounds, chosen from a dropdown and remembered in this browser:
   modern (navy tech), tradisional (batik kawung + tumpal), redline (red/blue light lines),
   cyber (violet/cyan tech mesh). The styles live in 81-theme-smartpark.css. */
const SLOT_STATE = { free: ["kosong", "free"], reserved: ["dipesan", "reserved"], occupied: ["terisi", "occupied"] };
const SP_THEMES = [["modern", ["Modern", "Modern"]], ["tradisional", ["Tradisional", "Traditional"]], ["redline", ["Redline", "Redline"]], ["cyber", ["Cyber Mix", "Cyber Mix"]]];
const spTheme = () => { const t = store.get("sp-theme", "modern"); return SP_THEMES.some(([k]) => k === t) ? t : "modern"; };
const catLabel = (cat) => pick(SP.CATS[cat].label);

PAGES.smartpark = {
  level: 1,
  kind: "Regular",
  newWorld() {
    const w = SP.createWorld();
    SP.FEED.length = 0; SP.seed(w[1], 16); SP.seed(w[2], 11); SP.FEED.length = 0;
    w.onExit = (c) => { if (this.track && this.track.id === c.id) this.track.exited = { at: Date.now(), ms: c.parkedAt ? (c.leftSlotAt || Date.now()) - c.parkedAt : null }; if (this.sel === c.id) this.sel = null; };
    w.onTransfer = (c, from, to) => {
      if (c.id === this.sel && this.follow) { this.setLevel(to); toast(tt(`Mobil #${c.id} ${to === 2 ? "turun lewat ramp ke Basement 2" : "naik lewat ramp ke Basement 1"}.`, `Car #${c.id} ${to === 2 ? "went down the ramp to Basement 2" : "came up the ramp to Basement 1"}.`), 2600); }
    };
    return w;
  },
  setLevel(n) {
    this.level = n;
    $$("[data-level]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.level === n)));
    const t = $("#sp-av-title"); if (t) t.textContent = `${tt("Ketersediaan", "Availability")} · Basement ${n}`;
    this.ui(); this.renderFlow();
  },
  /* keep = true re-draws the page (e.g. after a language change) without resetting the simulation. */
  mount(view, keep) {
    this.el = view;
    if (!keep) {
      this.world = this.newWorld();
      this.level = 1; this.sel = null; this.follow = true; this.kind = "Regular";
      SP.addLog(this.world[1], ["Gateway sensor simulasi aktif · 100 sensor slot di B1 dan B2", "Simulated sensor gateway online · 100 slot sensors across B1 and B2"], "sensor");
      this.track = null; // the visitor car whose journey the flow panel follows
    }
    const theme = spTheme();
    document.body.dataset.spTheme = theme;
    view.lang = LANG.get();
    const kindName = { Regular: ["Pengemudi reguler", "Regular driver"], EV: ["Pengemudi mobil listrik", "EV driver"], Ladies: ["Pengemudi wanita", "Lady driver"], VIP: ["Member VIP", "VIP member"] };
    const kindOpts = SP.KINDS.map((k) => `<option value="${k}" ${k === this.kind ? "selected" : ""}>${pick(kindName[k])}</option>`).join("");
    view.innerHTML = `
    <section class="sp-hero" style="--hero:${esc(spHeroUrl())}">
      <div class="wrap sp-hero-in">
        <div class="sp-hero-top"><div class="eyebrow">${tt("Proyek unggulan · Navigasi parkir mal", "Featured project · Mall parking navigation")}</div>
          <div class="sp-hero-ctrl">
            <label class="sp-bg"><span>${tt("Latar", "Background")}</span><select class="select" id="sp-theme">${SP_THEMES.map(([k, l]) => `<option value="${k}" ${k === theme ? "selected" : ""}>${pick(l)}</option>`).join("")}</select></label>
            ${langSwitch("on-dark")}
          </div></div>
        <h1>SmartPark</h1>
        <p>${tt("SmartPark adalah navigasi parkir mal yang membantu pengunjung menemukan slot kosong tanpa harus berputar-putar di basement. Pindai QRIS di gerbang B1, buka peta parkir, pilih slot di Basement 1 atau turun lewat ramp ke Basement 2, parkir, lalu naik kembali ke ramp keluar setelah selesai.", "SmartPark is mall parking navigation that helps visitors find an empty slot without circling the basement. Scan QRIS at the B1 gate, open the parking map, pick a slot on Basement 1 or take the ramp down to Basement 2, park, and drive back up to the exit ramp when you're done.")}</p>
        <div class="sp-hero-facts"><span><b>2</b> basement${tt("", "s")}</span><span><b>100</b> ${tt("slot bersensor", "sensor slots")}</span><span>EV · ${tt("Wanita", "Ladies")} · VIP</span></div>
      </div>
    </section>
    <div class="bleed">
      <div class="sp-layout">
        <div class="panel sp-stage">
          <div class="sp-top">
            <div class="seg sp-levels" role="tablist" aria-label="${tt("Lantai basement", "Basement level")}">
              <button role="tab" data-level="1" aria-pressed="${this.level === 1}">Basement 1 <span class="num" id="lv-free-1"></span></button>
              <button role="tab" data-level="2" aria-pressed="${this.level === 2}">Basement 2 <span class="num" id="lv-free-2"></span></button>
            </div>
            <div class="cat-chips" id="sp-cats" aria-label="${tt("Kategori parkir khusus", "Special parking categories")}"></div>
          </div>
          <div class="sp-controls">
            <label><span class="sr">${tt("Jenis pengemudi", "Driver type")}</span><select class="select" id="sp-kind" style="width:auto">${kindOpts}</select></label>
            <button class="btn primary sm" id="sp-enter">${ICON.plus} ${tt("Masuk mal", "Enter mall")}</button>
            <button class="btn sm" id="sp-auto">${tt("Parkir Otomatis", "Auto Park Selected")}</button>
            <button class="btn sm" id="sp-rush">${tt("Jam sibuk +8", "Rush hour +8")}</button>
            <label class="toggle"><input type="checkbox" id="sp-traffic" ${this.world.traffic ? "checked" : ""}> ${tt("Lalu lintas live", "Live traffic")}</label>
            <label class="toggle" title="${tt("Pindah lantai otomatis saat mobil terpilih melewati ramp", "Switch floors automatically when the selected car takes a ramp")}"><input type="checkbox" id="sp-follow" ${this.follow ? "checked" : ""}> ${tt("Ikuti mobil", "Follow car")}</label>
            <button class="btn sm danger" id="sp-reset" style="margin-left:auto">${tt("Atur ulang", "Reset")}</button>
          </div>
          <div class="sp-canvas-wrap" id="sp-wrap"><canvas id="sp-canvas" aria-label="${tt("Peta parkir basement. Seret mobil ke slot kosong untuk memarkirnya.", "Basement parking map. Drag a car onto a free slot to park it.")}"></canvas></div>
          <p class="muted sp-hint">${tt("Seret mobil dengan mouse (atau jari) ke slot kosong untuk memarkirnya. Klik mobil untuk memilihnya, lalu klik slot kosong di basement mana pun untuk bernavigasi ke sana. Mobil yang menuju Basement 2 memakai ramp di kanan atas B1 dan kembali naik lewat ramp di kiri atas B2. Slot EV, Wanita, dan VIP di pojok kanan atas hanya untuk pengemudi yang sesuai.", "Drag any car with the mouse (or your finger) onto a free slot to park it. Click a car to select it, then click a free slot on either basement to navigate there; cars bound for Basement 2 use the ramp at the top-right of B1 and come back up the ramp at the top-left of B2. EV, Ladies and VIP slots in the top-right corner only accept matching drivers.")}</p>
        </div>
        <aside class="sp-side">
          <div class="panel sp-card"><h3>${tt("Alur pengunjung", "Visitor flow")}</h3><ol class="flow" id="sp-flow"></ol></div>
          <div class="panel sp-card">
            <h3 id="sp-av-title">${tt("Ketersediaan", "Availability")} · Basement ${this.level}</h3>
            <div class="sp-big"><b id="sp-free" class="num">50</b><span>${tt("dari 50 slot kosong", "of 50 slots free")}</span></div>
            <div class="bar" id="sp-bar"></div>
            <div class="sp-legend"><span><i style="background:var(--ok-soft);box-shadow:inset 0 0 0 1.5px var(--ok)"></i>${tt("Kosong", "Free")} <b id="sp-n-free" class="num">0</b></span><span><i style="background:var(--amber)"></i>${tt("Dipesan", "Reserved")} <b id="sp-n-res" class="num">0</b></span><span><i style="background:var(--bad)"></i>${tt("Terisi", "Occupied")} <b id="sp-n-occ" class="num">0</b></span></div>
            <div class="cat-avail" id="sp-cat-avail"></div>
          </div>
          <div class="panel sp-card"><h3>${tt("Status slot", "Slot status")}</h3><div class="slot-grid" id="sp-grid"></div></div>
          <div class="panel sp-card"><h3>${tt("Mobil terpilih", "Selected car")}</h3><div class="sp-selected" id="sp-sel"></div></div>
          <div class="panel sp-card">
            <h3>${tt("Feed sensor IoT · simulasi", "IoT sensor feed · simulated")}</h3>
            <div class="iot-status"><span class="dot"></span><span id="sp-gw">${tt("Gateway simulasi · 100 sensor", "Simulated gateway · 100 sensors")}</span></div>
            <div class="log" id="sp-log"></div>
            <p class="muted" style="font-size:12px">${tt("Hanya demo. Data sensor dibuat di browser dan tidak terhubung ke perangkat keras sungguhan.", "Demo only. Sensor readings are generated in the browser and aren't connected to real hardware.")}</p>
          </div>
        </aside>
      </div>
    </div>`;
    const cv = $("#sp-canvas"), wrapEl = $("#sp-wrap"), g = cv.getContext("2d");
    let C = SP.colors(), scale = 1, dpr = 1, hl = null, drop = null;
    const resize = () => { const r = wrapEl.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); scale = r.width / SP.W; };
    resize();
    this.ro = new ResizeObserver(resize); this.ro.observe(wrapEl);
    this.mo = new MutationObserver(() => { C = SP.colors(); }); this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    this.mq = matchMedia("(prefers-color-scheme: dark)"); this.mqf = () => { C = SP.colors(); }; this.mq.addEventListener("change", this.mqf);
    $("#sp-theme").addEventListener("change", (e) => {
      const t = e.target.value; store.set("sp-theme", t); document.body.dataset.spTheme = t; C = SP.colors();
    });
    const st = () => this.world[this.level];
    const sel = () => (this.sel ? SP.findCar(this.world, this.sel) : null);

    const grid = $("#sp-grid");
    grid.innerHTML = SP.ROWS.map((row) => `<span class="rl">${row.r}</span>` + SP.SLOTS.filter((s) => s.row === row.r).map((s) => `<button data-slot="${s.id}" data-cat="${s.cat}" aria-label="Slot ${s.id}${s.cat !== "Regular" ? " (" + catLabel(s.cat) + ")" : ""}">${s.cat === "Regular" ? s.i + 1 : SP.CATS[s.cat].glyph}</button>`).join("")).join("");
    grid.addEventListener("mouseover", (e) => { const b = e.target.closest("[data-slot]"); hl = b ? b.dataset.slot : null; });
    grid.addEventListener("mouseleave", () => hl = null);
    $$("[data-level]").forEach((b) => b.onclick = () => this.setLevel(+b.dataset.level));

    const pickCarFirst = () => toast(tt("Pilih mobil dulu, atau tekan Masuk mal.", "Select a car first, or press Enter mall."));
    const scanFirst = () => toast(tt("Pindai QRIS dulu untuk membuka gerbang.", "Scan QRIS first to open the gate."));
    const leaving = (id) => toast(tt(`Mobil #${id} sedang menuju pintu keluar.`, `Car #${id} is on its way out.`));
    const sendTo = (slotId) => {
      const f = sel();
      if (!f) return pickCarFirst();
      const car = f.car;
      if (car.atGate) return scanFirst();
      if (car.mode === "leaving") return leaving(car.id);
      const chk = SP.canPark(st(), car, SP.SLOT[slotId]);
      if (!chk.ok) { toast(pick(chk.reason)); return; }
      const t = SP.parkAnywhere(this.world, car, f.level, this.level, slotId);
      if (!t) { toast(tt("Belum ada rute ke slot itu saat ini.", "No route to that slot right now.")); return; }
      const via = t.level !== f.level;
      SP.addLog(this.world[f.level], [`Mobil #${car.id} bernavigasi ke ${SP.code(t.level, slotId)}${via ? ` lewat ramp ${t.level === 2 ? "turun" : "naik"}` : ""}`, `Car #${car.id} navigating to ${SP.code(t.level, slotId)}${via ? ` via the ramp ${t.level === 2 ? "down" : "up"}` : ""}`]);
      if (via) toast(tt(`Mobil #${car.id} akan ${t.level === 2 ? "turun lewat ramp ke Basement 2" : "naik lewat ramp ke Basement 1"}.`, `Car #${car.id} will take the ramp ${t.level === 2 ? "down to Basement 2" : "up to Basement 1"}.`));
      this.renderFlow();
    };
    grid.addEventListener("click", (e) => { const b = e.target.closest("[data-slot]"); if (b) sendTo(b.dataset.slot); });

    /* pointer: click to select / route, drag to move a car */
    const toWorld = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]; };
    const carAt = (x, y) => st().cars.slice().reverse().find((c) => Math.hypot(c.x - x, c.y - y) < 22);
    let drag = null;
    cv.addEventListener("pointerdown", (e) => {
      const [x, y] = toWorld(e);
      const car = carAt(x, y);
      if (car) {
        this.sel = car.id; if (car.user) this.track = { id: car.id };
        this.renderFlow();
        if (car.atGate) return scanFirst();
        drag = { car, sx: x, sy: y, moved: false, origin: null, offx: car.x - x, offy: car.y - y };
        cv.setPointerCapture(e.pointerId); e.preventDefault();
        return;
      }
      const s = SP.slotAt(x, y);
      if (s) sendTo(s.id);
    });
    cv.addEventListener("pointermove", (e) => {
      const [x, y] = toWorld(e);
      if (drag) {
        if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) > 5) { drag.moved = true; drag.origin = SP.beginDrag(st(), drag.car); cv.style.cursor = "grabbing"; }
        if (drag.moved) {
          SP.dragTo(st(), drag.car, x + drag.offx, y + drag.offy);
          const s = SP.slotAt(drag.car.x, drag.car.y);
          drop = s ? s.id : null; this.dropOk = s ? SP.canPark(st(), drag.car, s).ok : false;
        }
        return;
      }
      const s = SP.slotAt(x, y); hl = s ? s.id : null;
      cv.style.cursor = carAt(x, y) ? "grab" : (s && st().display[s.id] === "free" ? "pointer" : "default");
    });
    const endDrag = () => {
      if (!drag) return;
      if (drag.moved && st().cars.includes(drag.car)) {
        const res = SP.endDrag(st(), drag.car, drag.origin);
        if (res.msg) { if (res.ok) SP.addLog(st(), res.msg); else toast(pick(res.msg)); }
      }
      drag = null; drop = null; cv.style.cursor = "default"; this.renderFlow();
    };
    cv.addEventListener("pointerup", endDrag);
    cv.addEventListener("pointercancel", endDrag);
    cv.addEventListener("pointerleave", () => { if (!drag) hl = null; });

    /* controls */
    const enter = () => {
      if (this.track && !this.track.exited) {
        const f = SP.findCar(this.world, this.track.id);
        if (f && f.car.atGate) { toast(tt("Mobil Anda sudah menunggu di gerbang. Pindai QRIS untuk melanjutkan.", "Your car is already waiting at the gate. Scan QRIS to continue.")); return; }
      }
      const c = SP.arriveAtGate(this.world, $("#sp-kind").value);
      if (!c) { toast(tt("Jalur masuk sedang padat. Coba lagi sebentar lagi.", "The entry lane is busy. Try again in a moment.")); return; }
      this.sel = c.id; this.track = { id: c.id };
      if (this.level !== 1) this.setLevel(1);
      this.renderFlow();
    };
    const autoSel = () => {
      const f = sel();
      if (!f) return pickCarFirst();
      const c = f.car;
      if (c.atGate) return scanFirst();
      if (c.mode === "parked") return toast(tt(`Mobil #${c.id} sudah parkir di ${SP.code(f.level, c.parked)}.`, `Car #${c.id} is already parked in ${SP.code(f.level, c.parked)}.`));
      if (c.mode === "leaving") return leaving(c.id);
      const t = SP.parkAnywhere(this.world, c, f.level);
      if (t) {
        const cat = t.slot.cat !== "Regular" ? SP.CATS[t.slot.cat].label : null, code = SP.code(t.level, t.slot.id), via = t.level !== f.level;
        SP.addLog(this.world[f.level], [`Pilihan otomatis merekomendasikan ${code}${cat ? ` (${cat[0]})` : ""} untuk mobil #${c.id}`, `Auto-select recommended ${code}${cat ? ` (${cat[1]})` : ""} for car #${c.id}`]);
        toast(tt(`Slot rekomendasi ${code}${cat ? ` · ${cat[0]}` : ""}${via ? " · lewat ramp" : ""}. Navigasi dimulai.`, `Recommended slot ${code}${cat ? ` · ${cat[1]}` : ""}${via ? " · via the ramp" : ""}. Navigating now.`));
      } else toast(tt("Kedua basement penuh untuk jenis pengemudi ini.", "Both basements are full for this driver type."));
      this.renderFlow();
    };
    this.actions = {
      enter, autoSel,
      scan: () => this.openQris(),
      finish: () => {
        const f = this.track && SP.findCar(this.world, this.track.id);
        if (!f) return;
        this.sel = f.car.id;
        SP.leave(this.world, f.car, f.level);
        SP.addLog(this.world[f.level], [`Mobil #${f.car.id} selesai berbelanja · menuju ${f.level === 2 ? "ramp naik ke B1, lalu " : ""}ramp keluar`, `Car #${f.car.id} finished shopping · heading ${f.level === 2 ? "up the ramp to B1, then " : ""}to the exit ramp`]);
        this.renderFlow();
      },
    };
    $("#sp-kind").onchange = (e) => { this.kind = e.target.value; };
    $("#sp-enter").onclick = enter;
    $("#sp-auto").onclick = autoSel;
    $("#sp-rush").onclick = () => { this.world.queue += 8; SP.addLog(this.world[1], ["Jam sibuk: 8 mobil mengantre di gerbang masuk B1", "Rush hour: 8 cars queued at the B1 entry gate"]); };
    $("#sp-traffic").onchange = (e) => { const w = this.world; w.traffic = e.target.checked; w.nextSpawn = w.t; w.nextLeave = w.t + 4; SP.addLog(null, e.target.checked ? ["Lalu lintas live aktif (kedua basement)", "Live traffic on (both basements)"] : ["Lalu lintas live nonaktif", "Live traffic off"]); };
    $("#sp-follow").onchange = (e) => { this.follow = e.target.checked; };
    $("#sp-reset").onclick = () => {
      this.world = this.newWorld(); this.track = null; this.sel = null; $("#sp-traffic").checked = false;
      SP.addLog(null, ["Simulasi diatur ulang", "Simulation reset"], "app"); this.setLevel(1);
    };
    $("#sp-flow").addEventListener("click", (e) => { const b = e.target.closest("[data-flow]"); if (b && this.actions[b.dataset.flow]) this.actions[b.dataset.flow](); });

    this.renderFlow(); this.renderLog();
    let last = performance.now(), uiT = 0, lastFeed = SP.FEED[0];
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const w = this.world;
      w[1].selected = w[2].selected = this.sel;
      SP.step(w, dt);
      g.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      SP.draw(g, st(), C, { hl, drop, dropOk: this.dropOk });
      uiT -= dt;
      if (uiT <= 0) {
        uiT = 0.2; this.ui();
        if (SP.FEED[0] !== lastFeed) { lastFeed = SP.FEED[0]; this.renderLog(); }
        const fs = this.flowSig(); if (fs !== this._fs) { this._fs = fs; this.renderFlow(); }
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  },
  /* Language change: rebuild the page text in place; cars, slots and the flow keep going. */
  onLang() { const y = window.scrollY; closeModal(); this.stop(); this._fs = null; this.mount(this.el, true); window.scrollTo(0, y); },
  trackedCar() { if (!this.track) return null; const f = SP.findCar(this.world, this.track.id); return f ? f.car : null; },
  trackedLevel() { const f = this.track && SP.findCar(this.world, this.track.id); return f ? f.level : 1; },
  flowStage() {
    const t = this.track; if (!t) return 0;
    if (t.exited) return 7;
    const c = this.trackedCar(); if (!c) return 0;
    if (c.atGate) return 1;
    if (c.mode === "leaving") return 6;
    if (c.mode === "parked" || c.parked) return 5;
    if (c.mode === "auto" && (c.target || c.goal)) return 4;
    return 3;
  },
  flowSig() { const c = this.trackedCar(); return [this.flowStage(), c && c.target, c && c.parked, c && JSON.stringify(c.goal), this.trackedLevel()].join("|"); },
  renderFlow() {
    const el = $("#sp-flow"); if (!el) return;
    const stage = this.flowStage(), c = this.trackedCar(), lv = this.trackedLevel();
    const dest = c ? (c.goal && c.goal.slot ? `${SP.code(c.goal.level, c.goal.slot)} (${tt("lewat ramp", "via the ramp")})` : c.target ? SP.code(lv, c.target) : "") : "";
    const done = tt("Selesai", "Done");
    const ex = this.track && this.track.exited;
    const steps = [
      [tt("Masuk mal", "Enter the mall"), stage === 0 ? `<button class="btn sm primary" data-flow="enter">${tt("Masuk mal", "Enter mall")}</button>` : tt(`Mobil #${this.track.id} di gerbang masuk B1`, `Car #${this.track.id} at the B1 entry gate`)],
      [tt("Pindai QRIS di gerbang", "Scan QRIS at the gate"), stage === 1 ? `<button class="btn sm primary" data-flow="scan">${tt("Pindai QRIS", "Scan QRIS")}</button>` : stage > 1 ? tt("Gerbang terbuka", "Gate opened") : ""],
      [tt("Buka peta parkir", "Open the parking map"), stage >= 2 ? tt("Peta Basement 1 &amp; 2 dengan status slot terkini", "Basement 1 &amp; 2 maps with live slot status") : ""],
      [tt("Pilih slot atau otomatis", "Pick a slot or auto-select"), stage === 3 ? `${tt("Seret mobil ke slot, klik slot kosong di basement mana pun, atau", "Drag the car onto a slot, click a free slot on either basement, or")} <button class="btn sm" data-flow="autoSel">${tt("Parkir Otomatis", "Auto Park Selected")}</button>` : stage > 3 ? tt("Slot dipilih", "Slot chosen") : ""],
      [tt("Parkir", "Park"), stage === 4 && c ? `${tt("Menuju", "Navigating to")} ${dest}` : stage === 5 && c ? `${tt("Parkir di", "Parked in")} ${SP.code(lv, c.parked)}` : stage > 5 ? done : ""],
      [tt("Selesaikan aktivitas", "Finish your activities"), stage === 5 ? `<button class="btn sm" data-flow="finish">${tt("Selesai &amp; keluar", "Finish &amp; exit")}</button>` : stage > 5 ? done : ""],
      [tt("Keluar dari mal", "Exit the mall"), stage === 6 ? (lv === 2 ? tt("Naik lewat ramp ke Basement 1", "Taking the ramp up to Basement 1") : tt("Menuju ramp keluar", "Driving to the exit ramp")) : stage === 7 ? `${tt("Sudah keluar", "Exited")}${ex.ms != null ? ` · ${tt("parkir", "parked")} ${SP.dur(ex.ms)}` : ""}. <button class="btn sm" data-flow="enter">${tt("Mulai lagi", "Start again")}</button>` : ""],
    ];
    const cur = stage === 7 ? 7 : stage === 2 ? 3 : stage;
    el.innerHTML = steps.map(([t, d], i) => {
      const state = i < cur || stage === 7 ? "done" : i === cur ? "now" : "todo";
      return `<li class="${state}"><span class="n">${state === "done" ? "✓" : i + 1}</span><div><b>${t}</b>${d && state !== "todo" ? `<div class="d">${d}</div>` : ""}</div></li>`;
    }).join("");
  },
  openQris() {
    const c = this.trackedCar();
    if (!c || !c.atGate) { toast(tt("Tidak ada mobil yang menunggu di gerbang.", "No car is waiting at the gate.")); return; }
    let r = c.id * 977 + 13; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const n = 25, cell = 8; let rects = "";
    const finder = (x, y) => (x < 7 && y < 7) || (x > n - 8 && y < 7) || (x < 7 && y > n - 8);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let on;
      if (finder(x, y)) { const fx = x < 7 ? x : x - (n - 7), fy = y < 7 ? y : y - (n - 7); on = fx === 0 || fy === 0 || fx === 6 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4); }
      else on = rnd() < 0.48;
      if (on) rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`;
    }
    const m = openModal({
      title: tt("Pindai QRIS di gerbang", "Scan QRIS at the gate"),
      body: `<div class="qris"><div class="qris-head"><b>QRIS</b><span>Grand Avenue Mall · ${tt("Masuk parkir", "Parking entry")}</span></div>
        <svg viewBox="-8 -8 ${n * cell + 16} ${n * cell + 16}" width="220" height="220" role="img" aria-label="${tt("Kode QR demo", "Demo QR code")}"><rect x="-8" y="-8" width="${n * cell + 16}" height="${n * cell + 16}" fill="#fff"/><g fill="#111">${rects}</g></svg>
        <span class="mono muted">${tt("Tiket", "Ticket")} IN-${String(c.id).padStart(5, "0")}</span></div>
        <p class="muted" style="font-size:13px">${tt(`Hanya demo. Pemindaian membuat sesi parkir untuk mobil #${c.id} dan membuka gerbang. Tidak ada pembayaran yang diproses.`, `Demo only. Scanning creates a parking session for car #${c.id} and opens the gate. No payment is processed.`)}</p>`,
      foot: `<button class="btn" data-close>${tt("Batal", "Cancel")}</button><button class="btn primary" id="qris-ok">${tt("Simulasikan pemindaian berhasil", "Simulate successful scan")}</button>`,
    });
    m.querySelector("#qris-ok").onclick = () => {
      closeModal();
      const car = this.trackedCar(); if (!car || !car.atGate) return;
      SP.openGate(this.world, car);
      if (this.level !== 1) this.setLevel(1);
      toast(tt("Gerbang terbuka. Peta parkir siap: pilih slot atau gunakan Parkir Otomatis.", "Gate open. Parking map ready: pick a slot or use Auto Park Selected."), 3500);
      this.renderFlow();
    };
  },
  ui() {
    const w = this.world, S = w[this.level];
    const fe = $("#sp-free"); if (!fe) return;
    const count = (St) => { const k = { free: 0, reserved: 0, occupied: 0 }; SP.SLOTS.forEach((s) => k[St.display[s.id] || "free"]++); return k; };
    const k = count(S);
    [1, 2].forEach((n) => { const e = $("#lv-free-" + n); if (e) e.textContent = `· ${count(w[n]).free} ${tt("kosong", "free")}`; });
    fe.textContent = k.free; fe.classList.toggle("full", k.free === 0);
    $("#sp-n-free").textContent = k.free; $("#sp-n-res").textContent = k.reserved; $("#sp-n-occ").textContent = k.occupied;
    $("#sp-bar").innerHTML = `<i style="width:${k.occupied * 2}%;background:var(--bad)"></i><i style="width:${k.reserved * 2}%;background:var(--amber)"></i>`;
    const catFree = (cat) => SP.SLOTS.filter((s) => s.cat === cat && S.display[s.id] === "free").length;
    const catTotal = (cat) => SP.SLOTS.filter((s) => s.cat === cat).length;
    $("#sp-cats").innerHTML = Object.keys(SP.CATS).map((cat) => `<span class="cat-chip" style="--c:var(${SP.CATS[cat].token})"><i>${SP.CATS[cat].glyph}</i>${catLabel(cat)} <b class="num">${catFree(cat)}/${catTotal(cat)}</b></span>`).join("");
    $("#sp-cat-avail").innerHTML = `<span class="muted" style="font-size:12.5px">${tt("Slot khusus (pojok kanan atas):", "Special slots (top-right corner):")}</span> ` + Object.keys(SP.CATS).map((cat) => `<span>${catLabel(cat)} ${catFree(cat)} ${tt("dari", "of")} ${catTotal(cat)} ${tt("kosong", "free")}</span>`).join(" · ");
    $$("#sp-grid [data-slot]").forEach((b) => { const v = S.display[b.dataset.slot] || "free"; b.className = v === "occupied" ? "occ" : v === "reserved" ? "res" : "free"; b.title = `${SP.code(S, b.dataset.slot)}: ${pick(SLOT_STATE[v])}${b.dataset.cat !== "Regular" ? " · " + catLabel(b.dataset.cat) : ""}`; });
    const ago = (Date.now() - Math.max(w[1].lastReading, w[2].lastReading)) / 1000;
    $("#sp-gw").textContent = `${tt("Gateway simulasi · 100 sensor · pembacaan terakhir", "Simulated gateway · 100 sensors · last reading")} ${ago < 1 ? tt("baru saja", "just now") : ago < 60 ? Math.round(ago) + tt(" dtk lalu", " s ago") : Math.round(ago / 60) + tt(" mnt lalu", " min ago")}`;
    const f = this.sel ? SP.findCar(w, this.sel) : null;
    const el = $("#sp-sel");
    if (!f) { el.innerHTML = `<p class="muted">${tt("Belum ada mobil terpilih. Tekan <b>Masuk mal</b> atau klik mobil di peta.", "No car selected. Press <b>Enter mall</b> or click a car on the map.")}</p>`; return; }
    const c = f.car;
    const modeTxt = c.atGate ? tt("Menunggu di gerbang", "Waiting at the gate") : c.mode === "drag" ? tt("Sedang dipindahkan", "Being moved") : c.mode === "parked" || c.parked ? `${tt("Parkir di", "Parked in")} ${SP.code(f.level, c.parked)}` : c.mode === "leaving" ? (f.level === 2 ? tt("Naik ramp ke B1, lalu keluar", "Ramp up to B1, then exit") : tt("Menuju ramp keluar", "Driving to the exit ramp")) : c.mode === "auto" && c.goal && c.goal.slot ? tt(`Ke ${SP.code(c.goal.level, c.goal.slot)} lewat ramp`, `To ${SP.code(c.goal.level, c.goal.slot)} via the ramp`) : c.mode === "auto" && c.target ? `${tt("Menuju", "Navigating to")} ${SP.code(f.level, c.target)}` : tt("Memilih slot", "Choosing a slot");
    const pill = c.parked || c.mode === "parked" ? "info" : c.mode === "auto" ? "warn" : c.mode === "leaving" ? "plain" : "ok";
    el.innerHTML = `<div class="row"><b>${tt("Mobil", "Car")} #${c.id}</b><span class="pill ${pill}">${modeTxt}</span></div>
      <div class="row"><span class="muted">${tt("Posisi", "Now on")}</span><span>Basement ${f.level}${f.level !== this.level ? ` · <button class="btn ghost sm" style="padding:0 4px" onclick="PAGES.smartpark.setLevel(${f.level})">${tt("lihat", "show")}</button>` : ""}</span></div>
      <div class="row"><span class="muted">${tt("Pengemudi", "Driver")}</span><span>${SP.kindLabel(c.kind)}</span></div>
      <div class="row"><span class="muted">${tt("Kecepatan", "Speed")}</span><span class="num mono">${Math.round(Math.abs(c.v) * 0.15)} km/h</span></div>
      <div class="row"><span class="muted">${tt("Mobil di B1 / B2", "Cars in B1 / B2")}</span><span class="num mono">${w[1].cars.length} / ${w[2].cars.length}${w.queue ? ` · ${w.queue} ${tt("antre", "queued")}` : ""}</span></div>`;
  },
  renderLog() {
    const el = $("#sp-log"); if (!el) return;
    const fmt = (t) => new Date(t).toLocaleTimeString(locale(), { hour12: false });
    el.innerHTML = SP.FEED.slice(0, 40).map((l) => `<div class="${l.kind}"><time>${fmt(l.time)}</time><span>${l.kind === "sensor" ? "<b>SENSOR</b> " : ""}${esc(pick(l.msg))}</span></div>`).join("");
  },
  stop() {
    cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect(); if (this.mo) this.mo.disconnect(); if (this.mq) this.mq.removeEventListener("change", this.mqf);
  },
  unmount() {
    this.stop();
    delete document.body.dataset.spTheme;
    closeModal();
  },
};
