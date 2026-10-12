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

PAGES.smartpark = {
  level: 1,
  newWorld() {
    const w = SP.createWorld();
    SP.FEED.length = 0; SP.seed(w[1], 16); SP.seed(w[2], 11); SP.FEED.length = 0;
    w.onExit = (c) => { if (this.track && this.track.id === c.id) this.track.exited = { at: Date.now(), parked: c.parkedAt ? SP.dur((c.leftSlotAt || Date.now()) - c.parkedAt) : null }; if (this.sel === c.id) this.sel = null; };
    w.onTransfer = (c, from, to) => {
      if (c.id === this.sel && this.follow) { this.setLevel(to); toast(`Car #${c.id} ${to === 2 ? "went down the ramp to Basement 2" : "came up the ramp to Basement 1"}.`, 2600); }
    };
    return w;
  },
  setLevel(n) {
    this.level = n;
    $$("[data-level]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.level === n)));
    const t = $("#sp-av-title"); if (t) t.textContent = `Availability · Basement ${n}`;
    this.ui(); this.renderFlow();
  },
  mount(view) {
    this.world = this.newWorld();
    this.level = 1; this.sel = null; this.follow = true;
    SP.addLog(this.world[1], "Simulated sensor gateway online · 100 slot sensors across B1 and B2", "sensor");
    this.track = null; // the visitor car whose journey the flow panel follows
    const kindOpts = SP.KINDS.map((k) => `<option value="${k}">${k === "Regular" ? "Regular driver" : k === "EV" ? "EV driver" : k === "Ladies" ? "Lady driver" : "VIP member"}</option>`).join("");
    view.innerHTML = `
    <section class="sp-hero" style="--hero:${esc(spHeroUrl())}">
      <div class="wrap sp-hero-in">
        <div class="eyebrow">Featured project · Mall parking navigation</div>
        <h1>SmartPark</h1>
        <p>SmartPark is mall parking navigation that helps visitors find an empty slot without circling the basement. Scan QRIS at the B1 gate, open the parking map, pick a slot on Basement 1 or take the ramp down to Basement 2, park, and drive back up to the exit ramp when you're done.</p>
        <div class="sp-hero-facts"><span><b>2</b> basements</span><span><b>100</b> sensor slots</span><span>EV · Ladies · VIP</span><span>Keep-left traffic</span></div>
      </div>
    </section>
    <div class="bleed">
      <div class="sp-layout">
        <div class="panel sp-stage">
          <div class="sp-top">
            <div class="seg sp-levels" role="tablist" aria-label="Basement level">
              <button role="tab" data-level="1" aria-pressed="true">Basement 1 <span class="num" id="lv-free-1"></span></button>
              <button role="tab" data-level="2" aria-pressed="false">Basement 2 <span class="num" id="lv-free-2"></span></button>
            </div>
            <div class="cat-chips" id="sp-cats" aria-label="Special parking categories"></div>
          </div>
          <div class="sp-controls">
            <label><span class="sr">Driver type</span><select class="select" id="sp-kind" style="width:auto">${kindOpts}</select></label>
            <button class="btn primary sm" id="sp-enter">${ICON.plus} Enter mall</button>
            <button class="btn sm" id="sp-auto">Auto Park Selected</button>
            <button class="btn sm" id="sp-rush">Rush hour +8</button>
            <label class="toggle"><input type="checkbox" id="sp-traffic"> Live traffic</label>
            <label class="toggle" title="Switch floors automatically when the selected car takes a ramp"><input type="checkbox" id="sp-follow" checked> Follow car</label>
            <button class="btn sm danger" id="sp-reset" style="margin-left:auto">Reset</button>
          </div>
          <div class="sp-canvas-wrap" id="sp-wrap"><canvas id="sp-canvas" aria-label="Basement parking map. Drag a car onto a free slot to park it."></canvas></div>
          <p class="muted sp-hint">Drag any car with the mouse (or your finger) onto a free slot to park it. Click a car to select it, then click a free slot on either basement to navigate there; cars bound for Basement 2 use the ramp at the top-right of B1 and come back up the ramp at the top-left of B2. EV, Ladies and VIP slots in the top-right corner only accept matching drivers.</p>
        </div>
        <aside class="sp-side">
          <div class="panel sp-card"><h3>Visitor flow</h3><ol class="flow" id="sp-flow"></ol></div>
          <div class="panel sp-card">
            <h3 id="sp-av-title">Availability · Basement 1</h3>
            <div class="sp-big"><b id="sp-free" class="num">50</b><span>of 50 slots free</span></div>
            <div class="bar" id="sp-bar"></div>
            <div class="sp-legend"><span><i style="background:var(--ok-soft);box-shadow:inset 0 0 0 1.5px var(--ok)"></i>Free <b id="sp-n-free" class="num">0</b></span><span><i style="background:var(--amber)"></i>Reserved <b id="sp-n-res" class="num">0</b></span><span><i style="background:var(--bad)"></i>Occupied <b id="sp-n-occ" class="num">0</b></span></div>
            <div class="cat-avail" id="sp-cat-avail"></div>
          </div>
          <div class="panel sp-card"><h3>Slot status</h3><div class="slot-grid" id="sp-grid"></div></div>
          <div class="panel sp-card"><h3>Selected car</h3><div class="sp-selected" id="sp-sel"></div></div>
          <div class="panel sp-card">
            <h3>IoT sensor feed · simulated</h3>
            <div class="iot-status"><span class="dot"></span><span id="sp-gw">Simulated gateway · 100 sensors</span></div>
            <div class="log" id="sp-log"></div>
            <p class="muted" style="font-size:12px">Demo only. Sensor readings are generated in the browser and aren't connected to real hardware.</p>
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
    const st = () => this.world[this.level];
    const sel = () => (this.sel ? SP.findCar(this.world, this.sel) : null);

    const grid = $("#sp-grid");
    grid.innerHTML = SP.ROWS.map((row) => `<span class="rl">${row.r}</span>` + SP.SLOTS.filter((s) => s.row === row.r).map((s) => `<button data-slot="${s.id}" data-cat="${s.cat}" aria-label="Slot ${s.id}${s.cat !== "Regular" ? " (" + s.cat + ")" : ""}">${s.cat === "Regular" ? s.i + 1 : SP.CATS[s.cat].glyph}</button>`).join("")).join("");
    grid.addEventListener("mouseover", (e) => { const b = e.target.closest("[data-slot]"); hl = b ? b.dataset.slot : null; });
    grid.addEventListener("mouseleave", () => hl = null);
    $$("[data-level]").forEach((b) => b.onclick = () => this.setLevel(+b.dataset.level));

    const sendTo = (slotId) => {
      const f = sel();
      if (!f) { toast("Select a car first, or press Enter mall."); return; }
      const car = f.car;
      if (car.atGate) { toast("Scan QRIS first to open the gate."); return; }
      if (car.mode === "leaving") { toast(`Car #${car.id} is on its way out.`); return; }
      const chk = SP.canPark(st(), car, SP.SLOT[slotId]);
      if (!chk.ok) { toast(chk.reason); return; }
      const t = SP.parkAnywhere(this.world, car, f.level, this.level, slotId);
      if (!t) { toast("No route to that slot right now."); return; }
      SP.addLog(this.world[f.level], `Car #${car.id} navigating to ${SP.code(t.level, slotId)}${t.level !== f.level ? ` via the ramp ${t.level === 2 ? "down" : "up"}` : ""}`);
      if (t.level !== f.level) toast(`Car #${car.id} will take the ramp ${t.level === 2 ? "down to Basement 2" : "up to Basement 1"}.`);
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
        if (car.atGate) { toast("Scan QRIS first to open the gate."); return; }
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
        if (f && f.car.atGate) { toast("Your car is already waiting at the gate. Scan QRIS to continue."); return; }
      }
      const c = SP.arriveAtGate(this.world, $("#sp-kind").value);
      if (!c) { toast("The entry lane is busy. Try again in a moment."); return; }
      this.sel = c.id; this.track = { id: c.id };
      if (this.level !== 1) this.setLevel(1);
      this.renderFlow();
    };
    const autoSel = () => {
      const f = sel();
      if (!f) return toast("Select a car first, or press Enter mall.");
      const c = f.car;
      if (c.atGate) return toast("Scan QRIS first to open the gate.");
      if (c.mode === "parked") return toast(`Car #${c.id} is already parked in ${SP.code(f.level, c.parked)}.`);
      if (c.mode === "leaving") return toast(`Car #${c.id} is on its way out.`);
      const t = SP.parkAnywhere(this.world, c, f.level);
      if (t) {
        SP.addLog(this.world[f.level], `Auto-select recommended ${SP.code(t.level, t.slot.id)}${t.slot.cat !== "Regular" ? ` (${t.slot.cat})` : ""} for car #${c.id}`);
        toast(`Recommended slot ${SP.code(t.level, t.slot.id)}${t.slot.cat !== "Regular" ? ` · ${t.slot.cat}` : ""}${t.level !== f.level ? " · via the ramp" : ""}. Navigating now.`);
      } else toast("Both basements are full for this driver type.");
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
        SP.addLog(this.world[f.level], `Car #${f.car.id} finished shopping · heading ${f.level === 2 ? "up the ramp to B1, then " : ""}to the exit ramp`);
        this.renderFlow();
      },
    };
    $("#sp-enter").onclick = enter;
    $("#sp-auto").onclick = autoSel;
    $("#sp-rush").onclick = () => { this.world.queue += 8; SP.addLog(this.world[1], "Rush hour: 8 cars queued at the B1 entry gate"); };
    $("#sp-traffic").onchange = (e) => { const w = this.world; w.traffic = e.target.checked; w.nextSpawn = w.t; w.nextLeave = w.t + 4; SP.addLog(null, e.target.checked ? "Live traffic on (both basements)" : "Live traffic off"); };
    $("#sp-follow").onchange = (e) => { this.follow = e.target.checked; };
    $("#sp-reset").onclick = () => {
      this.world = this.newWorld(); this.track = null; this.sel = null; $("#sp-traffic").checked = false;
      SP.addLog(null, "Simulation reset", "app"); this.setLevel(1);
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
    const dest = c ? (c.goal && c.goal.slot ? `${SP.code(c.goal.level, c.goal.slot)} (via the ramp)` : c.target ? SP.code(lv, c.target) : "") : "";
    const steps = [
      ["Enter the mall", stage === 0 ? `<button class="btn sm primary" data-flow="enter">Enter mall</button>` : `Car #${this.track.id} at the B1 entry gate`],
      ["Scan QRIS at the gate", stage === 1 ? `<button class="btn sm primary" data-flow="scan">Scan QRIS</button>` : stage > 1 ? "Gate opened" : ""],
      ["Open the parking map", stage >= 2 ? "Basement 1 &amp; 2 maps with live slot status" : ""],
      ["Pick a slot or auto-select", stage === 3 ? `Drag the car onto a slot, click a free slot on either basement, or <button class="btn sm" data-flow="autoSel">Auto Park Selected</button>` : stage > 3 ? "Slot chosen" : ""],
      ["Park", stage === 4 && c ? `Navigating to ${dest}` : stage === 5 && c ? `Parked in ${SP.code(lv, c.parked)}` : stage > 5 ? "Done" : ""],
      ["Finish your activities", stage === 5 ? `<button class="btn sm" data-flow="finish">Finish &amp; exit</button>` : stage > 5 ? "Done" : ""],
      ["Exit the mall", stage === 6 ? (lv === 2 ? "Taking the ramp up to Basement 1" : "Driving to the exit ramp") : stage === 7 ? `Exited${this.track.exited.parked ? ` · parked ${this.track.exited.parked}` : ""}. <button class="btn sm" data-flow="enter">Start again</button>` : ""],
    ];
    const cur = stage === 7 ? 7 : stage === 2 ? 3 : stage;
    el.innerHTML = steps.map(([t, d], i) => {
      const state = i < cur || stage === 7 ? "done" : i === cur ? "now" : "todo";
      return `<li class="${state}"><span class="n">${state === "done" ? "✓" : i + 1}</span><div><b>${t}</b>${d && state !== "todo" ? `<div class="d">${d}</div>` : ""}</div></li>`;
    }).join("");
  },
  openQris() {
    const c = this.trackedCar();
    if (!c || !c.atGate) { toast("No car is waiting at the gate."); return; }
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
      title: "Scan QRIS at the gate",
      body: `<div class="qris"><div class="qris-head"><b>QRIS</b><span>Grand Avenue Mall · Parking entry</span></div>
        <svg viewBox="-8 -8 ${n * cell + 16} ${n * cell + 16}" width="220" height="220" role="img" aria-label="Demo QR code"><rect x="-8" y="-8" width="${n * cell + 16}" height="${n * cell + 16}" fill="#fff"/><g fill="#111">${rects}</g></svg>
        <span class="mono muted">Ticket IN-${String(c.id).padStart(5, "0")}</span></div>
        <p class="muted" style="font-size:13px">Demo only. Scanning creates a parking session for car #${c.id} and opens the gate. No payment is processed.</p>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="qris-ok">Simulate successful scan</button>`,
    });
    m.querySelector("#qris-ok").onclick = () => {
      closeModal();
      const car = this.trackedCar(); if (!car || !car.atGate) return;
      SP.openGate(this.world, car);
      if (this.level !== 1) this.setLevel(1);
      toast("Gate open. Parking map ready: pick a slot or use Auto Park Selected.", 3500);
      this.renderFlow();
    };
  },
  ui() {
    const w = this.world, S = w[this.level];
    const fe = $("#sp-free"); if (!fe) return;
    const count = (St) => { const k = { free: 0, reserved: 0, occupied: 0 }; SP.SLOTS.forEach((s) => k[St.display[s.id] || "free"]++); return k; };
    const k = count(S);
    [1, 2].forEach((n) => { const e = $("#lv-free-" + n); if (e) e.textContent = `· ${count(w[n]).free} free`; });
    fe.textContent = k.free; fe.classList.toggle("full", k.free === 0);
    $("#sp-n-free").textContent = k.free; $("#sp-n-res").textContent = k.reserved; $("#sp-n-occ").textContent = k.occupied;
    $("#sp-bar").innerHTML = `<i style="width:${k.occupied * 2}%;background:var(--bad)"></i><i style="width:${k.reserved * 2}%;background:var(--amber)"></i>`;
    const catFree = (cat) => SP.SLOTS.filter((s) => s.cat === cat && S.display[s.id] === "free").length;
    const catTotal = (cat) => SP.SLOTS.filter((s) => s.cat === cat).length;
    $("#sp-cats").innerHTML = Object.keys(SP.CATS).map((cat) => `<span class="cat-chip" style="--c:var(${SP.CATS[cat].token})"><i>${SP.CATS[cat].glyph}</i>${SP.CATS[cat].label} <b class="num">${catFree(cat)}/${catTotal(cat)}</b></span>`).join("");
    $("#sp-cat-avail").innerHTML = `<span class="muted" style="font-size:12.5px">Special slots (top-right corner):</span> ` + Object.keys(SP.CATS).map((cat) => `<span>${SP.CATS[cat].label} ${catFree(cat)} of ${catTotal(cat)} free</span>`).join(" · ");
    $$("#sp-grid [data-slot]").forEach((b) => { const v = S.display[b.dataset.slot] || "free"; b.className = v === "occupied" ? "occ" : v === "reserved" ? "res" : "free"; b.title = `${SP.code(S, b.dataset.slot)}: ${v}${b.dataset.cat !== "Regular" ? " · " + b.dataset.cat : ""}`; });
    const ago = (Date.now() - Math.max(w[1].lastReading, w[2].lastReading)) / 1000;
    $("#sp-gw").textContent = `Simulated gateway · 100 sensors · last reading ${ago < 1 ? "just now" : ago < 60 ? Math.round(ago) + " s ago" : Math.round(ago / 60) + " min ago"}`;
    const f = this.sel ? SP.findCar(w, this.sel) : null;
    const el = $("#sp-sel");
    if (!f) { el.innerHTML = `<p class="muted">No car selected. Press <b>Enter mall</b> or click a car on the map.</p>`; return; }
    const c = f.car;
    const modeTxt = c.atGate ? "Waiting at the gate" : c.mode === "drag" ? "Being moved" : c.mode === "parked" || c.parked ? `Parked in ${SP.code(f.level, c.parked)}` : c.mode === "leaving" ? (f.level === 2 ? "Ramp up to B1, then exit" : "Driving to the exit ramp") : c.mode === "auto" && c.goal && c.goal.slot ? `To ${SP.code(c.goal.level, c.goal.slot)} via the ramp` : c.mode === "auto" && c.target ? `Navigating to ${SP.code(f.level, c.target)}` : "Choosing a slot";
    const pill = c.parked || c.mode === "parked" ? "info" : c.mode === "auto" ? "warn" : c.mode === "leaving" ? "plain" : "ok";
    el.innerHTML = `<div class="row"><b>Car #${c.id}</b><span class="pill ${pill}">${modeTxt}</span></div>
      <div class="row"><span class="muted">Now on</span><span>Basement ${f.level}${f.level !== this.level ? ` · <button class="btn ghost sm" style="padding:0 4px" onclick="PAGES.smartpark.setLevel(${f.level})">show</button>` : ""}</span></div>
      <div class="row"><span class="muted">Driver</span><span>${c.kind === "Regular" ? "Regular" : c.kind}</span></div>
      <div class="row"><span class="muted">Speed</span><span class="num mono">${Math.round(Math.abs(c.v) * 0.15)} km/h</span></div>
      <div class="row"><span class="muted">Cars in B1 / B2</span><span class="num mono">${w[1].cars.length} / ${w[2].cars.length}${w.queue ? ` · ${w.queue} queued` : ""}</span></div>`;
  },
  renderLog() {
    const el = $("#sp-log"); if (!el) return;
    const fmt = (t) => new Date(t).toLocaleTimeString("en-GB", { hour12: false });
    el.innerHTML = SP.FEED.slice(0, 40).map((l) => `<div class="${l.kind}"><time>${fmt(l.time)}</time><span>${l.kind === "sensor" ? "<b>SENSOR</b> " : ""}${esc(l.msg)}</span></div>`).join("");
  },
  unmount() {
    cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect(); if (this.mo) this.mo.disconnect(); if (this.mq) this.mq.removeEventListener("change", this.mqf);
    closeModal();
  },
};
