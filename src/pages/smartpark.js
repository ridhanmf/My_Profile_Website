/* ===== SmartPark page: controls, drag & drop, visitor flow, sensor feed ===== */
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

/* Page look: "modern" (navy tech) or "tradisional" (batik kawung + tumpal, sogan & indigo). */
const SLOT_STATE = { free: "kosong", reserved: "dipesan", occupied: "terisi" };
const SP_THEMES = ["modern", "tradisional"];
const spTheme = () => { const t = store.get("sp-theme", "modern"); return SP_THEMES.includes(t) ? t : "modern"; };

PAGES.smartpark = {
  level: 1,
  newWorld() {
    const w = SP.createWorld();
    SP.FEED.length = 0; SP.seed(w[1], 16); SP.seed(w[2], 11); SP.FEED.length = 0;
    w.onExit = (c) => { if (this.track && this.track.id === c.id) this.track.exited = { at: Date.now(), parked: c.parkedAt ? SP.dur((c.leftSlotAt || Date.now()) - c.parkedAt) : null }; if (this.sel === c.id) this.sel = null; };
    w.onTransfer = (c, from, to) => {
      if (c.id === this.sel && this.follow) { this.setLevel(to); toast(`Mobil #${c.id} ${to === 2 ? "turun lewat ramp ke Basement 2" : "naik lewat ramp ke Basement 1"}.`, 2600); }
    };
    return w;
  },
  setLevel(n) {
    this.level = n;
    $$("[data-level]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.level === n)));
    const t = $("#sp-av-title"); if (t) t.textContent = `Ketersediaan · Basement ${n}`;
    this.ui(); this.renderFlow();
  },
  mount(view) {
    this.world = this.newWorld();
    this.level = 1; this.sel = null; this.follow = true;
    SP.addLog(this.world[1], "Gateway sensor simulasi aktif · 100 sensor slot di B1 dan B2", "sensor");
    this.track = null; // the visitor car whose journey the flow panel follows
    const theme = spTheme();
    document.body.dataset.spTheme = theme;
    const themeSwitch = `<div class="seg sp-theme" role="group" aria-label="Tema tampilan">${SP_THEMES.map((t) => `<button type="button" data-sptheme="${t}" aria-pressed="${t === theme}">${t === "modern" ? "Modern" : "Tradisional"}</button>`).join("")}</div>`;
    const kindOpts = SP.KINDS.map((k) => `<option value="${k}">${k === "Regular" ? "Pengemudi reguler" : k === "EV" ? "Pengemudi mobil listrik" : k === "Ladies" ? "Pengemudi wanita" : "Member VIP"}</option>`).join("");
    view.innerHTML = `
    <section class="sp-hero" style="--hero:${esc(spHeroUrl())}">
      <div class="wrap sp-hero-in">
        <div class="sp-hero-top"><div class="eyebrow">Proyek unggulan · Navigasi parkir mal</div>${themeSwitch}</div>
        <h1>SmartPark</h1>
        <p>SmartPark adalah navigasi parkir mal yang membantu pengunjung menemukan slot kosong tanpa harus berputar-putar di basement. Pindai QRIS di gerbang B1, buka peta parkir, pilih slot di Basement 1 atau turun lewat ramp ke Basement 2, parkir, lalu naik kembali ke ramp keluar setelah selesai.</p>
        <div class="sp-hero-facts"><span><b>2</b> basement</span><span><b>100</b> slot bersensor</span><span>EV · Wanita · VIP</span><span>Lajur kiri</span></div>
      </div>
    </section>
    <div class="bleed">
      <div class="sp-layout">
        <div class="panel sp-stage">
          <div class="sp-top">
            <div class="seg sp-levels" role="tablist" aria-label="Lantai basement">
              <button role="tab" data-level="1" aria-pressed="true">Basement 1 <span class="num" id="lv-free-1"></span></button>
              <button role="tab" data-level="2" aria-pressed="false">Basement 2 <span class="num" id="lv-free-2"></span></button>
            </div>
            <div class="cat-chips" id="sp-cats" aria-label="Kategori parkir khusus"></div>
          </div>
          <div class="sp-controls">
            <label><span class="sr">Jenis pengemudi</span><select class="select" id="sp-kind" style="width:auto">${kindOpts}</select></label>
            <button class="btn primary sm" id="sp-enter">${ICON.plus} Masuk mal</button>
            <button class="btn sm" id="sp-auto">Parkir Otomatis</button>
            <button class="btn sm" id="sp-rush">Jam sibuk +8</button>
            <label class="toggle"><input type="checkbox" id="sp-traffic"> Lalu lintas live</label>
            <label class="toggle" title="Pindah lantai otomatis saat mobil terpilih melewati ramp"><input type="checkbox" id="sp-follow" checked> Ikuti mobil</label>
            <button class="btn sm danger" id="sp-reset" style="margin-left:auto">Atur ulang</button>
          </div>
          <div class="sp-canvas-wrap" id="sp-wrap"><canvas id="sp-canvas" aria-label="Peta parkir basement. Seret mobil ke slot kosong untuk memarkirnya."></canvas></div>
          <p class="muted sp-hint">Seret mobil dengan mouse (atau jari) ke slot kosong untuk memarkirnya. Klik mobil untuk memilihnya, lalu klik slot kosong di basement mana pun untuk bernavigasi ke sana. Mobil yang menuju Basement 2 memakai ramp di kanan atas B1 dan kembali naik lewat ramp di kiri atas B2. Slot EV, Wanita, dan VIP di pojok kanan atas hanya untuk pengemudi yang sesuai.</p>
        </div>
        <aside class="sp-side">
          <div class="panel sp-card"><h3>Alur pengunjung</h3><ol class="flow" id="sp-flow"></ol></div>
          <div class="panel sp-card">
            <h3 id="sp-av-title">Ketersediaan · Basement 1</h3>
            <div class="sp-big"><b id="sp-free" class="num">50</b><span>dari 50 slot kosong</span></div>
            <div class="bar" id="sp-bar"></div>
            <div class="sp-legend"><span><i style="background:var(--ok-soft);box-shadow:inset 0 0 0 1.5px var(--ok)"></i>Kosong <b id="sp-n-free" class="num">0</b></span><span><i style="background:var(--amber)"></i>Dipesan <b id="sp-n-res" class="num">0</b></span><span><i style="background:var(--bad)"></i>Terisi <b id="sp-n-occ" class="num">0</b></span></div>
            <div class="cat-avail" id="sp-cat-avail"></div>
          </div>
          <div class="panel sp-card"><h3>Status slot</h3><div class="slot-grid" id="sp-grid"></div></div>
          <div class="panel sp-card"><h3>Mobil terpilih</h3><div class="sp-selected" id="sp-sel"></div></div>
          <div class="panel sp-card">
            <h3>Feed sensor IoT · simulasi</h3>
            <div class="iot-status"><span class="dot"></span><span id="sp-gw">Gateway simulasi · 100 sensor</span></div>
            <div class="log" id="sp-log"></div>
            <p class="muted" style="font-size:12px">Hanya demo. Data sensor dibuat di browser dan tidak terhubung ke perangkat keras sungguhan.</p>
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
    this.recolor = () => { C = SP.colors(); };
    view.querySelector(".sp-theme").addEventListener("click", (e) => {
      const b = e.target.closest("[data-sptheme]"); if (!b) return;
      const t = b.dataset.sptheme; store.set("sp-theme", t); document.body.dataset.spTheme = t;
      $$("[data-sptheme]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      this.recolor();
    });
    const st = () => this.world[this.level];
    const sel = () => (this.sel ? SP.findCar(this.world, this.sel) : null);

    const grid = $("#sp-grid");
    grid.innerHTML = SP.ROWS.map((row) => `<span class="rl">${row.r}</span>` + SP.SLOTS.filter((s) => s.row === row.r).map((s) => `<button data-slot="${s.id}" data-cat="${s.cat}" aria-label="Slot ${s.id}${s.cat !== "Regular" ? " (" + SP.CATS[s.cat].label + ")" : ""}">${s.cat === "Regular" ? s.i + 1 : SP.CATS[s.cat].glyph}</button>`).join("")).join("");
    grid.addEventListener("mouseover", (e) => { const b = e.target.closest("[data-slot]"); hl = b ? b.dataset.slot : null; });
    grid.addEventListener("mouseleave", () => hl = null);
    $$("[data-level]").forEach((b) => b.onclick = () => this.setLevel(+b.dataset.level));

    const sendTo = (slotId) => {
      const f = sel();
      if (!f) { toast("Pilih mobil dulu, atau tekan Masuk mal."); return; }
      const car = f.car;
      if (car.atGate) { toast("Pindai QRIS dulu untuk membuka gerbang."); return; }
      if (car.mode === "leaving") { toast(`Mobil #${car.id} sedang menuju pintu keluar.`); return; }
      const chk = SP.canPark(st(), car, SP.SLOT[slotId]);
      if (!chk.ok) { toast(chk.reason); return; }
      const t = SP.parkAnywhere(this.world, car, f.level, this.level, slotId);
      if (!t) { toast("Belum ada rute ke slot itu saat ini."); return; }
      SP.addLog(this.world[f.level], `Mobil #${car.id} bernavigasi ke ${SP.code(t.level, slotId)}${t.level !== f.level ? ` lewat ramp ${t.level === 2 ? "turun" : "naik"}` : ""}`);
      if (t.level !== f.level) toast(`Mobil #${car.id} akan ${t.level === 2 ? "turun lewat ramp ke Basement 2" : "naik lewat ramp ke Basement 1"}.`);
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
        if (car.atGate) { toast("Pindai QRIS dulu untuk membuka gerbang."); return; }
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
        if (res.msg) { if (res.ok) SP.addLog(st(), res.msg); else toast(res.msg); }
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
        if (f && f.car.atGate) { toast("Mobil Anda sudah menunggu di gerbang. Pindai QRIS untuk melanjutkan."); return; }
      }
      const c = SP.arriveAtGate(this.world, $("#sp-kind").value);
      if (!c) { toast("Jalur masuk sedang padat. Coba lagi sebentar lagi."); return; }
      this.sel = c.id; this.track = { id: c.id };
      if (this.level !== 1) this.setLevel(1);
      this.renderFlow();
    };
    const autoSel = () => {
      const f = sel();
      if (!f) return toast("Pilih mobil dulu, atau tekan Masuk mal.");
      const c = f.car;
      if (c.atGate) return toast("Pindai QRIS dulu untuk membuka gerbang.");
      if (c.mode === "parked") return toast(`Mobil #${c.id} sudah parkir di ${SP.code(f.level, c.parked)}.`);
      if (c.mode === "leaving") return toast(`Mobil #${c.id} sedang menuju pintu keluar.`);
      const t = SP.parkAnywhere(this.world, c, f.level);
      if (t) {
        SP.addLog(this.world[f.level], `Pilihan otomatis merekomendasikan ${SP.code(t.level, t.slot.id)}${t.slot.cat !== "Regular" ? ` (${SP.CATS[t.slot.cat].label})` : ""} untuk mobil #${c.id}`);
        toast(`Slot rekomendasi ${SP.code(t.level, t.slot.id)}${t.slot.cat !== "Regular" ? ` · ${SP.CATS[t.slot.cat].label}` : ""}${t.level !== f.level ? " · lewat ramp" : ""}. Navigasi dimulai.`);
      } else toast("Kedua basement penuh untuk jenis pengemudi ini.");
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
        SP.addLog(this.world[f.level], `Mobil #${f.car.id} selesai berbelanja · menuju ${f.level === 2 ? "ramp naik ke B1, lalu " : ""}ramp keluar`);
        this.renderFlow();
      },
    };
    $("#sp-enter").onclick = enter;
    $("#sp-auto").onclick = autoSel;
    $("#sp-rush").onclick = () => { this.world.queue += 8; SP.addLog(this.world[1], "Jam sibuk: 8 mobil mengantre di gerbang masuk B1"); };
    $("#sp-traffic").onchange = (e) => { const w = this.world; w.traffic = e.target.checked; w.nextSpawn = w.t; w.nextLeave = w.t + 4; SP.addLog(null, e.target.checked ? "Lalu lintas live aktif (kedua basement)" : "Lalu lintas live nonaktif"); };
    $("#sp-follow").onchange = (e) => { this.follow = e.target.checked; };
    $("#sp-reset").onclick = () => {
      this.world = this.newWorld(); this.track = null; this.sel = null; $("#sp-traffic").checked = false;
      SP.addLog(null, "Simulasi diatur ulang", "app"); this.setLevel(1);
    };
    $("#sp-flow").addEventListener("click", (e) => { const b = e.target.closest("[data-flow]"); if (b && this.actions[b.dataset.flow]) this.actions[b.dataset.flow](); });

    this.renderFlow();
    let last = performance.now(), uiT = 0, lastFeed = null;
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
    const dest = c ? (c.goal && c.goal.slot ? `${SP.code(c.goal.level, c.goal.slot)} (lewat ramp)` : c.target ? SP.code(lv, c.target) : "") : "";
    const steps = [
      ["Masuk mal", stage === 0 ? `<button class="btn sm primary" data-flow="enter">Masuk mal</button>` : `Mobil #${this.track.id} di gerbang masuk B1`],
      ["Pindai QRIS di gerbang", stage === 1 ? `<button class="btn sm primary" data-flow="scan">Pindai QRIS</button>` : stage > 1 ? "Gerbang terbuka" : ""],
      ["Buka peta parkir", stage >= 2 ? "Peta Basement 1 &amp; 2 dengan status slot terkini" : ""],
      ["Pilih slot atau otomatis", stage === 3 ? `Seret mobil ke slot, klik slot kosong di basement mana pun, atau <button class="btn sm" data-flow="autoSel">Parkir Otomatis</button>` : stage > 3 ? "Slot dipilih" : ""],
      ["Parkir", stage === 4 && c ? `Menuju ${dest}` : stage === 5 && c ? `Parkir di ${SP.code(lv, c.parked)}` : stage > 5 ? "Selesai" : ""],
      ["Selesaikan aktivitas", stage === 5 ? `<button class="btn sm" data-flow="finish">Selesai &amp; keluar</button>` : stage > 5 ? "Selesai" : ""],
      ["Keluar dari mal", stage === 6 ? (lv === 2 ? "Naik lewat ramp ke Basement 1" : "Menuju ramp keluar") : stage === 7 ? `Sudah keluar${this.track.exited.parked ? ` · parkir ${this.track.exited.parked}` : ""}. <button class="btn sm" data-flow="enter">Mulai lagi</button>` : ""],
    ];
    const cur = stage === 7 ? 7 : stage === 2 ? 3 : stage;
    el.innerHTML = steps.map(([t, d], i) => {
      const state = i < cur || stage === 7 ? "done" : i === cur ? "now" : "todo";
      return `<li class="${state}"><span class="n">${state === "done" ? "✓" : i + 1}</span><div><b>${t}</b>${d && state !== "todo" ? `<div class="d">${d}</div>` : ""}</div></li>`;
    }).join("");
  },
  openQris() {
    const c = this.trackedCar();
    if (!c || !c.atGate) { toast("Tidak ada mobil yang menunggu di gerbang."); return; }
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
      title: "Pindai QRIS di gerbang",
      body: `<div class="qris"><div class="qris-head"><b>QRIS</b><span>Grand Avenue Mall · Masuk parkir</span></div>
        <svg viewBox="-8 -8 ${n * cell + 16} ${n * cell + 16}" width="220" height="220" role="img" aria-label="Kode QR demo"><rect x="-8" y="-8" width="${n * cell + 16}" height="${n * cell + 16}" fill="#fff"/><g fill="#111">${rects}</g></svg>
        <span class="mono muted">Tiket IN-${String(c.id).padStart(5, "0")}</span></div>
        <p class="muted" style="font-size:13px">Hanya demo. Pemindaian membuat sesi parkir untuk mobil #${c.id} dan membuka gerbang. Tidak ada pembayaran yang diproses.</p>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn primary" id="qris-ok">Simulasikan pemindaian berhasil</button>`,
    });
    m.querySelector("#qris-ok").onclick = () => {
      closeModal();
      const car = this.trackedCar(); if (!car || !car.atGate) return;
      SP.openGate(this.world, car);
      if (this.level !== 1) this.setLevel(1);
      toast("Gerbang terbuka. Peta parkir siap: pilih slot atau gunakan Parkir Otomatis.", 3500);
      this.renderFlow();
    };
  },
  ui() {
    const w = this.world, S = w[this.level];
    const fe = $("#sp-free"); if (!fe) return;
    const count = (St) => { const k = { free: 0, reserved: 0, occupied: 0 }; SP.SLOTS.forEach((s) => k[St.display[s.id] || "free"]++); return k; };
    const k = count(S);
    [1, 2].forEach((n) => { const e = $("#lv-free-" + n); if (e) e.textContent = `· ${count(w[n]).free} kosong`; });
    fe.textContent = k.free; fe.classList.toggle("full", k.free === 0);
    $("#sp-n-free").textContent = k.free; $("#sp-n-res").textContent = k.reserved; $("#sp-n-occ").textContent = k.occupied;
    $("#sp-bar").innerHTML = `<i style="width:${k.occupied * 2}%;background:var(--bad)"></i><i style="width:${k.reserved * 2}%;background:var(--amber)"></i>`;
    const catFree = (cat) => SP.SLOTS.filter((s) => s.cat === cat && S.display[s.id] === "free").length;
    const catTotal = (cat) => SP.SLOTS.filter((s) => s.cat === cat).length;
    $("#sp-cats").innerHTML = Object.keys(SP.CATS).map((cat) => `<span class="cat-chip" style="--c:var(${SP.CATS[cat].token})"><i>${SP.CATS[cat].glyph}</i>${SP.CATS[cat].label} <b class="num">${catFree(cat)}/${catTotal(cat)}</b></span>`).join("");
    $("#sp-cat-avail").innerHTML = `<span class="muted" style="font-size:12.5px">Slot khusus (pojok kanan atas):</span> ` + Object.keys(SP.CATS).map((cat) => `<span>${SP.CATS[cat].label} ${catFree(cat)} dari ${catTotal(cat)} kosong</span>`).join(" · ");
    $$("#sp-grid [data-slot]").forEach((b) => { const v = S.display[b.dataset.slot] || "free"; b.className = v === "occupied" ? "occ" : v === "reserved" ? "res" : "free"; b.title = `${SP.code(S, b.dataset.slot)}: ${SLOT_STATE[v]}${b.dataset.cat !== "Regular" ? " · " + SP.CATS[b.dataset.cat].label : ""}`; });
    const ago = (Date.now() - Math.max(w[1].lastReading, w[2].lastReading)) / 1000;
    $("#sp-gw").textContent = `Gateway simulasi · 100 sensor · pembacaan terakhir ${ago < 1 ? "baru saja" : ago < 60 ? Math.round(ago) + " dtk lalu" : Math.round(ago / 60) + " mnt lalu"}`;
    const f = this.sel ? SP.findCar(w, this.sel) : null;
    const el = $("#sp-sel");
    if (!f) { el.innerHTML = `<p class="muted">Belum ada mobil terpilih. Tekan <b>Masuk mal</b> atau klik mobil di peta.</p>`; return; }
    const c = f.car;
    const modeTxt = c.atGate ? "Menunggu di gerbang" : c.mode === "drag" ? "Sedang dipindahkan" : c.mode === "parked" || c.parked ? `Parkir di ${SP.code(f.level, c.parked)}` : c.mode === "leaving" ? (f.level === 2 ? "Naik ramp ke B1, lalu keluar" : "Menuju ramp keluar") : c.mode === "auto" && c.goal && c.goal.slot ? `Ke ${SP.code(c.goal.level, c.goal.slot)} lewat ramp` : c.mode === "auto" && c.target ? `Menuju ${SP.code(f.level, c.target)}` : "Memilih slot";
    const pill = c.parked || c.mode === "parked" ? "info" : c.mode === "auto" ? "warn" : c.mode === "leaving" ? "plain" : "ok";
    el.innerHTML = `<div class="row"><b>Mobil #${c.id}</b><span class="pill ${pill}">${modeTxt}</span></div>
      <div class="row"><span class="muted">Posisi</span><span>Basement ${f.level}${f.level !== this.level ? ` · <button class="btn ghost sm" style="padding:0 4px" onclick="PAGES.smartpark.setLevel(${f.level})">lihat</button>` : ""}</span></div>
      <div class="row"><span class="muted">Pengemudi</span><span>${SP.kindLabel(c.kind)}</span></div>
      <div class="row"><span class="muted">Kecepatan</span><span class="num mono">${Math.round(Math.abs(c.v) * 0.15)} km/h</span></div>
      <div class="row"><span class="muted">Mobil di B1 / B2</span><span class="num mono">${w[1].cars.length} / ${w[2].cars.length}${w.queue ? ` · ${w.queue} antre` : ""}</span></div>`;
  },
  renderLog() {
    const el = $("#sp-log"); if (!el) return;
    const fmt = (t) => new Date(t).toLocaleTimeString("id-ID", { hour12: false });
    el.innerHTML = SP.FEED.slice(0, 40).map((l) => `<div class="${l.kind}"><time>${fmt(l.time)}</time><span>${l.kind === "sensor" ? "<b>SENSOR</b> " : ""}${esc(l.msg)}</span></div>`).join("");
  },
  unmount() {
    cancelAnimationFrame(this.raf);
    delete document.body.dataset.spTheme;
    if (this.ro) this.ro.disconnect(); if (this.mo) this.mo.disconnect(); if (this.mq) this.mq.removeEventListener("change", this.mqf);
    closeModal();
  },
};
