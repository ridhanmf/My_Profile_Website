import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_load.mjs";

const fresh = () => loadEngine(["engine/smartpark.js"], ["SP"]).SP;
const run = (SP, w, secs, until) => { for (let i = 0; i < secs * 60; i++) { SP.step(w, 1 / 60); if (until && until()) return i / 60; } return null; };

test("each basement has 50 slots with EV/Ladies/VIP in the top-right corner", () => {
  const SP = fresh();
  assert.equal(SP.SLOTS.length, 50);
  const special = SP.SLOTS.filter((s) => s.cat !== "Regular").map((s) => `${s.id}:${s.cat}`);
  assert.deepEqual([...special], ["A5:EV", "A6:EV", "A7:Ladies", "A8:Ladies", "A9:VIP", "A10:VIP"]);
  special.forEach((x) => assert.ok(SP.SLOT[x.split(":")[0]].x >= 400, "special slots are on the right half of row A"));
  const w = SP.createWorld();
  assert.equal(Object.keys(w[1].slotStatus).length, 50);
  assert.equal(Object.keys(w[2].slotStatus).length, 50);
});

test("B1 has the street gates and ramps; B2 has ramps only (no gates)", () => {
  const SP = fresh();
  const n1 = Object.keys(SP.GEO[1].N), n2 = Object.keys(SP.GEO[2].N);
  ["ENT", "EXIT", "DOWN", "UPIN"].forEach((k) => assert.ok(n1.includes(k), `B1 has ${k}`));
  assert.ok(!n2.includes("ENT") && !n2.includes("EXIT"), "B2 has no street gate");
  assert.ok(n2.includes("UP") && n2.includes("RIN"), "B2 has ramp in/out");
});

test("category rules: regular cars can't use EV/Ladies/VIP slots", () => {
  const SP = fresh();
  const w = SP.createWorld();
  const car = SP.arriveAtGate(w, "Regular");
  assert.equal(SP.allowed(car, SP.SLOT.A5), false);
  assert.equal(SP.allowed(car, SP.SLOT.B1), true);
  const r = SP.canPark(w[1], car, SP.SLOT.A9);
  assert.equal(r.ok, false);
  assert.match(r.reason[0], /VIP/);
  assert.match(r.reason[1], /VIP members only/);
});

test("auto-select prefers the matching category slot for EV cars", () => {
  const SP = fresh();
  const w = SP.createWorld();
  const car = SP.arriveAtGate(w, "EV");
  SP.openGate(w, car);
  const rec = SP.recommendWorld(w, car, 1);
  assert.ok(rec, "a recommendation is returned");
  assert.equal(rec.slot.cat, "EV");
});

test("keep-left: the gate lane and all two-way bottom-aisle segments follow Indonesian traffic", () => {
  const SP = fresh();
  const w = SP.createWorld();
  const car = SP.arriveAtGate(w, "Regular");
  assert.ok(car.y < 690, "arriving car is on the upper (left-hand, eastbound) lane");
  SP.openGate(w, car);
  run(SP, w, 10, () => car.mode === "manual");
  SP.parkAnywhere(w, car, 1, 1, "E9");
  const segs = [];
  for (let i = 0; i < car.path.length - 1; i++) {
    const a = car.path[i], b = car.path[i + 1];
    if (a.rev || b.rev || a.final || b.final) continue;
    if (Math.abs(a.y - 690) <= 17 && Math.abs(b.y - 690) <= 17 && Math.abs(b.x - a.x) > 20) segs.push([a, b]);
  }
  segs.forEach(([a, b]) => assert.equal(a.y, b.x > a.x ? 674 : 706, "eastbound=674 (upper), westbound=706 (lower)"));
});

test("full journey: gate → QRIS → B1 → ramp → park on B2, sensor confirms after a lag", () => {
  const SP = fresh();
  const w = SP.createWorld();
  const car = SP.arriveAtGate(w, "Regular");
  SP.openGate(w, car);
  run(SP, w, 10, () => car.mode === "manual");
  const target = SP.parkAnywhere(w, car, 1, 2, "C3");
  assert.equal(target.level, 2);
  assert.deepEqual({ ...car.goal }, { level: 2, slot: "C3" });
  const t = run(SP, w, 60, () => car.mode === "parked");
  assert.ok(t !== null, "car parks within 60 simulated seconds");
  const found = SP.findCar(w, car.id);
  assert.equal(found.level, 2);
  assert.equal(car.parked, "C3");
  assert.equal(w[2].slotStatus.C3, "occupied");
  run(SP, w, 6);
  assert.equal(w[2].display.C3, "occupied", "simulated sensor eventually reports the slot as occupied");
});

test("leaving from B2 drives up the ramp and out of the B1 exit", () => {
  const SP = fresh();
  const w = SP.createWorld();
  let exited = null;
  w.onExit = (c) => { exited = c; };
  const car = SP.arriveAtGate(w, "Regular");
  SP.openGate(w, car);
  run(SP, w, 10, () => car.mode === "manual");
  SP.parkAnywhere(w, car, 1, 2, "B2");
  run(SP, w, 60, () => car.mode === "parked");
  SP.leave(w, car, 2);
  const t = run(SP, w, 90, () => !SP.findCar(w, car.id));
  assert.ok(t !== null, "car leaves the simulation");
  assert.equal(w[2].slotStatus.B2, "free");
});
