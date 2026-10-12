/* ===== SmartPark: two-level basement parking navigation with a simulated IoT sensor layer ===== */
const SP = (() => {
  const W = 1000, H = 760;
  const SW = 58, SD = 80, X0 = 210;
  const ROWS = [
    { r: "A", y0: 90, aisle: 1, dir: -1 },  // opening at bottom (aisle 1 below), car drives up into the slot
    { r: "B", y0: 250, aisle: 1, dir: 1 },
    { r: "C", y0: 330, aisle: 2, dir: -1 },
    { r: "D", y0: 490, aisle: 2, dir: 1 },
    { r: "E", y0: 570, aisle: 3, dir: -1 },
  ];
  /* Special categories sit in the top-right corner of each basement (row A, slots 5–10). */
  const CAT_OF = { A5: "EV", A6: "EV", A7: "Ladies", A8: "Ladies", A9: "VIP", A10: "VIP" };
  const CATS = {
    EV: { label: ["EV", "EV"], who: ["kendaraan listrik", "electric vehicles"], token: "--ev", glyph: "EV" },
    Ladies: { label: ["Wanita", "Ladies"], who: ["pengemudi wanita", "women drivers"], token: "--ladies", glyph: "♀" },
    VIP: { label: ["VIP", "VIP"], who: ["member VIP", "VIP members"], token: "--vip", glyph: "VIP" },
  };
  /* Text is stored as [Indonesian, English] pairs so logs and messages can switch language later. */
  const kindPair = (k) => (k === "Regular" ? ["Reguler", "Regular"] : CATS[k] ? CATS[k].label : [k, k]);
  const kindLabel = (k) => pick(kindPair(k));
  const AISLE_Y = { 1: 210, 2: 450, 3: 690 };
  const SLOTS = [];
  ROWS.forEach((row) => {
    for (let i = 0; i < 10; i++) {
      const id = row.r + (i + 1);
      SLOTS.push({
        id, row: row.r, i, aisle: row.aisle, dir: row.dir, cat: CAT_OF[id] || "Regular",
        x: X0 + i * SW, y: row.y0, w: SW, h: SD,
        cx: X0 + i * SW + SW / 2, cy: row.y0 + SD / 2,
        angle: row.dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      });
    }
  });
  const SLOT = {}; SLOTS.forEach((s) => SLOT[s.id] = s);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  /* ---------- Road network per level ----------
     B1: street gate in (bottom-left) and out (bottom-right), ramp DOWN to B2 at top-right,
         arrival from B2's up-ramp at top-left.
     B2: no gates. Arrival from B1's down-ramp at top-right, ramp UP to B1 at top-left. */
  const RAMP_R = [890, 170, 1004, 250], RAMP_L = [-4, 170, 110, 250];
  /* Indonesia drives on the LEFT: on the two-way bottom aisle eastbound cars use the upper lane
     and westbound cars the lower lane. One-way aisles and ramps use their centre line. */
  const LANE_E = 674, LANE_W = 706, BAY_WAIT = [220, 728, 700, 760];
  function keepLeft(pts) {
    const out = pts.map((p) => ({ ...p }));
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i], b = out[i + 1];
      if (a.rev || b.rev || a.final || b.final) continue;
      if (Math.abs(a.y - 690) <= 17 && Math.abs(b.y - 690) <= 17 && Math.abs(b.x - a.x) > 20) { const y = b.x > a.x ? LANE_E : LANE_W; a.y = y; b.y = y; }
    }
    return out;
  }
  function makeGeo(level) {
    const base = { L3: [150, 690], L2: [150, 450], L1: [150, 210], R1: [850, 210], R2: [850, 450], R3: [850, 690] };
    const common = [["L3", "L2"], ["L2", "L1"], ["L1", "R1", 1], ["L2", "R2", 2], ["R1", "R2"], ["R2", "R3"], ["L3", "R3", 3], ["R3", "L3", 3]];
    let N, E, DRIVE;
    const lanes = [[110, 170, 190, 730], [810, 170, 890, 730], [210, 90, 790, 170], [210, 250, 790, 410], [210, 490, 790, 650], [110, 170, 890, 250], [110, 410, 890, 490]];
    if (level === 1) {
      N = { ...base, ENT: [12, LANE_E], EXIT: [1004, LANE_E], DOWN: [1004, 210], UPIN: [-4, 210] };
      E = common.concat([["ENT", "L3"], ["R3", "EXIT", 3], ["R1", "DOWN"], ["UPIN", "L1"]]);
      DRIVE = lanes.concat([[110, 650, 890, 730], [0, 650, 110, 700], [890, 650, 1004, 700], BAY_WAIT, RAMP_R, RAMP_L]);
    } else {
      N = { ...base, RIN: [1004, 210], UP: [-4, 210] };
      E = common.concat([["RIN", "R1"], ["L1", "UP"]]);
      DRIVE = lanes.concat([[110, 650, 890, 730], RAMP_R, RAMP_L]);
    }
    const EDGES = E.map(([a, b, aisle]) => ({ a, b, aisle: aisle || 0 }));
    const out = {}; EDGES.forEach((e) => (out[e.a] = out[e.a] || []).push(e));
    const G = { level, N, EDGES, DRIVE, out, DJ: {} };
    Object.keys(N).forEach((k) => G.DJ[k] = dijkstra(G, k));
    return G;
  }
  function dijkstra(G, from) {
    const d = {}, prev = {}, left = new Set(Object.keys(G.N));
    Object.keys(G.N).forEach((k) => d[k] = Infinity); d[from] = 0;
    while (left.size) {
      let u = null; left.forEach((k) => { if (u === null || d[k] < d[u]) u = k; });
      if (d[u] === Infinity) break; left.delete(u);
      (G.out[u] || []).forEach((e) => { const nd = d[u] + dist(G.N[e.a], G.N[e.b]); if (nd < d[e.b]) { d[e.b] = nd; prev[e.b] = u; } });
    }
    return { d, prev };
  }
  const GEO = { 1: makeGeo(1), 2: makeGeo(2) };
  function nodePath(G, from, to) {
    const out = []; let c = to;
    if (from === to) return [to];
    if (G.DJ[from].d[to] === Infinity) return null;
    while (c && c !== from) { out.unshift(c); c = G.DJ[from].prev[c]; }
    out.unshift(from); return out;
  }
  function project(G, p, e) {
    const A = G.N[e.a], B = G.N[e.b]; const dx = B[0] - A[0], dy = B[1] - A[1]; const L2 = dx * dx + dy * dy;
    const t = clamp(((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / L2, 0, 1);
    const q = [A[0] + dx * t, A[1] + dy * t];
    return { t, q, d: dist(p, q), len: Math.sqrt(L2), ux: dx / Math.sqrt(L2), uy: dy / Math.sqrt(L2) };
  }
  function locate(G, car) {
    let best = null;
    const hx = Math.cos(car.a), hy = Math.sin(car.a);
    G.EDGES.forEach((e) => {
      const pr = project(G, [car.x, car.y], e);
      const align = hx * pr.ux + hy * pr.uy;
      const score = pr.d + (align < -0.3 ? 40 : 0) + (pr.t >= 0.999 ? 25 : 0);
      if (!best || score < best.score) best = { e, pr, score };
    });
    // a terminal edge (exit or ramp) leads nowhere useful: route from its start instead
    if (!G.out[best.e.b]) best = { e: { a: best.e.a, b: best.e.a, aisle: 0 }, pr: { q: G.N[best.e.a], d: dist([car.x, car.y], G.N[best.e.a]) } };
    return best;
  }
  function slotAt(x, y, pad = 0) {
    return SLOTS.find((s) => x > s.x + pad && x < s.x + s.w - pad && y > s.y + pad && y < s.y + s.h - pad) || null;
  }
  /* Leaving a slot: reverse out (nose was pointing into the slot), swinging the nose east. */
  function backOut(car) {
    const inSlot = slotAt(car.x, car.y, 4);
    if (!inSlot) return { pre: [], start: { x: car.x, y: car.y, a: car.a, v: car.v }, inSlot: null };
    const Y = AISLE_Y[inSlot.aisle];
    const noseIn = Math.sin(car.a) * inSlot.dir > 0.3;
    if (!noseIn) return { pre: [{ x: inSlot.cx + 30, y: Y }], start: { x: inSlot.cx + 30, y: Y, a: 0, v: 0 }, inSlot };
    return {
      pre: [{ x: inSlot.cx, y: Y + inSlot.dir * 24, rev: true }, { x: inSlot.cx - 36, y: Y - inSlot.dir * 4, rev: true }],
      start: { x: inSlot.cx - 36, y: Y, a: 0, v: 0 }, inSlot,
    };
  }
  /* Route to a slot on the car's current level. Returns {cost, pts}. */
  function planToSlot(G, car, slot) {
    const { pre, start, inSlot } = backOut(car);
    const loc0 = locate(G, start);
    const locs = [loc0];
    // on the two-way bottom aisle a stopped car may also U-turn, so try both directions
    if (loc0.e.aisle === 3 && Math.abs(start.v || 0) < 5) { const opp = G.EDGES.find((e) => e.a === loc0.e.b && e.b === loc0.e.a); if (opp) locs.push({ e: opp, pr: project(G, [start.x, start.y], opp), uturn: 40 }); }
    const Y = AISLE_Y[slot.aisle];
    let best = null;
    locs.forEach((loc) => G.EDGES.filter((e) => e.aisle === slot.aisle && G.out[e.b]).forEach((e) => {
      const east = G.N[e.b][0] > G.N[e.a][0];
      const ap = [slot.cx + (east ? -52 : 52), Y];
      let cost, nodes;
      const onSame = loc.e === e;
      const along = onSame ? (east ? ap[0] - loc.pr.q[0] : loc.pr.q[0] - ap[0]) : -1;
      if (onSame && along > 30) { cost = along + loc.pr.d; nodes = []; }
      else {
        const path = nodePath(G, loc.e.b, e.a); if (!path) return;
        cost = dist([start.x, start.y], G.N[loc.e.b]) + G.DJ[loc.e.b].d[e.a] + dist(G.N[e.a], ap);
        nodes = path;
      }
      cost += loc.uturn || 0;
      if (!best || cost < best.cost) best = { cost, nodes, ap };
    }));
    if (!best) return null;
    const pts = pre.concat(best.nodes.map((k) => ({ x: G.N[k][0], y: G.N[k][1] })));
    pts.push({ x: best.ap[0], y: best.ap[1] });
    pts.push({ x: slot.cx + (best.ap[0] < slot.cx ? -8 : 8), y: Y + slot.dir * 30 });
    pts.push({ x: slot.cx, y: slot.cy, final: true });
    return { cost: best.cost + (inSlot ? 60 : 0), pts: keepLeft(pts) };
  }
  /* Route to a terminal node: EXIT (leave the mall) or a ramp (DOWN / UP). */
  const RAMP_TO = { DOWN: 2, UP: 1 };
  function planToNode(G, car, key) {
    const { pre, start } = backOut(car);
    const loc = locate(G, start);
    const path = nodePath(G, loc.e.b, key) || [key];
    const pts = pre.concat(path.map((k) => ({ x: G.N[k][0], y: G.N[k][1], exit: k === "EXIT", ramp: RAMP_TO[k] || 0 })));
    let cost = dist([start.x, start.y], G.N[loc.e.b]) + (G.DJ[loc.e.b].d[key] || 0);
    return { pts: keepLeft(pts), cost };
  }

  const PAINT = ["#d23a3a", "#f4f4f2", "#9aa3ad", "#1d232b", "#2f63d6", "#e9b52f", "#2f8a5b", "#7a4fc9", "#e2722e", "#4fb3c8"];
  const KINDS = ["Regular", "EV", "Ladies", "VIP"];
  let SEQ = 0;
  const FEED = []; // shared activity + sensor feed for both basements
  function createState(level) {
    const st = { level, G: GEO[level], cars: [], t: 0, slotStatus: {}, slotCar: {}, display: {}, sensor: {}, pending: {}, lastReading: Date.now(), selected: null, world: null };
    SLOTS.forEach((s) => { st.slotStatus[s.id] = "free"; st.display[s.id] = "free"; st.sensor[s.id] = { occ: false, dist: 2.4 + Math.random() * 0.4, at: Date.now() }; });
    return st;
  }
  function createWorld() {
    const w = { 1: createState(1), 2: createState(2), traffic: false, queue: 0, t: 0, nextSpawn: 0, nextLeave: 0, onTransfer: null, onExit: null };
    w[1].world = w; w[2].world = w;
    return w;
  }
  const code = (st, id) => `B${typeof st === "number" ? st : st.level}-${id}`;
  function addLog(st, msg, kind = "app") { FEED.unshift({ time: Date.now(), level: st ? st.level : 0, msg, kind }); if (FEED.length > 80) FEED.pop(); }
  function entranceClear(st) { return !st.cars.some((c) => Math.hypot(c.x - 32, c.y - LANE_E) < 48); }
  function allowed(car, slot) { return slot.cat === "Regular" || slot.cat === car.kind; }
  function newCar(kind) {
    return { id: ++SEQ, x: 26, y: LANE_E, a: 0, v: 0, steer: 0, color: PAINT[(SEQ * 7) % PAINT.length], kind: kind || "Regular", mode: "manual", path: null, wp: 0, target: null, goal: null, blocked: 0, ghost: 0, parked: null, stuck: 0, settle: 0 };
  }
  function findCar(w, id) { for (const L of [1, 2]) { const c = w[L].cars.find((x) => x.id === id); if (c) return { car: c, level: L, st: w[L] }; } return null; }
  /* A visitor's car arrives at the B1 entry gate and waits there until QRIS is scanned. */
  function arriveAtGate(w, kind) {
    const st = w[1];
    if (!entranceClear(st)) return null;
    const c = newCar(kind); c.atGate = true; c.user = true;
    st.cars.push(c);
    addLog(st, [`Mobil #${c.id}${c.kind !== "Regular" ? ` (${kindPair(c.kind)[0]})` : ""} menunggu di gerbang masuk mal (B1)`, `Car #${c.id}${c.kind !== "Regular" ? ` (${kindPair(c.kind)[1]})` : ""} waiting at the mall entry gate (B1)`]);
    return c;
  }
  function openGate(w, car) {
    const st = w[1];
    car.atGate = false; car.scannedAt = Date.now();
    const spots = [[290, 744], [370, 744], [450, 744], [530, 744], [610, 744]];
    const spot = spots.find(([x, y]) => !st.cars.some((o) => o !== car && Math.hypot(o.x - x, o.y - y) < 40)) || spots[0];
    car.mode = "auto"; car.target = null; car.goal = null; car.toIdle = true; car.wp = 0;
    car.path = [{ x: 120, y: LANE_E }, { x: spot[0] - 70, y: 722 }, { x: spot[0], y: spot[1] }];
    addLog(st, [`Mobil #${car.id} memindai QRIS · gerbang terbuka · peta parkir dibuka`, `Car #${car.id} scanned QRIS · gate opened · parking map opened`]);
  }
  function freeSlots(st, car) {
    return SLOTS.filter((s) => (st.slotStatus[s.id] === "free" || (car && st.slotCar[s.id] === car.id)) && (!car || allowed(car, s)));
  }
  function pickFrom(st, car, list) {
    let best = null;
    list.forEach((s) => { const p = planToSlot(st.G, car, s); if (p && (!best || p.cost < best.cost)) best = { cost: p.cost, plan: p, slot: s, level: st.level }; });
    return best;
  }
  /* Arrival point on the other level (where a car appears after using the ramp). */
  const ARRIVE = { 2: { x: 985, y: 210, a: Math.PI }, 1: { x: 15, y: 210, a: 0 } };
  /* Auto-select across both basements. Matching category slots come first, then regular slots.
     A slot on the other level costs the drive to the ramp plus the drive from the ramp's arrival point. */
  function recommendWorld(w, car, fromLevel, opts = {}) {
    const other = fromLevel === 1 ? 2 : 1;
    const rampKey = fromLevel === 1 ? "DOWN" : "UP";
    const ramp = planToNode(w[fromLevel].G, car, rampKey);
    const v = { ...car, ...ARRIVE[other], v: 0 };
    const levels = opts.level ? [opts.level] : [fromLevel, other];
    const pickLevel = (L, filt) => {
      const st = w[L];
      const r = pickFrom(st, L === fromLevel ? car : v, freeSlots(st, car).filter(filt));
      if (r && L !== fromLevel) r.cost += ramp.cost + 120;
      return r;
    };
    const best = (filt) => levels.map((L) => pickLevel(L, filt)).filter(Boolean).sort((a, b) => a.cost - b.cost)[0] || null;
    if (opts.preferOther && levels.length === 2) { const o = (car.kind !== "Regular" && pickLevel(other, (s) => s.cat === car.kind)) || pickLevel(other, (s) => s.cat === "Regular"); if (o) return o; }
    return (car.kind !== "Regular" && best((s) => s.cat === car.kind)) || best((s) => s.cat === "Regular");
  }
  /* Send a car to a slot on any level. Returns {level, slot} or null. */
  function parkAnywhere(w, car, fromLevel, slotLevel, slotId, opts = {}) {
    const st = w[fromLevel];
    let target;
    if (slotId) target = { level: slotLevel, slot: SLOT[slotId] };
    else { const r = recommendWorld(w, car, fromLevel, opts); if (!r) return null; target = { level: r.level, slot: r.slot }; }
    car.parked = null; car.toIdle = false; car.settle = 0; car.stuck = 0;
    if (target.level === fromLevel) {
      const p = planToSlot(st.G, car, target.slot); if (!p) return null;
      car.mode = "auto"; car.path = p.pts; car.wp = 0; car.target = target.slot.id; car.goal = null;
      st.slotStatus[target.slot.id] = "reserved"; st.slotCar[target.slot.id] = car.id;
    } else {
      const p = planToNode(st.G, car, fromLevel === 1 ? "DOWN" : "UP");
      car.mode = "auto"; car.path = p.pts; car.wp = 0; car.target = null; car.goal = { level: target.level, slot: target.slot.id };
      w[target.level].slotStatus[target.slot.id] = "reserved"; w[target.level].slotCar[target.slot.id] = car.id;
    }
    return target;
  }
  function leave(w, car, level) {
    const st = w[level];
    if (car.target && st.slotCar[car.target] === car.id && st.slotStatus[car.target] === "reserved") { st.slotStatus[car.target] = "free"; delete st.slotCar[car.target]; }
    const p = planToNode(st.G, car, level === 1 ? "EXIT" : "UP");
    car.mode = "leaving"; car.path = p.pts; car.wp = 0; car.target = null; car.goal = { exit: true }; car.parked = null; car.settle = 0; car.toIdle = false;
    car.leftSlotAt = car.leftSlotAt || Date.now();
  }
  /* Background visitors: scan at the B1 gate, then auto-select (some prefer the quieter B2). */
  function spawnAuto(w) {
    const st = w[1];
    if (!entranceClear(st)) return null;
    const r = Math.random();
    const c = newCar(r < 0.08 ? "EV" : r < 0.13 ? "Ladies" : r < 0.17 ? "VIP" : "Regular");
    st.cars.push(c); c.scannedAt = Date.now();
    const t = parkAnywhere(w, c, 1, null, null, { preferOther: Math.random() < 0.35 });
    if (!t) { addLog(st, [`Tidak ada slot kosong untuk mobil #${c.id}, kembali keluar`, `No free slot for car #${c.id}, heading back out`]); leave(w, c, 1); return c; }
    addLog(st, [`Mobil #${c.id}${c.kind !== "Regular" ? ` (${kindPair(c.kind)[0]})` : ""} memindai QRIS · menuju ${code(t.level, t.slot.id)}`, `Car #${c.id}${c.kind !== "Regular" ? ` (${kindPair(c.kind)[1]})` : ""} scanned QRIS · heading to ${code(t.level, t.slot.id)}`]);
    return c;
  }
  /* Ramp transfer: the car leaves this level's map and appears at the other level's arrival point. */
  function transfer(w, car, from, to) {
    const A = w[from], B = w[to];
    A.cars = A.cars.filter((c) => c !== car);
    Object.assign(car, ARRIVE[to], { v: 40, steer: 0, path: null, wp: 0, blocked: 0, ghost: 0, stuck: 0, transfer: 0 });
    B.cars.push(car);
    addLog(A, [`Mobil #${car.id} ${to === 2 ? "turun lewat ramp ke B2" : "naik lewat ramp ke B1"}`, `Car #${car.id} took the ramp ${to === 2 ? "down to B2" : "up to B1"}`]);
    const g = car.goal;
    if (g && g.exit) { const p = planToNode(B.G, car, to === 1 ? "EXIT" : "UP"); car.mode = "leaving"; car.path = p.pts; }
    else if (g && g.level === to && g.slot) {
      const s = SLOT[g.slot];
      const okFree = (B.slotStatus[g.slot] !== "occupied") && allowed(car, s);
      car.goal = null;
      if (okFree) { const p = planToSlot(B.G, car, s); car.mode = "auto"; car.path = p.pts; car.target = g.slot; }
      else { const t = parkAnywhere(w, car, to, to, null, { level: to }); if (!t) leave(w, car, to); }
    } else { car.mode = "manual"; car.v = 0; }
    if (w.onTransfer) w.onTransfer(car, from, to);
  }
  /* Drag and drop with the mouse or a finger */
  function canPark(st, car, s) {
    const w = st.world;
    const occ = st.cars.find((o) => o !== car && (o.parked === s.id || (o.mode === "auto" && o.target === s.id)));
    if (occ) return { ok: false, reason: occ.parked === s.id ? [`Slot ${code(st, s.id)} sudah terisi.`, `Slot ${code(st, s.id)} is occupied.`] : [`Slot ${code(st, s.id)} sudah dipesan untuk mobil #${occ.id}.`, `Slot ${code(st, s.id)} is reserved for car #${occ.id}.`] };
    const other = w && w[st.level === 1 ? 2 : 1].cars.find((o) => o !== car && o.goal && o.goal.level === st.level && o.goal.slot === s.id);
    if (other) return { ok: false, reason: [`Slot ${code(st, s.id)} sudah dipesan untuk mobil #${other.id}.`, `Slot ${code(st, s.id)} is reserved for car #${other.id}.`] };
    if (st.slotStatus[s.id] === "occupied" && st.slotCar[s.id] !== car.id) return { ok: false, reason: [`Slot ${code(st, s.id)} sudah terisi.`, `Slot ${code(st, s.id)} is occupied.`] };
    if (!allowed(car, s)) return { ok: false, reason: [`Slot ${code(st, s.id)} khusus untuk ${CATS[s.cat].who[0]}.`, `Slot ${code(st, s.id)} is for ${CATS[s.cat].who[1]} only.`] };
    return { ok: true };
  }
  function beginDrag(st, car) {
    const origin = { x: car.x, y: car.y, a: car.a, mode: car.mode, parked: car.parked, target: car.target, goal: car.goal, path: car.path, wp: car.wp, settle: car.settle, toIdle: car.toIdle };
    car.mode = "drag"; car.parked = null; car.target = null; car.goal = null; car.path = null; car.settle = 0; car.v = 0; car.toIdle = false;
    return origin;
  }
  const inDrive = (G, p) => G.DRIVE.some((r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3]);
  function dragTo(st, car, x, y) {
    if (!inDrive(st.G, [x, y]) || x < 4 || x > W - 4) return;
    const dx = x - car.x, dy = y - car.y, d = Math.hypot(dx, dy);
    if (d > 1.5) car.a = car.a + wrap(Math.atan2(dy, dx) - car.a) * Math.min(1, d / 30);
    car.x = x; car.y = y;
  }
  function endDrag(st, car, origin) {
    const restore = () => Object.assign(car, origin);
    const s = slotAt(car.x, car.y, 0);
    if (s) {
      const chk = canPark(st, car, s);
      if (!chk.ok) { restore(); return { ok: false, msg: chk.reason }; }
      car.mode = "auto"; car.target = s.id; car.path = null; car.settle = 0.35;
      return { ok: true, msg: [`Mobil #${car.id} dipindahkan ke ${code(st, s.id)}`, `Car #${car.id} dropped into ${code(st, s.id)}`] };
    }
    if (overlaps(st, car)) { restore(); return { ok: false, msg: ["Ada mobil lain yang menghalangi. Letakkan di tempat yang kosong.", "Another car is in the way. Drop it on a free spot."] }; }
    car.mode = "manual"; car.v = 0;
    return { ok: true, msg: null };
  }
  function circles(c) { const hx = Math.cos(c.a), hy = Math.sin(c.a); return [[c.x + hx * 9, c.y + hy * 9], [c.x - hx * 9, c.y - hy * 9]]; }
  function overlaps(st, c) {
    const a = circles(c);
    return st.cars.some((o) => o !== c && Math.abs(o.x - c.x) < 44 && Math.abs(o.y - c.y) < 44 && circles(o).some((q) => a.some((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 17)));
  }
  function aheadBlocked(st, c, rev) {
    const s = rev ? -1 : 1, hx = Math.cos(c.a) * s, hy = Math.sin(c.a) * s;
    return st.cars.some((o) => {
      if (o === c) return false;
      const dx = o.x - c.x, dy = o.y - c.y;
      const along = dx * hx + dy * hy, lat = Math.abs(-dx * hy + dy * hx);
      return along > 6 && along < 44 && lat < 19;
    });
  }

  function stepCar(st, c, dt) {
    const WB = 24;
    if (c.mode === "drag" || c.mode === "parked" || c.mode === "manual") { c.v = 0; return; }
    if (c.settle > 0) {
      const s = SLOT[c.target];
      const k = Math.min(1, dt * 6);
      c.x += (s.cx - c.x) * k; c.y += (s.cy - c.y) * k; c.a = wrap(c.a + wrap(s.angle - c.a) * k); c.v = 0;
      c.settle -= dt;
      if (c.settle <= 0) { c.mode = "parked"; c.parked = s.id; c.x = s.cx; c.y = s.cy; c.a = s.angle; c.parkedAt = c.parkedAt || Date.now(); }
      return;
    }
    const p = c.path && c.path[c.wp];
    if (!p) { c.v = 0; if (c.toIdle) { c.toIdle = false; c.mode = "manual"; } return; }
    const rev = !!p.rev;
    const dx = p.x - c.x, dy = p.y - c.y, dd = Math.hypot(dx, dy);
    const head = rev ? c.a + Math.PI : c.a;
    const behind = dx * Math.cos(head) + dy * Math.sin(head) < 0;
    if (p.final && (dd < 20 || (dd < 36 && behind))) { c.settle = 0.45; return; }
    const radius = p.rev ? 12 : (p.exit || p.ramp) ? 26 : (c.path[c.wp + 1] && c.path[c.wp + 1].final ? 16 : 20);
    if (dd < radius || (dd < radius * 2.4 && behind)) { c.wp++; if (p.exit) c.gone = true; if (p.ramp) c.transfer = p.ramp; return; }
    const diff = wrap(Math.atan2(dy, dx) - head);
    const steer = clamp(diff * 1.9, -0.68, 0.68) * (rev ? -1 : 1);
    c.steer += (steer - c.steer) * Math.min(1, dt * 10);
    const nearFinal = c.path.slice(c.wp).some((q) => q.final) && c.path.length - c.wp <= 2;
    let vt = (rev ? 38 : nearFinal ? 50 : 165) * (1 - Math.min(0.65, Math.abs(diff) / 1.7));
    if (!rev && Math.abs(diff) > 2.2) vt = 30;
    if (c.ghost > 0) c.ghost -= dt;
    else if (aheadBlocked(st, c, rev)) { vt = 0; c.blocked += dt; if (c.blocked > 2.6) { c.ghost = 1.6; c.blocked = 0; } }
    else c.blocked = 0;
    const tv = rev ? -vt : vt;
    c.v += clamp(tv - c.v, -260 * dt, 160 * dt);
    c.a = wrap(c.a + (c.v / WB) * Math.tan(c.steer) * dt);
    c.x += Math.cos(c.a) * c.v * dt; c.y += Math.sin(c.a) * c.v * dt;
    c.stuck = Math.abs(c.v) < 3 ? c.stuck + dt : 0;
    if (c.stuck > 6 && c.mode === "auto" && c.target) { c.stuck = 0; const pl = planToSlot(st.G, c, SLOT[c.target]); if (pl) { c.path = pl.pts; c.wp = 0; } }
  }

  const durL = (ms, l) => { const s = Math.max(0, Math.round(ms / 1000)), en = l === "en"; return s < 60 ? `${s} ${en ? "s" : "dtk"}` : `${Math.floor(s / 60)} ${en ? "min" : "mnt"} ${s % 60} ${en ? "s" : "dtk"}`; };
  const dur = (ms) => durL(ms, LANG.get());
  function stepLevel(st, dt) {
    const w = st.world;
    st.t += dt;
    st.cars.slice().forEach((c) => stepCar(st, c, dt));
    st.cars.filter((c) => c.gone).forEach((c) => { c.exitedAt = Date.now(); const pd = c.parkedAt ? (c.leftSlotAt || Date.now()) - c.parkedAt : null; addLog(st, [`Mobil #${c.id} melewati ramp keluar dan meninggalkan mal${pd !== null ? ` · parkir ${durL(pd, "id")}` : ""}`, `Car #${c.id} passed the exit ramp and left the mall${pd !== null ? ` · parked ${durL(pd, "en")}` : ""}`]); if (w && w.onExit) w.onExit(c); });
    st.cars = st.cars.filter((c) => !c.gone);
    if (w) st.cars.filter((c) => c.transfer).forEach((c) => transfer(w, c, st.level, c.transfer));
    // physical occupancy (what the cars are actually doing), plus reservations made from the other level
    const next = {}, owner = {};
    SLOTS.forEach((s) => next[s.id] = "free");
    st.cars.forEach((c) => { if (c.mode === "auto" && c.target) { next[c.target] = "reserved"; owner[c.target] = c.id; } });
    if (w) w[st.level === 1 ? 2 : 1].cars.forEach((c) => { if (c.goal && c.goal.level === st.level && c.goal.slot) { next[c.goal.slot] = "reserved"; owner[c.goal.slot] = c.id; } });
    st.cars.forEach((c) => {
      const s = slotAt(c.x, c.y, 6); if (!s) return;
      const still = c.mode === "parked" || (c.mode === "manual" && Math.abs(c.v) < 4);
      if (still) { next[s.id] = "occupied"; owner[s.id] = c.id; if (c.mode === "manual" && !c.parked) { c.parked = s.id; c.parkedAt = c.parkedAt || Date.now(); } }
    });
    st.cars.forEach((c) => { if (c.mode === "manual" && c.parked && !slotAt(c.x, c.y, 6)) c.parked = null; });
    st.slotStatus = next; st.slotCar = owner;
    // a car dropped into a reserved slot: re-route the car that was heading there
    st.cars.forEach((c) => {
      if (c.mode === "auto" && c.target && next[c.target] === "occupied" && owner[c.target] !== c.id && !c.settle) {
        addLog(st, [`${code(st, c.target)} sudah terisi, rute mobil #${c.id} dihitung ulang`, `${code(st, c.target)} was taken, re-routing car #${c.id}`]);
        c.target = null; if (!parkAnywhere(w, c, st.level, st.level, null, { level: st.level })) leave(w, c, st.level);
      }
    });
    // simulated IoT sensors: each slot's ultrasonic sensor reports presence after a short random delay
    SLOTS.forEach((s) => {
      const occ = next[s.id] === "occupied", sen = st.sensor[s.id], pend = st.pending[s.id];
      if (occ !== sen.occ) { if (!pend || pend.occ !== occ) st.pending[s.id] = { occ, at: st.t + 0.25 + Math.random() * 0.5 }; }
      else if (pend) delete st.pending[s.id];
      const p2 = st.pending[s.id];
      if (p2 && st.t >= p2.at) {
        sen.occ = p2.occ; sen.at = Date.now(); sen.dist = p2.occ ? 0.35 + Math.random() * 0.25 : 2.3 + Math.random() * 0.5;
        st.lastReading = sen.at; delete st.pending[s.id];
        addLog(st, [`Sensor ${code(st, s.id)} → ${sen.occ ? "terisi" : "kosong"} (${sen.dist.toFixed(2)} m)`, `Sensor ${code(st, s.id)} → ${sen.occ ? "occupied" : "vacant"} (${sen.dist.toFixed(2)} m)`], "sensor");
      }
      st.display[s.id] = sen.occ ? "occupied" : next[s.id] === "reserved" ? "reserved" : "free";
    });
  }
  function step(w, dt) {
    w.t += dt;
    stepLevel(w[1], dt); stepLevel(w[2], dt);
    if (w.queue > 0 && entranceClear(w[1])) { if (spawnAuto(w)) w.queue--; }
    if (w.traffic) {
      if (w.t > w.nextSpawn) { w.nextSpawn = w.t + 2.4 + Math.random() * 3; if (w[1].cars.length + w[2].cars.length < 105) spawnAuto(w); }
      if (w.t > w.nextLeave) {
        w.nextLeave = w.t + 1.6 + Math.random() * 1.8;
        const parked = [];
        [1, 2].forEach((L) => w[L].cars.forEach((c) => { if (c.mode === "parked" && c.id !== w[L].selected && !c.user) parked.push([c, L]); }));
        const occ = parked.length / 100;
        if (parked.length && Math.random() < clamp((occ - 0.4) * 2.2, 0.05, 1)) { const [c, L] = parked[Math.floor(Math.random() * parked.length)]; leave(w, c, L); }
      }
    }
  }
  function seed(st, n) {
    const ids = SLOTS.map((s) => s.id).sort(() => Math.random() - 0.5).slice(0, n);
    ids.forEach((id, i) => {
      const s = SLOT[id];
      const c = newCar(s.cat !== "Regular" ? s.cat : "Regular"); Object.assign(c, { x: s.cx, y: s.cy, a: s.angle, mode: "parked", parked: id, target: id, parkedAt: Date.now() - (5 + i * 3) * 60000, color: PAINT[(i * 3) % PAINT.length] });
      st.cars.push(c);
      st.sensor[id] = { occ: true, dist: 0.35 + Math.random() * 0.25, at: Date.now() };
    });
    stepLevel(st, 0);
  }

  /* ---------- drawing ---------- */
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  /* painted road arrow (filled), pointing along +x before rotation */
  function arrow(g, x, y, ang, col, s = 1) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s); g.fillStyle = col;
    g.beginPath(); g.moveTo(14, 0); g.lineTo(3, -8); g.lineTo(3, -3); g.lineTo(-14, -3); g.lineTo(-14, 3); g.lineTo(3, 3); g.lineTo(3, 8); g.closePath(); g.fill(); g.restore();
  }
  function alpha(c, a) {
    if (!c) return c;
    if (c[0] === "#") { const h = c.length === 4 ? c.slice(1).split("").map((x) => x + x).join("") : c.slice(1, 7); const n = parseInt(h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
    const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const [r, gg, b] = m[1].split(",").map((v) => parseFloat(v)); return `rgba(${r},${gg},${b},${a})`; }
    return c;
  }
  function drawRamp(g, C, [x0, y0, x1, y1], dirAng, label) {
    x0 = Math.max(0, x0); x1 = Math.min(W, x1);
    g.save();
    g.fillStyle = C.road; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    g.strokeStyle = alpha(C.paintY, .16); g.lineWidth = 7;
    for (let i = -90; i < 220; i += 24) { g.beginPath(); g.moveTo(x0 + i, y1); g.lineTo(x0 + i + 46, y0); g.stroke(); }
    g.restore();
    g.fillStyle = alpha(C.paintY, .9); g.fillRect(x0, y0, x1 - x0, 3); g.fillRect(x0, y1 - 3, x1 - x0, 3);
    arrow(g, (x0 + x1) / 2 - 16, (y0 + y1) / 2, dirAng, alpha(C.paint, .8), 0.9); arrow(g, (x0 + x1) / 2 + 18, (y0 + y1) / 2, dirAng, alpha(C.paint, .8), 0.9);
    // label pill under the ramp
    g.font = `700 10.5px ${C.mono}`; g.textAlign = "center"; g.textBaseline = "middle";
    const lines = label.split("\n"), wmax = Math.max(...lines.map((l) => g.measureText(l).width)) + 16, cxm = (x0 + x1) / 2;
    g.fillStyle = alpha(C.building, .92); rrect(g, cxm - wmax / 2, 262, wmax, 14 * lines.length + 10, 6); g.fill();
    g.fillStyle = C.buildingInk; lines.forEach((ln, i) => g.fillText(ln, cxm, 274 + i * 14));
  }
  function drawCar(g, c, C, catCol, sel) {
    const lift = c.mode === "drag";
    g.save(); g.translate(c.x, c.y); g.rotate(c.a);
    if (lift) g.scale(1.08, 1.08);
    g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = lift ? 12 : 6; g.shadowOffsetY = lift ? 5 : 2;
    g.fillStyle = c.color; rrect(g, -18, -9, 36, 18, 6); g.fill();
    g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0;
    // soft highlight along the body
    const hl = g.createLinearGradient(0, -9, 0, 9); hl.addColorStop(0, "rgba(255,255,255,.18)"); hl.addColorStop(.45, "rgba(255,255,255,0)"); hl.addColorStop(1, "rgba(0,0,0,.18)");
    g.fillStyle = hl; rrect(g, -18, -9, 36, 18, 6); g.fill();
    // glass: windscreen, roof, rear window
    g.fillStyle = "rgba(14,22,36,.88)";
    g.beginPath(); g.moveTo(3, -7.2); g.lineTo(10, -6); g.lineTo(10, 6); g.lineTo(3, 7.2); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-13, -6); g.lineTo(-8, -7); g.lineTo(-8, 7); g.lineTo(-13, 6); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,.10)"; rrect(g, -7.5, -6.6, 10, 13.2, 2); g.fill();
    g.fillStyle = "rgba(120,170,230,.18)"; g.fillRect(4.5, -5, 3, 4);
    // mirrors
    g.fillStyle = c.color; g.fillRect(2, -11, 3, 2.2); g.fillRect(2, 8.8, 3, 2.2);
    // lamps
    g.fillStyle = "#fff4d1"; rrect(g, 15.5, -7.5, 2.5, 3.6, 1); g.fill(); rrect(g, 15.5, 3.9, 2.5, 3.6, 1); g.fill();
    g.fillStyle = c.v < -1 ? "#ff3b3b" : "#b3262e"; g.fillRect(-18, -7.5, 2, 3.6); g.fillRect(-18, 3.9, 2, 3.6);
    if (c.kind !== "Regular") { g.fillStyle = catCol(c.kind); g.beginPath(); g.arc(-2.5, 0, 4.2, 0, 7); g.fill(); g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 1.2; g.stroke(); }
    g.restore();
    if (sel) {
      g.strokeStyle = C.accent; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.arc(c.x, c.y, 26, 0, 7); g.stroke(); g.setLineDash([]);
      g.font = `700 11px ${C.mono}`; g.textAlign = "center"; g.textBaseline = "middle";
      const t = "#" + c.id, tw = g.measureText(t).width + 12;
      g.fillStyle = C.accent; rrect(g, c.x - tw / 2, c.y - 46, tw, 17, 8.5); g.fill();
      g.fillStyle = C.accentInk; g.fillText(t, c.x, c.y - 37.5);
    }
  }
  function draw(g, st, C, opts = {}) {
    const L = st.level;
    const catCol = (cat) => cat === "EV" ? C.ev : cat === "Ladies" ? C.ladies : C.vip;
    // base: structure / islands
    g.fillStyle = C.asphalt2; g.fillRect(0, 0, W, H);
    // driving surfaces and slot floors
    g.fillStyle = C.road;
    st.G.DRIVE.forEach(([x0, y0, x1, y1]) => g.fillRect(x0, y0, x1 - x0, y1 - y0));
    g.fillStyle = C.asphalt;
    [[210, 90, 790, 170], [210, 250, 790, 410], [210, 490, 790, 650]].forEach(([x0, y0, x1, y1]) => g.fillRect(x0, y0, x1 - x0, y1 - y0));
    // curb edges around islands
    g.strokeStyle = alpha(C.paint, .14); g.lineWidth = 2;
    [[0, 90, 110, 170], [0, 250, 110, 650], [890, 90, 1000, 170], [890, 250, 1000, 650], [110, 90, 190, 170], [810, 90, 890, 170]].forEach(([x0, y0, x1, y1]) => g.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2));
    if (L === 1) { g.strokeRect(1, 701, 108, 27); g.strokeRect(891, 701, 108, 27); }
    else { g.fillStyle = C.building; g.fillRect(0, 650, 110, 80); g.fillRect(890, 650, 110, 80); g.fillStyle = alpha(C.buildingInk, .7); g.font = `600 10px ${C.mono}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(tt("DINDING", "WALL"), 55, 690); g.fillText(tt("DINDING", "WALL"), 945, 690); }
    // back wall & lift lobby
    g.fillStyle = C.building; g.fillRect(0, 0, W, 64);
    g.fillStyle = C.buildingInk; g.font = `800 28px ${C.display}`; g.textBaseline = "middle"; g.textAlign = "left";
    g.fillText(`BASEMENT ${L}`, 24, 33);
    const tw = g.measureText(`BASEMENT ${L}`).width;
    g.fillStyle = alpha(C.buildingInk, .65); g.font = `500 11px ${C.mono}`; g.fillText(tt("GRAND AVENUE MALL · PARKIR PINTAR (SIMULASI IoT)", "GRAND AVENUE MALL · SMART PARKING (SIMULATED IoT)"), 24 + tw + 16, 34);
    g.textAlign = "right"; g.fillText(tt("LIFT ▲ KE MAL", "LIFT ▲ TO MALL"), W - 24, 34);
    g.fillStyle = C.asphalt2; g.fillRect(0, 64, W, 26);
    [520, 680].forEach((x) => {
      g.fillStyle = alpha(C.accent, .25); g.fillRect(x - 26, 58, 52, 6);
      g.fillStyle = alpha(C.buildingInk, .55); g.font = `600 9.5px ${C.mono}`; g.textAlign = "center"; g.fillText(tt("LOBI LIFT", "LIFT LOBBY"), x, 77);
    });
    // pillars
    [[200, 130], [800, 130], [200, 330], [800, 330], [200, 570], [800, 570], [55, 450], [945, 450]].forEach(([x, y]) => {
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x - 7, y - 5, 16, 16);
      g.fillStyle = C.pillar; g.fillRect(x - 8, y - 8, 16, 16);
      g.fillStyle = alpha(C.ok, .55); g.fillRect(x - 8, y - 1, 16, 3);
    });
    // ramps
    if (L === 1) { drawRamp(g, C, RAMP_R, 0, tt("RAMP ▼\nKE B2", "RAMP ▼\nTO B2")); drawRamp(g, C, RAMP_L, 0, tt("DARI B2\n▲ RAMP", "FROM B2\n▲ RAMP")); }
    else { drawRamp(g, C, RAMP_R, Math.PI, tt("DARI B1\nRAMP ▼", "FROM B1\nRAMP ▼")); drawRamp(g, C, RAMP_L, Math.PI, tt("RAMP ▲\nNAIK KE B1", "RAMP ▲\nUP TO B1")); }
    // slots
    SLOTS.forEach((s) => {
      const stt = st.display[s.id] || "free";
      if (stt === "free") { g.fillStyle = alpha(s.cat !== "Regular" ? catCol(s.cat) : C.ok, s.cat !== "Regular" ? .18 : .11); g.fillRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6); }
      if (stt === "reserved") { g.fillStyle = alpha(C.amber, .2); g.fillRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6); }
      if (s.cat !== "Regular") { g.strokeStyle = alpha(catCol(s.cat), .85); g.lineWidth = 1.6; g.setLineDash([5, 4]); g.strokeRect(s.x + 5, s.y + 5, s.w - 10, s.h - 10); g.setLineDash([]); }
      if (opts.hl === s.id) { g.strokeStyle = C.paint; g.lineWidth = 2.5; g.strokeRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6); }
      if (opts.drop === s.id) { g.strokeStyle = opts.dropOk ? C.ok : C.bad; g.lineWidth = 4; g.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4); }
    });
    // slot lines: dividers + back line, wheel stops
    g.strokeStyle = alpha(C.paint, .82); g.lineWidth = 2;
    ROWS.forEach((row) => {
      const back = row.dir > 0 ? row.y0 + SD : row.y0;
      g.beginPath(); g.moveTo(X0, back); g.lineTo(X0 + 10 * SW, back);
      for (let i = 0; i <= 10; i++) { g.moveTo(X0 + i * SW, row.y0); g.lineTo(X0 + i * SW, row.y0 + SD); }
      g.stroke();
      g.fillStyle = alpha(C.paintY, .55);
      for (let i = 0; i < 10; i++) { const wy = row.dir > 0 ? row.y0 + SD - 12 : row.y0 + 9; g.fillRect(X0 + i * SW + 17, wy, 24, 3); }
    });
    g.textAlign = "center"; g.textBaseline = "middle";
    SLOTS.forEach((s) => {
      const stt = st.display[s.id] || "free";
      const back = s.dir > 0 ? s.y + 12 : s.y + s.h - 12; // label at the slot mouth, facing the aisle
      // IoT sensor LED on the wall at the back of each slot
      const led = stt === "occupied" ? C.bad : stt === "reserved" ? C.amber : C.ok;
      const ly = s.dir > 0 ? s.y + s.h - 4 : s.y + 4;
      g.fillStyle = alpha(led, .25); g.beginPath(); g.arc(s.x + s.w - 9, ly, 5.5, 0, 7); g.fill();
      g.fillStyle = led; g.beginPath(); g.arc(s.x + s.w - 9, ly, 2.8, 0, 7); g.fill();
      g.font = `600 10.5px ${C.mono}`;
      g.fillStyle = stt === "free" ? (s.cat !== "Regular" ? catCol(s.cat) : alpha(C.paint, .75)) : stt === "reserved" ? C.amber : alpha(C.paint, .45);
      g.fillText(s.id, s.cx, back);
      if (s.cat !== "Regular" && stt === "free") { g.font = `800 15px ${C.display}`; g.fillStyle = catCol(s.cat); g.fillText(CATS[s.cat].glyph, s.cx, s.cy + (s.dir > 0 ? 6 : -6)); }
    });
    // road markings: two-way bottom aisle (keep left) and one-way arrows
    const ax0 = L === 1 ? 0 : 110, ax1 = L === 1 ? 1000 : 890;
    g.setLineDash([16, 14]); g.strokeStyle = alpha(C.paintY, .85); g.lineWidth = 2;
    g.beginPath(); g.moveTo(Math.max(ax0, 110), 690); g.lineTo(Math.min(ax1, 890), 690); g.stroke(); g.setLineDash([]);
    const ac = alpha(C.paint, .55);
    [300, 560].forEach((x) => { arrow(g, x, 210, 0, ac); arrow(g, x, 450, 0, ac); });
    [320, 640].forEach((x) => { arrow(g, x, LANE_E, 0, ac); arrow(g, x - 60, LANE_W, Math.PI, ac); });
    [330, 590].forEach((y) => { arrow(g, 150, y, -Math.PI / 2, ac); arrow(g, 850, y, Math.PI / 2, ac); });
    g.fillStyle = alpha(C.paint, .4); g.font = `700 9px ${C.mono}`; g.textAlign = "left";
    g.fillText(tt("LAJUR KIRI", "KEEP LEFT"), 470, 668);
    // waiting bay (B1) for visitors deciding where to park
    if (L === 1) {
      g.strokeStyle = alpha(C.paint, .35); g.lineWidth = 1.5; g.setLineDash([6, 5]); g.strokeRect(BAY_WAIT[0] + 1, BAY_WAIT[1] + 1, BAY_WAIT[2] - BAY_WAIT[0] - 2, BAY_WAIT[3] - BAY_WAIT[1] - 2); g.setLineDash([]);
      g.fillStyle = alpha(C.paint, .45); g.font = `700 9px ${C.mono}`; g.textAlign = "right"; g.fillText(tt("AREA TUNGGU · BUKA PETA", "WAITING BAY · OPEN MAP"), BAY_WAIT[2] - 8, 750);
      // gates across the entry and exit lanes (left lane)
      const gate = (x, label, open, labelX) => {
        g.fillStyle = C.pillar; g.fillRect(x - 6, 642, 12, 12);
        g.save(); g.translate(x, 648); g.rotate(open ? -0.25 : Math.PI / 2);
        g.fillStyle = C.paintY; g.fillRect(0, -2.5, 50, 5); g.fillStyle = C.building; for (let i = 8; i < 50; i += 14) g.fillRect(i, -2.5, 7, 5);
        g.restore();
        g.fillStyle = C.buildingInk; g.font = `700 10.5px ${C.mono}`; g.textAlign = "center";
        g.fillStyle = alpha(C.building, .92); const lw2 = g.measureText(label).width + 14; rrect(g, labelX - lw2 / 2, 734, lw2, 18, 9); g.fill();
        g.fillStyle = C.buildingInk; g.fillText(label, labelX, 743);
      };
      const waiting = st.cars.some((c) => c.atGate);
      gate(56, tt("MASUK MAL ▸", "MALL ENTRY ▸"), st.cars.some((c) => !c.atGate && c.mode !== "parked" && Math.abs(c.x - 56) < 60 && Math.abs(c.y - LANE_E) < 30), 60);
      gate(944, tt("RAMP KELUAR ▸", "EXIT RAMP ▸"), st.cars.some((c) => Math.abs(c.x - 944) < 60 && Math.abs(c.y - LANE_E) < 30), 940);
      arrow(g, 30, LANE_E, 0, ac, .8); arrow(g, 975, LANE_E, 0, ac, .8);
      g.fillStyle = waiting ? C.accent : C.pillar; rrect(g, 66, 618, 38, 22, 5); g.fill();
      g.fillStyle = waiting ? C.accentInk : C.buildingInk; g.font = `700 9.5px ${C.mono}`; g.textAlign = "center"; g.fillText("QRIS", 85, 629);
    }
    // route of the selected car
    const sel = st.cars.find((c) => c.id === st.selected);
    if (sel && sel.path && (sel.mode === "auto" || sel.mode === "leaving") && (sel.target || sel.goal)) {
      const route = sel.path.slice(sel.wp);
      g.strokeStyle = alpha(C.accent, .9); g.lineWidth = 3; g.setLineDash([2, 7]); g.lineCap = "round";
      g.beginPath(); g.moveTo(sel.x, sel.y); route.forEach((p) => g.lineTo(p.x, p.y)); g.stroke(); g.setLineDash([]); g.lineCap = "butt";
      const last = route[route.length - 1]; if (last) { g.fillStyle = C.accent; g.beginPath(); g.arc(Math.min(W - 6, Math.max(6, last.x)), last.y, 5, 0, 7); g.fill(); }
    }
    st.cars.forEach((c) => drawCar(g, c, C, catCol, c.id === st.selected));
  }
  function colors() {
    const cs = getComputedStyle(document.body); const v = (n) => cs.getPropertyValue(n).trim();
    return { asphalt: v("--asphalt"), asphalt2: v("--asphalt-2"), road: v("--road") || v("--asphalt"), pillar: v("--pillar") || v("--building"), paint: v("--paint"), paintY: v("--paint-y"), building: v("--building"), buildingInk: v("--building-ink"),
      surface2: v("--surface-2"), muted: v("--muted"), ink: v("--ink"), ok: v("--ok"), bad: v("--bad"), amber: v("--amber"), accent: v("--accent"), accentInk: v("--accent-ink"),
      ev: v("--ev"), ladies: v("--ladies"), vip: v("--vip"), display: v("--display"), mono: v("--mono") };
  }
  return { kindLabel, kindPair, W, H, SLOTS, SLOT, ROWS, CATS, KINDS, FEED, GEO, createState, createWorld, seed, step, draw, colors, findCar, arriveAtGate, openGate, spawnAuto, parkAnywhere, recommendWorld, leave, canPark, beginDrag, dragTo, endDrag, slotAt, allowed, addLog, code, dur };
})();

