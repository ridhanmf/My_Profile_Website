/* ===== KostBills: boarding-house billing ===== */
const KOS = (() => {
  const BLOCKS = "ABCDEFGHIJ".split("");
  /* Billing rule: one flat rent that already includes cleaning, security and maintenance.
     Electricity is a prepaid token bought by the tenant, so it never appears on a bill. */
  const RENT = 850000;
  const INCLUDED = "Sudah termasuk kebersihan, keamanan, dan perawatan. Listrik memakai token prabayar milik penghuni dan tidak ditagihkan.";
  const DUE_SOON_DAYS = 7;
  const METHODS = ["Transfer BCA", "QRIS", "Transfer Mandiri", "Transfer BRI", "Cash"];
  const STATUSES = ["Paid", "Partial", "Unpaid", "Due Soon", "Overdue"];
  const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  /* Internal keys stay in English (stored data, filters); these are the Indonesian display labels. */
  const STATUS_LABEL = { Paid: "Lunas", Partial: "Dibayar sebagian", Unpaid: "Belum bayar", "Due Soon": "Segera jatuh tempo", Overdue: "Terlambat" };
  const ROOM_LABEL = { Occupied: "Terisi", Vacant: "Kosong", Maintenance: "Perbaikan", Reserved: "Dipesan" };
  const methodLabel = (m) => (m === "Cash" ? "Tunai" : m);
  const FIRST = ["Andi", "Budi", "Citra", "Dewi", "Eko", "Fajar", "Gita", "Hendra", "Indah", "Joko", "Kartika", "Lestari", "Made", "Nanda", "Oktavia", "Putri", "Rizky", "Sari", "Taufik", "Utami", "Vina", "Wahyu", "Yogi", "Zahra", "Agus", "Bayu", "Dimas", "Fitri", "Galih", "Hana", "Irfan", "Jihan", "Kevin", "Laras", "Mega", "Nur", "Oki", "Pandu", "Rani", "Satria", "Tiara", "Wulan", "Yusuf", "Aulia", "Bima", "Cahya", "Dinda", "Farhan", "Ilham", "Nabila"];
  const LAST = ["Pratama", "Saputra", "Wijaya", "Hidayat", "Santoso", "Kusuma", "Nugroho", "Lestari", "Siregar", "Harahap", "Setiawan", "Rahmawati", "Putra", "Wibowo", "Utomo", "Simanjuntak", "Gunawan", "Fauzi", "Maharani", "Permana", "Ramadhan", "Susanto", "Halim", "Purnomo", "Anggraini", "Nasution", "Firmansyah", "Sihombing"];
  const JOBS = ["Mahasiswa", "Mahasiswa", "Mahasiswa", "Karyawan swasta", "Karyawan swasta", "Perawat", "Guru", "Programmer", "Staf bank", "Wiraswasta", "Desainer", "Admin kantor"];
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d || 1); };
  const monthLabel = (m, short) => { const [y, mo] = m.split("-").map(Number); return short ? MONTHS[mo - 1].slice(0, 3) : `${MONTHS[mo - 1]} ${y}`; };
  const addMonths = (m, k) => { const [y, mo] = m.split("-").map(Number); return ym(new Date(y, mo - 1 + k, 1)); };
  const today = () => ymd(new Date());
  const daysUntil = (dateStr) => Math.round((parse(dateStr) - parse(today())) / 86400000);
  const dueFor = (m, day) => { const [y, mo] = m.split("-").map(Number); const last = new Date(y, mo, 0).getDate(); return `${m}-${pad(Math.min(day, last))}`; };

  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function generate() {
    const R = rng(20261011);
    const pick = (a) => a[Math.floor(R() * a.length)];
    const between = (a, b) => a + Math.floor(R() * (b - a + 1));
    const rooms = [], tenants = [], bills = [], trx = [];
    const now = new Date(); const curM = ym(now); const tday = today();
    const months = []; for (let k = 11; k >= 0; k--) months.push(addMonths(curM, -k));
    let tid = 0, trxSeq = 0;
    BLOCKS.forEach((b) => {
      for (let f = 1; f <= 4; f++) for (let n = 1; n <= 25; n++) {
        const r = R();
        const status = r < 0.015 ? "Maintenance" : r < 0.025 ? "Reserved" : r < 0.12 ? "Vacant" : "Occupied";
        const room = { id: `${b}-${f}${pad(n)}`, block: b, floor: f, no: n, rent: RENT, status, tenantId: null };
        if (status === "Occupied") {
          let ci = new Date(between(2023, 2026), Math.floor(R() * 12), between(1, 28));
          if (ci > now) ci = new Date(2025, ci.getMonth(), ci.getDate());
          const ten = { id: "T" + pad(++tid, 4), name: `${pick(FIRST)} ${pick(LAST)}`, phone: `08${pick(["11", "12", "13", "21", "22", "52", "57", "77", "81", "95"])}-${between(1000, 9999)}-${between(1000, 9999)}`, job: pick(JOBS), roomId: room.id, checkIn: ymd(ci), checkOut: null, deposit: RENT, dueDay: ci.getDate(), active: true };
          tenants.push(ten); room.tenantId = ten.id;
          const habit = R();
          months.forEach((m) => {
            if (m < ym(ci)) return;
            const due = dueFor(m, ten.dueDay);
            const bill = { id: `INV-${m.replace("-", "").slice(2)}-${room.id.replace("-", "")}`, roomId: room.id, tenantId: ten.id, month: m, rent: RENT, paid: 0, due, issued: `${m}-01` };
            const pay = (dateStr, amount) => {
              if (dateStr > tday) dateStr = tday; if (dateStr < bill.issued) dateStr = bill.issued;
              trx.push({ id: `TRX-${dateStr.slice(2, 4)}${dateStr.slice(5, 7)}-${pad(++trxSeq, 5)}`, billId: bill.id, roomId: room.id, tenantId: ten.id, date: dateStr, amount, method: pick(METHODS) });
              bill.paid += amount;
            };
            const shift = (d) => { const x = parse(due); x.setDate(x.getDate() + d); return ymd(x); };
            const pr = R(), dleft = Math.round((parse(due) - parse(tday)) / 86400000);
            if (dleft < 0) {
              const recent = m >= addMonths(curM, -1);
              const skip = recent ? (habit < 0.08 ? 0.6 : 0.04) : (habit < 0.03 ? 0.3 : 0);
              if (pr < skip) { if (R() < 0.25) pay(shift(-between(0, 3)), RENT / 2); }
              else pay(shift(habit < 0.15 ? between(-2, 6) : between(-6, 0)), RENT);
            } else {
              const early = habit > 0.6 ? 0.55 : 0.2;
              if (pr < early) pay(ymd(new Date(now.getTime() - between(0, 8) * 86400000)), RENT);
              else if (pr < early + 0.04) pay(ymd(new Date(now.getTime() - between(0, 5) * 86400000)), RENT / 2);
            }
            bills.push(bill);
          });
        }
        rooms.push(room);
      }
    });
    for (let i = 0; i < 60; i++) {
      tenants.push({ id: "T" + pad(++tid, 4), name: `${pick(FIRST)} ${pick(LAST)}`, phone: `08${pick(["12", "13", "57", "81"])}-${between(1000, 9999)}-${between(1000, 9999)}`, job: pick(JOBS), roomId: pick(rooms).id, checkIn: ymd(new Date(between(2022, 2024), between(0, 11), between(1, 28))), checkOut: ymd(new Date(2025, between(0, 11), between(1, 28))), deposit: 0, dueDay: 1, active: false });
    }
    trx.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    return { v: 3, generatedFor: curM, rooms, tenants, bills, trx, trxSeq };
  }

  const KEY = "kos-demo-v3";
  let D = null, IX = null;
  function load() {
    const saved = store.get(KEY, null);
    D = saved && saved.v === 3 && saved.rooms && saved.rooms.length === 1000 ? saved : generate();
    reindex();
    return D;
  }
  function reindex() {
    IX = { room: {}, tenant: {}, bill: {}, billsByRoom: {}, trxByBill: {} };
    D.rooms.forEach((r) => IX.room[r.id] = r);
    D.tenants.forEach((t) => IX.tenant[t.id] = t);
    D.bills.forEach((b) => { IX.bill[b.id] = b; (IX.billsByRoom[b.roomId] = IX.billsByRoom[b.roomId] || []).push(b); });
    D.trx.forEach((t) => (IX.trxByBill[t.billId] = IX.trxByBill[t.billId] || []).push(t));
  }
  let saveT;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { if (!store.set(KEY, D)) toast("This browser couldn't keep your demo changes."); }, 300); }
  function reset() { store.del(KEY); D = generate(); reindex(); }
  const total = (b) => b.rent;
  const balance = (b) => Math.max(0, total(b) - b.paid);
  function status(b) {
    if (balance(b) <= 0) return "Paid";
    const d = daysUntil(b.due);
    if (d < 0) return "Overdue";
    if (d <= DUE_SOON_DAYS) return "Due Soon";
    if (b.paid > 0) return "Partial";
    return "Unpaid";
  }
  const STATUS_PILL = { Paid: "ok", Partial: "info", Unpaid: "plain", "Due Soon": "warn", Overdue: "bad" };
  const ROOM_PILL = { Occupied: "info", Vacant: "vac", Maintenance: "mnt", Reserved: "ok" };
  function months() { return [...new Set(D.bills.map((b) => b.month))].sort().reverse(); }
  function years() { return [...new Set(D.bills.map((b) => b.month.slice(0, 4)).concat(D.trx.map((t) => t.date.slice(0, 4))))].sort().reverse(); }

  function recordPayment(bill, amount, method, date) {
    const seq = (D.trxSeq = (D.trxSeq || D.trx.length) + 1);
    const t = { id: `TRX-${date.slice(2, 4)}${date.slice(5, 7)}-${pad(seq, 5)}`, billId: bill.id, roomId: bill.roomId, tenantId: bill.tenantId, date, amount, method };
    bill.paid += amount;
    D.trx.unshift(t); (IX.trxByBill[bill.id] = IX.trxByBill[bill.id] || []).push(t);
    persist(); return t;
  }
  function makeBill(room, m) {
    const ten = IX.tenant[room.tenantId]; if (!ten) return null;
    const id = `INV-${m.replace("-", "").slice(2)}-${room.id.replace("-", "")}`;
    if (IX.bill[id]) return null;
    const b = { id, roomId: room.id, tenantId: ten.id, month: m, rent: room.rent || RENT, paid: 0, due: dueFor(m, ten.dueDay || 1), issued: today() < `${m}-01` ? `${m}-01` : today() };
    D.bills.push(b); IX.bill[id] = b; (IX.billsByRoom[room.id] = IX.billsByRoom[room.id] || []).push(b);
    return b;
  }
  function generateMonth(m) {
    let n = 0; D.rooms.forEach((r) => { if (r.status === "Occupied" && makeBill(r, m)) n++; }); persist(); return n;
  }
  function checkIn(room, info) {
    const ten = { id: "T" + pad(D.tenants.length + 1, 4), name: info.name, phone: info.phone, job: info.job, roomId: room.id, checkIn: info.date, checkOut: null, deposit: RENT, dueDay: parse(info.date).getDate(), active: true };
    D.tenants.push(ten); IX.tenant[ten.id] = ten;
    room.status = "Occupied"; room.tenantId = ten.id; room.rent = RENT;
    const m = info.date.slice(0, 7); makeBill(room, m < ym(new Date()) ? ym(new Date()) : m);
    persist(); return ten;
  }
  function checkOut(room) {
    const ten = IX.tenant[room.tenantId]; if (ten) { ten.active = false; ten.checkOut = today(); }
    room.status = "Vacant"; room.tenantId = null; persist();
  }
  function setRoomStatus(room, s) { room.status = s; persist(); }

  function sumBills(bl) {
    const billed = bl.reduce((s, b) => s + total(b), 0);
    const collected = bl.reduce((s, b) => s + Math.min(b.paid, total(b)), 0);
    const st = {}; STATUSES.forEach((k) => st[k] = 0); bl.forEach((b) => st[status(b)]++);
    return { count: bl.length, billed, collected, outstanding: billed - collected, rate: billed ? collected / billed : 0, st };
  }
  function summary(m) { return { m, ...sumBills(D.bills.filter((b) => b.month === m)) }; }
  function collectedInYear(y) { return D.trx.filter((t) => t.date.slice(0, 4) === y).reduce((s, t) => s + t.amount, 0); }
  return { STATUS_LABEL, ROOM_LABEL, methodLabel, BLOCKS, RENT, INCLUDED, METHODS, STATUSES, MONTHS, DUE_SOON_DAYS, load, reset, persist, total, balance, status, daysUntil, STATUS_PILL, ROOM_PILL, months, years, recordPayment, generateMonth, checkIn, checkOut, setRoomStatus, summary, sumBills, collectedInYear, monthLabel, addMonths, ym, today, get D() { return D; }, get IX() { return IX; } };
})();

function kosSummary() {
  if (!KOS.D) KOS.load();
  const occ = KOS.D.rooms.filter((r) => r.status === "Occupied").length;
  const y = KOS.today().slice(0, 4);
  return { occ: Math.round(occ / 10) + "%", collected: idrShort(KOS.collectedInYear(y)), overdue: KOS.D.bills.filter((b) => KOS.status(b) === "Overdue").length };
}

