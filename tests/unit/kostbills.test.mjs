import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_load.mjs";

const fresh = () => { const e = loadEngine(["engine/kostbills.js"], ["KOS"]); e.KOS.load(); return e; };
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return ymd(d); };

test("demo data: 1,000 rooms in blocks A–J, 4 floors × 25 rooms", () => {
  const { KOS } = fresh();
  assert.equal(KOS.D.rooms.length, 1000);
  assert.equal(KOS.BLOCKS.join(""), "ABCDEFGHIJ");
  assert.ok(KOS.D.rooms.some((r) => r.id === "A-101") && KOS.D.rooms.some((r) => r.id === "J-425"));
  const st = new Set(KOS.D.rooms.map((r) => r.status));
  ["Occupied", "Vacant", "Maintenance"].forEach((s) => assert.ok(st.has(s), `has ${s} rooms`));
});

test("billing rule: every bill is the flat Rp850.000 rent, nothing else (no electricity line)", () => {
  const { KOS } = fresh();
  assert.equal(KOS.RENT, 850000);
  assert.match(KOS.INCLUDED, /prepaid token/i);
  assert.ok(KOS.D.bills.length > 1000);
  KOS.D.bills.forEach((b) => {
    assert.equal(KOS.total(b), 850000);
    assert.ok(!("electricity" in b) && !("items" in b));
  });
});

test("due date follows the tenant's move-in day", () => {
  const { KOS } = fresh();
  const room = KOS.D.rooms.find((r) => r.status === "Vacant");
  const ten = KOS.checkIn(room, { name: "Uji Coba", phone: "0812-0000-0000", job: "Tester", date: ymd(new Date()) });
  assert.equal(ten.dueDay, new Date().getDate());
  assert.equal(room.status, "Occupied");
  const bill = KOS.D.bills.find((b) => b.roomId === room.id);
  assert.ok(bill, "a bill is issued for the current month");
  assert.equal(Number(bill.due.slice(8)), Math.min(ten.dueDay, new Date(Number(bill.month.slice(0, 4)), Number(bill.month.slice(5)), 0).getDate()));
});

test("status: Paid / Partial / Unpaid / Due Soon (≤7 days) / Overdue", () => {
  const { KOS } = fresh();
  const mk = (paid, due) => ({ rent: 850000, paid, due });
  assert.equal(KOS.status(mk(850000, inDays(-30))), "Paid");
  assert.equal(KOS.status(mk(0, inDays(-1))), "Overdue");
  assert.equal(KOS.status(mk(425000, inDays(-3))), "Overdue");
  assert.equal(KOS.status(mk(0, inDays(0))), "Due Soon");
  assert.equal(KOS.status(mk(0, inDays(7))), "Due Soon");
  assert.equal(KOS.status(mk(0, inDays(8))), "Unpaid");
  assert.equal(KOS.status(mk(425000, inDays(20))), "Partial");
});

test("recording a payment updates the bill, balance and transaction history", () => {
  const { KOS } = fresh();
  const bill = KOS.D.bills.find((b) => KOS.balance(b) === 850000);
  const before = KOS.D.trx.length;
  const t = KOS.recordPayment(bill, 850000, "QRIS", ymd(new Date()));
  assert.equal(KOS.balance(bill), 0);
  assert.equal(KOS.status(bill), "Paid");
  assert.equal(KOS.D.trx.length, before + 1);
  assert.equal(KOS.D.trx[0].id, t.id);
  assert.match(t.id, /^TRX-\d{4}-\d{5}$/);
});

test("generating a month's bills is idempotent", () => {
  const { KOS } = fresh();
  const next = KOS.addMonths(KOS.ym(new Date()), 1);
  const first = KOS.generateMonth(next);
  const occupied = KOS.D.rooms.filter((r) => r.status === "Occupied").length;
  assert.equal(first, occupied);
  assert.equal(KOS.generateMonth(next), 0);
});

test("revenue summary adds up", () => {
  const { KOS } = fresh();
  const m = KOS.ym(new Date());
  const s = KOS.summary(m);
  assert.equal(s.outstanding, s.billed - s.collected);
  assert.equal(s.billed, s.count * 850000);
  assert.equal(Object.values(s.st).reduce((a, b) => a + b, 0), s.count);
});
