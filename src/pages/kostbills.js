/* ===== KostBills demo (#kos-demo): dashboard UI, PDF and CSV exports. Text follows LANG (ID/EN). ===== */
/* ---------- Display helpers ---------- */
const nf = (n) => Number(n || 0).toLocaleString(locale());
const pct = (r) => (r * 100).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
const tgl = (s) => { if (!s) return ""; const [y, m, d] = s.split("-"); return `${+d} ${KOS.MONTHS[+m - 1].slice(0, 3)} ${y}`; };
const stLabel = (s) => KOS.statusLabel(s);
const roomLabel = (s) => KOS.roomLabel(s);
const statusPill = (s) => `<span class="pill ${KOS.STATUS_PILL[s]}">${stLabel(s)}</span>`;
const typeChip = (t) => `<span class="rtype rtype-${t.toLowerCase()}">${t}</span>`;
const dueText = (d) => (d < 0 ? tt(`terlambat ${-d} hari`, `${-d} day${d === -1 ? "" : "s"} overdue`) : d === 0 ? tt("jatuh tempo hari ini", "due today") : tt(`jatuh tempo ${d} hari lagi`, `due in ${d} day${d === 1 ? "" : "s"}`));
const typeCount = (rooms) => KOS.TYPES.map((t) => [t, rooms.filter((r) => r.type === t).length]);

/* WhatsApp reminder, written in the selected language. In this demo it goes to the property manager's
   number (the profile number), never to the generated tenants' phone numbers, which are fictional. */
function reminderText(b) {
  const t = KOS.IX.tenant[b.tenantId] || {}, d = KOS.daysUntil(b.due), bal = idr(KOS.balance(b));
  return tt(`Halo ${t.name || "Bapak/Ibu"}, ini pengingat dari ${PROPERTY.name}. Tagihan sewa kamar ${b.roomId} untuk ${KOS.monthLabel(b.month)} sebesar ${bal} ${d < 0 ? `sudah lewat jatuh tempo sejak ${tgl(b.due)}` : d === 0 ? `jatuh tempo hari ini, ${tgl(b.due)}` : `jatuh tempo ${d} hari lagi, pada ${tgl(b.due)}`}. Mohon segera melakukan pembayaran. Terima kasih.`,
    `Hello ${t.name || "there"}, this is a reminder from ${PROPERTY.name}. The rent for room ${b.roomId} for ${KOS.monthLabel(b.month)}, ${bal}, ${d < 0 ? `has been overdue since ${tgl(b.due)}` : d === 0 ? `is due today, ${tgl(b.due)}` : `is due in ${d} day${d === 1 ? "" : "s"}, on ${tgl(b.due)}`}. Please make the payment soon. Thank you.`);
}
const phoneBtn = (b) => `<button class="icon-btn phone-ic" data-phone="${b.id}" title="${tt("Lihat di HP penghuni", "View on the tenant's phone")}" aria-label="${tt("Lihat di HP penghuni", "View on the tenant's phone")} ${b.roomId}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg></button>`;
const waReminder = (b) => `<a class="icon-btn wa-ic" href="${esc(waHref(reminderText(b)))}" target="_blank" rel="noopener" title="${tt("Kirim pengingat WhatsApp", "Send a WhatsApp reminder")}" aria-label="${tt("Kirim pengingat WhatsApp untuk", "Send a WhatsApp reminder for")} ${b.roomId}">${WA_ICON}</a>`;

/* ---------- PDF (jsPDF loaded on demand) ---------- */
let jspdfP = null;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!jspdfP) jspdfP = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => res(window.jspdf); s.onerror = () => { jspdfP = null; rej(new Error("load")); };
    document.head.appendChild(s);
  });
  return jspdfP;
}
const PROPERTY = { name: "Griya Kos Sejahtera", addr: () => tt("KostBills · 10 blok · 1.000 kamar · properti demo", "KostBills · 10 blocks · 1,000 rooms · demo property") };
const pdfFail = () => toast(tt("Alat PDF gagal dimuat. Periksa koneksi internet Anda.", "Couldn't load the PDF tool. Check your connection."));
async function pdfInvoice(bill) {
  let lib; try { lib = await loadJsPDF(); } catch (e) { pdfFail(); return; }
  const { jsPDF } = lib; const doc = new jsPDF({ unit: "mm", format: "a4" });
  const room = KOS.IX.room[bill.roomId], ten = KOS.IX.tenant[bill.tenantId] || {};
  const st = KOS.status(bill), tot = KOS.total(bill), pays = KOS.IX.trxByBill[bill.id] || [];
  doc.setFillColor(31, 79, 216); doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(PROPERTY.name.toUpperCase(), 16, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(PROPERTY.addr(), 16, 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(st === "Paid" ? tt("KUITANSI", "RECEIPT") : "INVOICE", 194, 16, { align: "right" });
  doc.setTextColor(20); doc.setFontSize(10);
  const L = (k, v, x, y) => { doc.setFont("helvetica", "normal"); doc.setTextColor(110); doc.text(k, x, y); doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.text(String(v), x, y + 5); };
  L(tt("No. invoice", "Invoice no."), bill.id, 16, 42); L(tt("Bulan tagihan", "Billing month"), KOS.monthLabel(bill.month), 70, 42); L(tt("Diterbitkan", "Issued"), tgl(bill.issued), 124, 42); L(tt("Jatuh tempo", "Due date"), tgl(bill.due), 164, 42);
  L(tt("Penghuni", "Tenant"), ten.name || "—", 16, 58); L(tt("Kamar", "Room"), `${room.id} · ${room.type} · ${tt("Blok", "Block")} ${room.block}, ${tt("lantai", "floor")} ${room.floor}`, 70, 58); L(tt("Telepon", "Phone"), ten.phone || "—", 124, 58); L("Status", stLabel(st), 164, 58);
  let y = 78;
  doc.setDrawColor(215); doc.setFillColor(244, 246, 249); doc.rect(16, y - 6, 178, 9, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(90); doc.text(tt("KETERANGAN", "DESCRIPTION"), 19, y); doc.text(tt("JUMLAH", "AMOUNT"), 191, y, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setTextColor(20); doc.setFontSize(10);
  y += 10; doc.text(`${tt("Sewa kamar", "Room rent")}, ${KOS.monthLabel(bill.month)}`, 19, y); doc.text(idr(bill.rent), 191, y, { align: "right" });
  y += 5; doc.setFontSize(8.5); doc.setTextColor(110); doc.text(KOS.included(), 19, y, { maxWidth: 140 }); doc.setTextColor(20); doc.setFontSize(10);
  y += 8; doc.line(16, y, 194, y);
  y += 9; doc.setFont("helvetica", "bold"); doc.text("Total", 130, y); doc.text(idr(tot), 191, y, { align: "right" });
  y += 7; doc.setFont("helvetica", "normal"); doc.text(tt("Dibayar", "Paid"), 130, y); doc.text(idr(Math.min(bill.paid, tot)), 191, y, { align: "right" });
  y += 7; doc.setFont("helvetica", "bold"); doc.setTextColor(st === "Paid" ? 23 : 194, st === "Paid" ? 128 : 43, st === "Paid" ? 61 : 43); doc.text(tt("Sisa tagihan", "Balance due"), 130, y); doc.text(idr(KOS.balance(bill)), 191, y, { align: "right" });
  doc.setTextColor(20);
  if (pays.length) {
    y += 16; doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(tt("Pembayaran", "Payments"), 16, y); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    pays.forEach((p) => { y += 6; doc.text(`${tgl(p.date)}   ${p.id}   ${KOS.methodLabel(p.method)}`, 16, y); doc.text(idr(p.amount), 191, y, { align: "right" }); });
  }
  y += 16; doc.setFontSize(9); doc.setTextColor(110);
  const day = (KOS.IX.tenant[bill.tenantId] || {}).dueDay || Number(bill.due.slice(8));
  doc.text(tt(`Sewa jatuh tempo setiap tanggal ${day}, sesuai tanggal masuk penghuni.`, `Rent is due every month on day ${day}, the tenant's move-in date.`), 16, y);
  doc.text(tt("Dokumen demo dari proyek portofolio KostBills. Nama dan nominal adalah data contoh.", "Demo document generated by the KostBills portfolio project. Names and amounts are sample data."), 16, 285);
  await saveFile(`${bill.id}.pdf`, doc.output("blob"));
}
async function pdfReport(m) {
  let lib; try { lib = await loadJsPDF(); } catch (e) { pdfFail(); return; }
  const { jsPDF } = lib; const doc = new jsPDF({ unit: "mm", format: "a4" });
  const s = KOS.summary(m);
  doc.setFillColor(17, 24, 33); doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(tt("KOSTBILLS · LAPORAN PENDAPATAN BULANAN", "KOSTBILLS · MONTHLY REVENUE REPORT"), 16, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`${PROPERTY.name} · ${KOS.monthLabel(m)} · ${tt("dicetak", "printed")} ${tgl(KOS.today())}`, 16, 19);
  doc.setTextColor(20);
  const occ = KOS.D.rooms.filter((r) => r.status === "Occupied").length;
  const tiles = [[tt("Ditagihkan", "Billed"), idr(s.billed)], [tt("Terkumpul", "Collected"), idr(s.collected)], [tt("Belum terbayar", "Outstanding"), idr(s.outstanding)], [tt("Tingkat penagihan", "Collection rate"), pct(s.rate)], [tt("Tagihan terbit", "Bills issued"), nf(s.count)], [tt("Hunian", "Occupancy"), `${nf(occ)} / ${nf(1000)}`]];
  tiles.forEach(([k, v], i) => { const x = 16 + (i % 3) * 60, y = 38 + Math.floor(i / 3) * 18; doc.setFontSize(9); doc.setTextColor(110); doc.text(k, x, y); doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(String(v), x, y + 6); doc.setFont("helvetica", "normal"); });
  doc.setFontSize(8.5); doc.setTextColor(110); doc.text(`${tt("Sewa", "Rent")} ${idr(KOS.RENT)} ${tt("per kamar per bulan", "per room per month")}. ${KOS.included()}`, 16, 76, { maxWidth: 178 }); doc.setTextColor(20);
  let y = 92;
  const head = (cols, xs) => { doc.setFillColor(244, 246, 249); doc.rect(16, y - 5, 178, 8, "F"); doc.setFontSize(8.5); doc.setTextColor(90); doc.setFont("helvetica", "bold"); cols.forEach((c, i) => doc.text(c, xs[i], y, { align: i ? "right" : "left" })); doc.setFont("helvetica", "normal"); doc.setTextColor(20); doc.setFontSize(9.5); };
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(tt("Per blok", "By block"), 16, y - 8);
  const xs = [19, 70, 105, 140, 165, 191];
  head([tt("Blok", "Block"), tt("Terisi", "Occupied"), tt("Ditagihkan", "Billed"), tt("Terkumpul", "Collected"), tt("Terlambat", "Overdue"), tt("Tingkat", "Rate")], xs);
  KOS.BLOCKS.forEach((b) => {
    const r = KOS.sumBills(KOS.D.bills.filter((x) => x.month === m && x.roomId[0] === b));
    const oc = KOS.D.rooms.filter((x) => x.block === b && x.status === "Occupied").length;
    y += 7.5; [`${tt("Blok", "Block")} ${b}`, `${oc} / 100`, idrShort(r.billed), idrShort(r.collected), String(r.st.Overdue), r.billed ? pct(r.rate) : "—"].forEach((v, i) => doc.text(v, xs[i], y, { align: i ? "right" : "left" }));
  });
  y += 16; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(tt("Status tagihan", "Bill status"), 16, y - 8);
  head(["Status", tt("Tagihan", "Bills"), "", "", "", tt("Porsi", "Share")], xs);
  Object.entries(s.st).forEach(([k, v]) => { y += 7.5; doc.text(stLabel(k), 19, y); doc.text(String(v), 70, y, { align: "right" }); doc.text(s.count ? pct(v / s.count) : "—", 191, y, { align: "right" }); });
  const od = KOS.D.bills.filter((b) => b.month === m && KOS.status(b) === "Overdue").slice(0, 14);
  if (od.length) {
    y += 16; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(`${tt("Tagihan terlambat", "Overdue bills")} (${od.length}${od.length === 14 ? "+" : ""})`, 16, y - 8);
    head([tt("Kamar · penghuni", "Room · tenant"), "", "", "", tt("Jatuh tempo", "Due"), tt("Sisa", "Balance")], xs);
    od.forEach((b) => { y += 7; if (y > 280) return; const t = KOS.IX.tenant[b.tenantId] || {}; doc.text(`${b.roomId} · ${t.name || ""}`, 19, y); doc.text(tgl(b.due), 165, y, { align: "right" }); doc.text(idr(KOS.balance(b)), 191, y, { align: "right" }); });
  }
  doc.setFontSize(8); doc.setTextColor(120); doc.text(tt("Laporan demo dari proyek portofolio KostBills. Semua angka adalah data contoh.", "Demo report generated by the KostBills portfolio project. All figures are sample data."), 16, 290);
  await saveFile(`kostbills-${tt("laporan", "report")}-${m}.pdf`, doc.output("blob"));
}
function csvOf(rows) { return rows.map((r) => r.map((v) => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n"); }

/* ---------- Page ---------- */
const curY = () => KOS.today().slice(0, 4), curMo = () => KOS.today().slice(5, 7);
PAGES["kos-demo"] = {
  view: "overview",
  f: {
    rooms: { block: "A", floor: "", status: "", type: "", q: "", mode: "map", page: 0 },
    tenants: { q: "", active: "1", page: 0 },
    bills: { mo: null, year: null, status: "", block: "", q: "", page: 0 },
    trx: { q: "", method: "", mo: "", year: "", page: 0 },
    rep: { mo: null, year: null },
  },
  mount(view) {
    KOS.load();
    const saved = store.get("kos-view", null); if (saved) this.view = saved;
    this.el = view;
    view.addEventListener("click", (e) => this.onClick(e));
    this.paint();
  },
  /* Hero + shell; called again when the language changes (state and filters are kept). */
  paint() {
    this.el.lang = LANG.get();
    this.el.innerHTML = `<div class="kos-hero kos-hero-demo" style="--art:${esc(svgUrl(ART.kost()))}"><div class="wrap kos-hero-in">
      <div style="min-width:0"><a class="kos-back" href="#kos">${ICON.arrow}<span>${tt("Kembali ke halaman KostBills", "Back to the KostBills page")}</span></a>
      <div class="eyebrow">${tt("Demo interaktif · Manajemen properti", "Interactive demo · Property management")}</div><h1>${tt("Demo KostBills", "KostBills Demo")}</h1>
      <p>${tt("Tagihan dan hunian untuk kos 1.000 kamar: siapa tinggal di mana, berapa tagihan tiap kamar bulan ini, dan berapa yang sudah terkumpul.", "Billing and occupancy for a 1,000-room boarding house: who lives where, what each room owes this month, and what has been collected.")}</p></div>
      ${langSwitch("on-dark")}
    </div></div>
      <div class="bleed"><div class="kos-shell"><nav class="kos-nav" id="kos-nav" aria-label="${tt("Bagian dasbor", "Dashboard sections")}"></nav><div class="kos-main" id="kos-main"></div></div></div>`;
    this.render();
  },
  onLang() { const y = window.scrollY; closeModal(); this.paint(); window.scrollTo(0, y); },
  nav() {
    const od = KOS.D.bills.filter((b) => KOS.status(b) === "Overdue").length;
    const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const icons = {
      overview: I('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
      rooms: I('<path d="M3 21V7l9-4 9 4v14"/><path d="M9 21v-6h6v6"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>'),
      tenants: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'),
      bills: I('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
      trx: I('<path d="M4 7h13l-3-3M20 17H7l3 3"/>'),
      reports: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    };
    const items = [["overview", tt("Ringkasan", "Overview")], ["rooms", tt("Kamar", "Rooms")], ["tenants", tt("Penghuni", "Tenants")], ["bills", tt("Tagihan bulanan", "Monthly bills"), od], ["trx", tt("Transaksi", "Transactions")], ["reports", tt("Laporan pendapatan", "Revenue reports")]];
    $("#kos-nav").innerHTML = items.map(([k, l, b]) => `<button data-kv="${k}" aria-current="${this.view === k}"><span class="kn-l">${icons[k]}${l}</span>${b ? `<span class="badge num" title="${tt("Tagihan terlambat", "Overdue bills")}">${nf(b)}</span>` : ""}</button>`).join("") +
      `<div class="sep"></div><button data-act="reset-demo" style="font-weight:500;color:var(--muted);font-size:13px">${tt("Atur ulang data demo", "Reset demo data")}</button>`;
  },
  render() {
    this.nav();
    const el = $("#kos-main");
    const note = `<div class="demo-note"><b>${tt("Data demo", "Demo data")}</b><span>${tt(`1.000 kamar dengan penghuni dan tagihan contoh. Sewa ${idr(KOS.RENT)}/bulan, sudah termasuk semua kecuali listrik (token prabayar). Perubahan yang Anda buat hanya tersimpan di browser ini.`, `1,000 rooms with sample tenants and bills. Rent ${idr(KOS.RENT)}/month, all-in except electricity (prepaid token). Changes you make are kept in this browser only.`)}</span></div>`;
    el.innerHTML = note + this["v_" + this.view]();
    if (this.after) { this.after(); this.after = null; }
  },
  setView(v) { this.view = v; store.set("kos-view", v); this.render(); window.scrollTo({ top: Math.min(window.scrollY, $("#kos-main").getBoundingClientRect().top + window.scrollY - 80) }); },
  monthYearSelects(prefix, mo, year, allowAll) {
    const ys = KOS.years();
    return `<label><span class="sr">${tt("Bulan", "Month")}</span><select class="select" id="${prefix}-mo">${allowAll ? `<option value="" ${!mo ? "selected" : ""}>${tt("Semua bulan", "All months")}</option>` : ""}${KOS.MONTHS.map((n, i) => { const v = String(i + 1).padStart(2, "0"); return `<option value="${v}" ${mo === v ? "selected" : ""}>${n}</option>`; }).join("")}</select></label>
      <label><span class="sr">${tt("Tahun", "Year")}</span><select class="select" id="${prefix}-year">${allowAll ? `<option value="" ${!year ? "selected" : ""}>${tt("Semua tahun", "All years")}</option>` : ""}${ys.map((y) => `<option ${year === y ? "selected" : ""}>${y}</option>`).join("")}</select></label>`;
  },

  /* ----- Overview ----- */
  v_overview() {
    const D = KOS.D, ms = KOS.months();
    const cur = KOS.ym(new Date());
    const s = KOS.summary(cur), prevM = KOS.addMonths(cur, -1), prev = KOS.summary(prevM);
    const occ = D.rooms.filter((r) => r.status === "Occupied").length, vac = D.rooms.filter((r) => r.status === "Vacant").length;
    const y = curY(), ytd = KOS.collectedInYear(y);
    const ytdCount = D.trx.filter((t) => t.date.slice(0, 4) === y).length;
    const od = D.bills.filter((b) => KOS.status(b) === "Overdue");
    const soon = D.bills.filter((b) => KOS.status(b) === "Due Soon");
    const series = ms.slice(0, 6).reverse().map((m) => KOS.summary(m));
    this.after = () => this.drawRevenueChart(series);
    const blocks = KOS.BLOCKS.map((b) => { const rs = D.rooms.filter((r) => r.block === b); const c = (st) => rs.filter((r) => r.status === st).length; return { b, o: c("Occupied"), r: c("Reserved"), m: c("Maintenance"), v: c("Vacant") }; });
    const perBlock = typeCount(D.rooms.filter((r) => r.block === "A")).map(([t, n]) => `${n} ${t}`).join(" · ");
    return `
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">${tt("Tingkat hunian", "Occupancy")}</span><span class="k-val num">${pct(occ / 1000)}</span><span class="k-sub">${nf(occ)} ${tt("terisi", "occupied")} · ${nf(vac)} ${tt("kosong", "vacant")}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Terkumpul", "Collected")} · ${KOS.monthLabel(cur)}</span><span class="k-val num">${idrShort(s.collected)}</span><span class="k-sub">${pct(s.rate)} ${tt("dari", "of")} ${idrShort(s.billed)} ${tt("ditagihkan", "billed")}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Total Terkumpul Tahun Ini", "Total Collected This Year")}</span><span class="k-val num">${idrShort(ytd)}</span><span class="k-sub">${nf(ytdCount)} ${tt("pembayaran sejak 1 Jan", "payments since 1 Jan")} ${y}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Tagihan terlambat", "Overdue bills")}</span><span class="k-val num" style="color:var(--bad)">${nf(od.length)}</span><span class="k-sub">${idrShort(od.reduce((a, b) => a + KOS.balance(b), 0))} ${tt("lewat jatuh tempo", "past due")} · ${nf(soon.length)} ${tt("segera jatuh tempo", "due soon")}</span></div>
    </div>
    <div class="grid-2">
      <div class="panel card-pad"><div class="card-title"><h3>${tt("Ditagihkan vs terkumpul, 6 bulan terakhir", "Billed vs collected, last 6 months")}</h3>
        <div class="legend"><span><i style="background:var(--series-2)"></i>${tt("Ditagihkan", "Billed")}</span><span><i style="background:var(--accent)"></i>${tt("Terkumpul", "Collected")}</span></div></div>
        <div class="chart" id="rev-chart"></div>
        <p class="muted" style="font-size:12.5px">${tt(`Penagihan ${KOS.monthLabel(cur)} sejauh ini ${pct(s.rate)}, dibandingkan ${pct(prev.rate)} pada ${KOS.monthLabel(prevM)}. Setiap tagihan jatuh tempo pada tanggal masuk penghuni setiap bulan.`, `${KOS.monthLabel(cur)} collection so far is ${pct(s.rate)}, against ${pct(prev.rate)} for ${KOS.monthLabel(prevM)}. Each bill is due on the tenant's monthly move-in date.`)}</p>
      </div>
      <div class="panel card-pad"><div class="card-title"><h3>${tt("Kamar per blok", "Rooms by block")}</h3><span class="muted" style="font-size:12px">${tt("100 kamar per blok", "100 rooms each")}: ${perBlock}</span></div>
        <div class="legend"><span><i style="background:var(--accent)"></i>${roomLabel("Occupied")}</span><span><i style="background:var(--ok)"></i>${roomLabel("Reserved")}</span><span><i style="background:var(--mnt)"></i>${roomLabel("Maintenance")}</span><span><i style="background:var(--vacant)"></i>${roomLabel("Vacant")}</span></div>
        <div class="hbar-list">${blocks.map((x) => `<button class="hbar" data-goblock="${x.b}" style="border:0;background:none;padding:0;cursor:pointer;color:inherit;text-align:left" title="${tt("Blok", "Block")} ${x.b}: ${x.o} ${roomLabel("Occupied").toLowerCase()}, ${x.r} ${roomLabel("Reserved").toLowerCase()}, ${x.m} ${roomLabel("Maintenance").toLowerCase()}, ${x.v} ${roomLabel("Vacant").toLowerCase()}">
          <span class="mono" style="font-size:12px">${tt("Blok", "Block")} ${x.b}</span><span class="track"><i style="width:${x.o}%;background:var(--accent)"></i><i style="width:${x.r}%;background:var(--ok)"></i><i style="width:${x.m}%;background:var(--mnt)"></i><i style="width:${x.v}%;background:var(--vacant)"></i></span><span class="v">${x.o}%</span></button>`).join("")}</div>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel card-pad"><div class="card-title"><h3>${tt("Pembayaran terbaru", "Recent payments")}</h3><button class="btn sm ghost" data-kv="trx">${tt("Semua transaksi", "All transactions")} ${ICON.arrow}</button></div>
        ${this.trxTable(D.trx.slice(0, 8), true)}</div>
      <div class="panel card-pad"><div class="card-title"><h3>${tt("Perlu ditindaklanjuti", "Needs follow-up")}</h3><button class="btn sm ghost" data-act="bills-overdue">${tt("Semua yang terlambat", "All overdue")} ${ICON.arrow}</button></div>
        <div style="display:grid;gap:2px">${od.slice().sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4).concat(soon.slice().sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3)).map((b) => { const t = KOS.IX.tenant[b.tenantId] || {}; const st = KOS.status(b); const d = KOS.daysUntil(b.due); return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line-2)">
          <button style="border:0;background:none;padding:0;text-align:left;cursor:pointer;min-width:0;color:inherit" data-room="${b.roomId}"><b class="mono">${b.roomId}</b> <span>${esc(t.name || "")}</span><br><span class="muted" style="font-size:12px">${KOS.monthLabel(b.month)} · ${dueText(d)}</span></button>
          <span style="display:flex;gap:6px;align-items:center;flex-shrink:0">${statusPill(st)}${phoneBtn(b)}${waReminder(b)}<button class="btn sm" data-pay="${b.id}">${tt("Catat", "Record")}</button></span></div>`; }).join("") || `<p class="muted">${tt("Tidak ada tagihan yang terlambat atau segera jatuh tempo.", "Nothing overdue or due soon.")}</p>`}</div></div>
    </div>`;
  },
  drawRevenueChart(series) {
    const el = $("#rev-chart"); if (!el) return;
    const Wd = 560, Ht = 230, pl = 52, pr = 8, pt = 10, pb = 26;
    const max = Math.max(...series.map((s) => s.billed)) || 1;
    const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
    const top = nice(max), ticks = 4;
    const y = (v) => pt + (Ht - pt - pb) * (1 - v / top);
    const gw = (Wd - pl - pr) / series.length, bw = Math.min(28, gw * 0.3);
    let svg = `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="${tt("Pendapatan ditagihkan dan terkumpul per bulan", "Billed versus collected revenue by month")}">`;
    for (let i = 0; i <= ticks; i++) { const v = top * i / ticks; svg += `<line class="grid-line" x1="${pl}" x2="${Wd - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 8}" y="${y(v) + 3.5}" text-anchor="end">${(v / 1e6).toLocaleString(locale(), { maximumFractionDigits: 0 })} ${tt("jt", "M")}</text>`; }
    const bar = (x, v, fill) => { const h = Math.max(0, y(0) - y(v)); const r = Math.min(4, h / 2, bw / 2); const yt = y(v); return h > 0 ? `<path d="M${x},${y(0)} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + bw - r} Q${x + bw},${yt} ${x + bw},${yt + r} V${y(0)} Z" fill="${fill}"/>` : ""; };
    series.forEach((s, i) => {
      const cx = pl + gw * i + gw / 2;
      svg += bar(cx - bw - 1, s.billed, "var(--series-2)") + bar(cx + 1, s.collected, "var(--accent)");
      svg += `<text x="${cx}" y="${Ht - 8}" text-anchor="middle">${KOS.monthLabel(s.m, true)}</text>`;
      svg += `<rect class="hit" data-i="${i}" x="${pl + gw * i}" y="${pt}" width="${gw}" height="${Ht - pt - pb}"/>`;
    });
    svg += `<line class="axis" x1="${pl}" x2="${Wd - pr}" y1="${y(0)}" y2="${y(0)}"/></svg>`;
    el.innerHTML = svg + `<div class="tip" hidden></div>`;
    const tip = el.querySelector(".tip");
    el.querySelectorAll(".hit").forEach((r) => {
      const show = () => { const s = series[+r.dataset.i]; const box = el.getBoundingClientRect(), rb = r.getBoundingClientRect();
        tip.innerHTML = `<b>${KOS.monthLabel(s.m)}</b><br>${tt("Ditagihkan", "Billed")} ${idr(s.billed)}<br>${tt("Terkumpul", "Collected")} ${idr(s.collected)} (${pct(s.rate)})`;
        tip.hidden = false; tip.style.left = clamp(rb.left - box.left + rb.width / 2, 90, box.width - 90) + "px"; tip.style.top = (rb.top - box.top + 16) + "px"; };
      r.addEventListener("mouseenter", show); r.addEventListener("click", show); r.addEventListener("mouseleave", () => tip.hidden = true);
    });
  },
  trxTable(list, compact) {
    if (!list.length) return `<p class="muted">${tt("Tidak ada transaksi yang cocok.", "No transactions match.")}</p>`;
    return `<div class="table-wrap" ${compact ? 'style="border:0"' : ""}><table class="t" ${compact ? 'style="min-width:520px"' : ""}><thead><tr><th>${tt("Tanggal", "Date")}</th>${compact ? "" : `<th>${tt("Transaksi", "Transaction")}</th>`}<th>${tt("Kamar", "Room")}</th><th>${tt("Penghuni", "Tenant")}</th>${compact ? "" : "<th>Invoice</th>"}<th>${tt("Metode", "Method")}</th><th class="r">${tt("Jumlah", "Amount")}</th></tr></thead><tbody>
      ${list.map((t) => { const ten = KOS.IX.tenant[t.tenantId] || {}; return `<tr><td class="num">${tgl(t.date)}</td>${compact ? "" : `<td class="mono">${t.id}</td>`}<td><button class="btn ghost sm mono" style="padding:2px 4px" data-room="${t.roomId}">${t.roomId}</button></td><td>${esc(ten.name || "")}</td>${compact ? "" : `<td class="mono">${t.billId}</td>`}<td>${esc(KOS.methodLabel(t.method))}</td><td class="r num">${idr(t.amount)}</td></tr>`; }).join("")}
    </tbody></table></div>`;
  },
  pager(key, n, per) {
    const f = this.f[key], pages = Math.max(1, Math.ceil(n / per)); f.page = clamp(f.page, 0, pages - 1);
    return `<div class="pager"><span>${n ? `${nf(f.page * per + 1)}–${nf(Math.min(n, (f.page + 1) * per))} ${tt("dari", "of")} ${nf(n)}` : tt("0 hasil", "0 results")}</span>
      <div class="btns"><button class="btn sm" data-pager="${key}:-1" ${f.page === 0 ? "disabled" : ""}>${tt("Sebelumnya", "Previous")}</button><button class="btn sm" data-pager="${key}:1" ${f.page >= pages - 1 ? "disabled" : ""}>${tt("Berikutnya", "Next")}</button></div></div>`;
  },

  /* ----- Rooms ----- */
  roomsFiltered() {
    const f = this.f.rooms, q = f.q.trim().toLowerCase();
    return KOS.D.rooms.filter((r) => (!f.block || r.block === f.block) && (!f.floor || r.floor === +f.floor) && (!f.type || r.type === f.type) &&
      (!f.status || (f.status === "Overdue" ? (KOS.IX.billsByRoom[r.id] || []).some((b) => KOS.status(b) === "Overdue") : r.status === f.status)) &&
      (!q || r.id.toLowerCase().includes(q) || (r.tenantId && (KOS.IX.tenant[r.tenantId].name.toLowerCase().includes(q)))));
  },
  v_rooms() {
    const f = this.f.rooms; if (f.mode === "map" && !f.block) f.block = "A";
    const list = this.roomsFiltered();
    const hasOd = (r) => (KOS.IX.billsByRoom[r.id] || []).some((b) => KOS.status(b) === "Overdue");
    const cls = (r) => (hasOd(r) && r.status === "Occupied" ? "due" : { Occupied: "occ", Vacant: "vac", Maintenance: "mnt", Reserved: "res" }[r.status]) + (r.type !== "Regular" ? " t-" + r.type.toLowerCase() : "");
    const cnt = (s) => KOS.D.rooms.filter((r) => r.status === s).length;
    const cur = KOS.ym(new Date());
    const B = tt("Blok", "Block"), FL = tt("Lantai", "Floor");
    let body;
    if (f.mode === "map") {
      const shown = new Set(list.map((r) => r.id));
      body = `<div class="panel card-pad"><div class="card-title"><h3>${tt(`Denah Blok ${f.block}`, `Block ${f.block} floor plan`)}</h3><span class="muted" style="font-size:12px">${tt("Klik kamar untuk melihat detail", "Click a room for details")}</span></div>
        <div class="legend"><span><i style="background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent)"></i>${roomLabel("Occupied")}</span><span><i style="background:var(--bad)"></i>${tt("Terisi, ada tunggakan", "Occupied, overdue")}</span><span><i style="background:var(--vacant)"></i>${roomLabel("Vacant")}</span><span><i style="background:var(--ok-soft);box-shadow:inset 0 0 0 1px var(--ok)"></i>${roomLabel("Reserved")}</span><span><i style="background:var(--mnt)"></i>${roomLabel("Maintenance")}</span>
          <span><i class="lg-prem"></i>Premium</span><span><i class="lg-exp"></i>Expensive</span></div>
        <div class="floor-map">${[4, 3, 2, 1].map((fl) => `<div class="floor"><span>${FL} ${fl}</span><div class="rooms">${KOS.D.rooms.filter((r) => r.block === f.block && r.floor === fl).map((r) => `<button class="room ${cls(r)}" data-room="${r.id}" style="${shown.has(r.id) ? "" : "opacity:.18"}" title="${r.id} · ${r.type} · ${roomLabel(r.status)}${r.tenantId ? " · " + esc(KOS.IX.tenant[r.tenantId].name) : ""}">${String(r.no).padStart(2, "0")}</button>`).join("")}</div></div>`).join("")}</div>
        <p class="muted" style="font-size:12.5px">${tt(`${list.length} dari 100 kamar di Blok ${f.block} sesuai filter. Kamar yang pudar tidak sesuai.`, `${list.length} of 100 rooms in Block ${f.block} match the filters. Faded rooms don't.`)}</p></div>`;
    } else {
      const per = 50, page = list.slice(f.page * per, f.page * per + per);
      body = `<div class="table-wrap"><table class="t"><thead><tr><th>${tt("Kamar", "Room")}</th><th>${tt("Kelas", "Class")}</th><th>${tt("Blok / lantai", "Block / floor")}</th><th class="r">${tt("Sewa / bulan", "Rent / month")}</th><th>Status</th><th>${tt("Penghuni", "Tenant")}</th><th>${tt("Sejak", "Since")}</th><th>${tt("Tagihan", "Bill")} ${KOS.monthLabel(cur, true)}</th></tr></thead><tbody>
        ${page.map((r) => { const t = r.tenantId ? KOS.IX.tenant[r.tenantId] : null; const bl = (KOS.IX.billsByRoom[r.id] || []).find((b) => b.month === cur && (!t || b.tenantId === t.id)); const bs = bl ? KOS.status(bl) : null;
          return `<tr class="click" data-room="${r.id}"><td class="mono"><b>${r.id}</b></td><td>${typeChip(r.type)}</td><td>${B} ${r.block} · ${r.floor}</td><td class="r num">${idr(r.rent || KOS.RENT)}</td><td><span class="pill ${KOS.ROOM_PILL[r.status]}">${roomLabel(r.status)}</span></td><td>${t ? esc(t.name) : '<span class="muted">—</span>'}</td><td class="num">${t ? tgl(t.checkIn) : ""}</td><td>${bs ? statusPill(bs) : '<span class="muted">—</span>'}</td></tr>`; }).join("")}
      </tbody></table></div>${this.pager("rooms", list.length, per)}`;
    }
    const occByType = (t) => KOS.D.rooms.filter((r) => r.type === t && r.status === "Occupied").length;
    return `
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">${roomLabel("Occupied")}</span><span class="k-val num">${nf(cnt("Occupied"))}</span><span class="k-sub">${tt("kamar yang berpenghuni", "rooms with a tenant")}</span></div>
      <div class="panel kpi"><span class="k-label">${roomLabel("Vacant")}</span><span class="k-val num">${nf(cnt("Vacant"))}</span><span class="k-sub">${tt(`tersedia dengan ${idr(KOS.RENT)}/bulan`, `available at ${idr(KOS.RENT)}/month`)}</span></div>
      <div class="panel kpi"><span class="k-label">${roomLabel("Reserved")}</span><span class="k-val num">${nf(cnt("Reserved"))}</span><span class="k-sub">${tt("menunggu penghuni masuk", "waiting for move-in")}</span></div>
      <div class="panel kpi"><span class="k-label">${roomLabel("Maintenance")}</span><span class="k-val num">${nf(cnt("Maintenance"))}</span><span class="k-sub">${tt("belum bisa disewakan", "not rentable right now")}</span></div>
    </div>
    <div class="class-row" aria-label="${tt("Kelas kamar", "Room classes")}">${typeCount(KOS.D.rooms).map(([t, n]) => `<button class="class-card ${f.type === t ? "on" : ""}" data-rtype="${f.type === t ? "" : t}" title="${f.type === t ? tt("Tampilkan semua kelas", "Show all classes") : tt(`Tampilkan hanya ${t}`, `Show only ${t}`)}">${typeChip(t)}<b class="num">${nf(n)}</b><span>${tt("kamar", "rooms")} · ${nf(occByType(t))} ${tt("terisi", "occupied")}</span></button>`).join("")}</div>
    <div class="toolbar">
      <label class="search"><span class="sr">${tt("Cari kamar", "Search rooms")}</span>${ICON.search}<input class="input" id="kr-q" type="search" placeholder="${tt("Nomor kamar atau nama penghuni", "Room number or tenant name")}" value="${esc(f.q)}"></label>
      <label><span class="sr">${FL}</span><select class="select" id="kr-floor"><option value="">${tt("Semua lantai", "All floors")}</option>${[1, 2, 3, 4].map((x) => `<option value="${x}" ${+f.floor === x ? "selected" : ""}>${FL} ${x}</option>`).join("")}</select></label>
      <label><span class="sr">${tt("Kelas", "Class")}</span><select class="select" id="kr-type"><option value="">${tt("Semua kelas", "All classes")}</option>${KOS.TYPES.map((x) => `<option value="${x}" ${f.type === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label><span class="sr">Status</span><select class="select" id="kr-status"><option value="">${tt("Semua status", "Any status")}</option>${["Occupied", "Vacant", "Reserved", "Maintenance", "Overdue"].map((x) => `<option value="${x}" ${f.status === x ? "selected" : ""}>${x === "Overdue" ? tt("Ada tagihan terlambat", "Has overdue bill") : roomLabel(x)}</option>`).join("")}</select></label>
      <div class="seg" role="group" aria-label="${tt("Tampilan", "View")}"><button data-rmode="map" aria-pressed="${f.mode === "map"}">${tt("Denah", "Floor plan")}</button><button data-rmode="table" aria-pressed="${f.mode === "table"}">${tt("Tabel", "Table")}</button></div>
    </div>
    <div class="block-tabs">${f.mode === "table" ? `<button data-rblock="" aria-pressed="${!f.block}">${tt("Semua blok", "All blocks")}</button>` : ""}${KOS.BLOCKS.map((b) => `<button data-rblock="${b}" aria-pressed="${f.block === b}">${B} ${b}</button>`).join("")}</div>
    ${body}`;
  },

  /* ----- Tenants ----- */
  v_tenants() {
    const f = this.f.tenants, q = f.q.trim().toLowerCase();
    const list = KOS.D.tenants.filter((t) => (f.active === "" || t.active === (f.active === "1")) && (!q || t.name.toLowerCase().includes(q) || t.roomId.toLowerCase().includes(q) || t.phone.includes(q) || t.job.toLowerCase().includes(q)))
      .sort((a, b) => a.roomId.localeCompare(b.roomId, "en", { numeric: true }));
    const per = 50, page = list.slice(f.page * per, f.page * per + per);
    const cur = KOS.ym(new Date());
    return `<div class="toolbar">
      <label class="search"><span class="sr">${tt("Cari penghuni", "Search tenants")}</span>${ICON.search}<input class="input" id="kt-q" type="search" placeholder="${tt("Nama, kamar, telepon, atau pekerjaan", "Name, room, phone or occupation")}" value="${esc(f.q)}"></label>
      <label><span class="sr">${tt("Status hunian", "Tenancy")}</span><select class="select" id="kt-active"><option value="1" ${f.active === "1" ? "selected" : ""}>${tt("Penghuni aktif", "Current tenants")}</option><option value="0" ${f.active === "0" ? "selected" : ""}>${tt("Sudah keluar", "Moved out")}</option><option value="" ${f.active === "" ? "selected" : ""}>${tt("Semua penghuni", "All tenants")}</option></select></label>
      <button class="btn sm" data-act="csv-tenants">${ICON.download} ${tt("Ekspor CSV", "Export CSV")}</button>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>${tt("Penghuni", "Tenant")}</th><th>${tt("Kamar", "Room")}</th><th>${tt("Telepon", "Phone")}</th><th>${tt("Pekerjaan", "Occupation")}</th><th>${tt("Masuk", "Check-in")}</th><th>${tt("Jatuh tempo", "Due every")}</th><th class="r">Deposit</th><th>${tt("Tagihan", "Bill")} ${KOS.monthLabel(cur, true)}</th></tr></thead><tbody>
      ${page.map((t) => { const b = t.active ? (KOS.IX.billsByRoom[t.roomId] || []).find((x) => x.month === cur && x.tenantId === t.id) : null; const s = b ? KOS.status(b) : null;
        return `<tr class="click" data-room="${t.roomId}"><td><b>${esc(t.name)}</b> <span class="muted mono" style="font-size:11px">${t.id}</span></td><td class="mono">${t.roomId}</td><td class="num">${esc(t.phone)}</td><td>${esc(t.job)}</td><td class="num">${tgl(t.checkIn)}${t.checkOut ? ` → ${tgl(t.checkOut)}` : ""}</td><td class="num">${t.active ? tt(`tgl ${t.dueDay}`, `day ${t.dueDay}`) : "—"}</td><td class="r num">${t.deposit ? idr(t.deposit) : "—"}</td><td>${s ? statusPill(s) : t.active ? `<span class="muted">${tt("Belum ada tagihan", "No bill")}</span>` : `<span class="pill plain">${tt("Sudah keluar", "Moved out")}</span>`}</td></tr>`; }).join("") || `<tr><td colspan="8" class="muted" style="padding:24px">${tt("Tidak ada penghuni yang cocok dengan pencarian itu.", "No tenants match that search.")}</td></tr>`}
    </tbody></table></div>${this.pager("tenants", list.length, per)}`;
  },

  /* ----- Bills ----- */
  billsFiltered() {
    const f = this.f.bills; if (f.mo === null) f.mo = curMo(); if (f.year === null) f.year = curY();
    const q = f.q.trim().toLowerCase();
    return KOS.D.bills.filter((b) => (!f.year || b.month.slice(0, 4) === f.year) && (!f.mo || b.month.slice(5, 7) === f.mo) && (!f.block || b.roomId[0] === f.block) && (!f.status || KOS.status(b) === f.status) &&
      (!q || b.id.toLowerCase().includes(q) || b.roomId.toLowerCase().includes(q) || (KOS.IX.tenant[b.tenantId] || { name: "" }).name.toLowerCase().includes(q)))
      .sort((a, b) => b.month.localeCompare(a.month) || a.due.localeCompare(b.due) || a.roomId.localeCompare(b.roomId, "en", { numeric: true }));
  },
  v_bills() {
    const f = this.f.bills, ms = KOS.months(), curReal = KOS.ym(new Date());
    const list = this.billsFiltered();
    const per = 50, page = list.slice(f.page * per, f.page * per + per);
    const sm = KOS.sumBills(list);
    const next = KOS.addMonths(ms[0], 1);
    const period = f.mo && f.year ? KOS.monthLabel(`${f.year}-${f.mo}`) : f.year ? tt(`Sepanjang ${f.year}`, `All of ${f.year}`) : f.mo ? tt(`${KOS.MONTHS[+f.mo - 1]}, semua tahun`, `${KOS.MONTHS[+f.mo - 1]}, all years`) : tt("Semua tagihan", "All bills");
    return `
    ${ms[0] < curReal ? `<div class="panel card-pad" style="border-color:var(--accent)"><b>${tt(`Tagihan ${KOS.monthLabel(curReal)} belum dibuat.`, `${KOS.monthLabel(curReal)} bills haven't been generated yet.`)}</b><div><button class="btn primary sm" data-act="gen:${curReal}">${tt(`Buat tagihan ${KOS.monthLabel(curReal)}`, `Generate ${KOS.monthLabel(curReal)} bills`)}</button></div></div>` : ""}
    <div class="toolbar">
      <label class="search"><span class="sr">${tt("Cari tagihan", "Search bills")}</span>${ICON.search}<input class="input" id="kb-q" type="search" placeholder="${tt("Invoice, kamar, atau penghuni", "Invoice, room or tenant")}" value="${esc(f.q)}"></label>
      ${this.monthYearSelects("kb", f.mo, f.year, true)}
      <label><span class="sr">Status</span><select class="select" id="kb-status"><option value="">${tt("Semua status", "Any status")}</option>${KOS.STATUSES.map((x) => `<option value="${x}" ${f.status === x ? "selected" : ""}>${stLabel(x)}</option>`).join("")}</select></label>
      <label><span class="sr">${tt("Blok", "Block")}</span><select class="select" id="kb-block"><option value="">${tt("Semua blok", "All blocks")}</option>${KOS.BLOCKS.map((b) => `<option value="${b}" ${f.block === b ? "selected" : ""}>${tt("Blok", "Block")} ${b}</option>`).join("")}</select></label>
      <button class="btn sm" data-act="csv-bills">${ICON.download} CSV</button>
      <button class="btn sm" data-act="gen:${next}" title="${tt("Buat tagihan untuk semua kamar yang terisi", "Create bills for every occupied room")}">${tt(`Buat tagihan ${KOS.monthLabel(next)}`, `Generate ${KOS.monthLabel(next)} bills`)}</button>
    </div>
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">${tt("Tagihan", "Bills")} · ${esc(period)}</span><span class="k-val num">${nf(sm.count)}</span><span class="k-sub">${tt(`${idr(KOS.RENT)} per tagihan, tanpa biaya tambahan`, `${idr(KOS.RENT)} each, no extra fees`)}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Ditagihkan", "Billed")}</span><span class="k-val num">${idrShort(sm.billed)}</span><span class="k-sub">${idr(sm.billed)}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Terkumpul", "Collected")}</span><span class="k-val num">${idrShort(sm.collected)}</span><span class="k-sub">${pct(sm.rate)} ${tt("dari yang ditagihkan", "of billed")}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Belum dibayar", "Unpaid")}</span><span class="k-val num" style="color:${sm.outstanding ? "var(--bad)" : "inherit"}">${idrShort(sm.outstanding)}</span><span class="k-sub">${idr(sm.outstanding)}</span></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${KOS.STATUSES.map((s) => `<button class="pill ${KOS.STATUS_PILL[s]}" data-bstatus="${f.status === s ? "" : s}" style="border:0;cursor:pointer;${f.status && f.status !== s ? "opacity:.5" : ""}" title="${f.status === s ? tt("Tampilkan semua status", "Show all statuses") : tt("Tampilkan hanya ", "Show only ") + stLabel(s)}">${stLabel(s)} ${nf(sm.st[s])}</button>`).join("")}</div>
    <p class="muted wa-note">${WA_ICON}<span>${tt(`Tombol WhatsApp membuka pesan pengingat yang sudah terisi. Di demo ini pesan dikirim ke nomor pengelola ${waDisplay((adminData().profile || {}).whatsapp)}, bukan ke nomor penghuni contoh.`, `The WhatsApp button opens a pre-filled reminder. In this demo it goes to the manager's number ${waDisplay((adminData().profile || {}).whatsapp)}, not to the sample tenants.`)}</span></p>
    <div class="table-wrap"><table class="t"><thead><tr><th>Invoice</th><th>${tt("Kamar", "Room")}</th><th>${tt("Penghuni", "Tenant")}</th><th>${tt("Bulan", "Month")}</th><th>${tt("Jatuh tempo", "Due")}</th><th class="r">${tt("Jumlah", "Amount")}</th><th class="r">${tt("Sisa", "Balance")}</th><th>Status</th><th></th></tr></thead><tbody>
      ${page.map((b) => { const t = KOS.IX.tenant[b.tenantId] || {}; const s = KOS.status(b); const d = KOS.daysUntil(b.due);
        return `<tr><td class="mono">${b.id}</td><td><button class="btn ghost sm mono" style="padding:2px 4px" data-room="${b.roomId}">${b.roomId}</button></td><td>${esc(t.name || "")}</td><td>${KOS.monthLabel(b.month)}</td><td class="num">${tgl(b.due)}${s === "Due Soon" ? `<br><span class="muted" style="font-size:11.5px">${d === 0 ? tt("hari ini", "today") : tt(`${d} hari lagi`, `in ${d} day${d === 1 ? "" : "s"}`)}</span>` : ""}</td><td class="r num">${idr(KOS.total(b))}</td><td class="r num">${KOS.balance(b) ? idr(KOS.balance(b)) : "—"}</td><td>${statusPill(s)}</td>
        <td style="white-space:nowrap;text-align:right">${s !== "Paid" ? `<button class="btn sm" data-pay="${b.id}">${tt("Catat pembayaran", "Record payment")}</button> ` : ""}${s === "Overdue" || s === "Due Soon" ? phoneBtn(b) + waReminder(b) : ""}<button class="icon-btn" data-inv="${b.id}" title="${tt("Unduh PDF", "Download PDF")} ${s === "Paid" ? tt("kuitansi", "receipt") : "invoice"}" aria-label="${tt("Unduh PDF", "Download PDF")}">${ICON.download}</button></td></tr>`; }).join("") || `<tr><td colspan="9" class="muted" style="padding:24px">${tt("Tidak ada tagihan yang cocok dengan filter itu.", "No bills match those filters.")}</td></tr>`}
    </tbody></table></div>${this.pager("bills", list.length, per)}`;
  },

  /* ----- Transactions ----- */
  v_trx() {
    const f = this.f.trx, q = f.q.trim().toLowerCase();
    const list = KOS.D.trx.filter((t) => (!f.method || t.method === f.method) && (!f.year || t.date.slice(0, 4) === f.year) && (!f.mo || t.date.slice(5, 7) === f.mo) &&
      (!q || t.id.toLowerCase().includes(q) || t.roomId.toLowerCase().includes(q) || t.billId.toLowerCase().includes(q) || (KOS.IX.tenant[t.tenantId] || { name: "" }).name.toLowerCase().includes(q)));
    const per = 50, page = list.slice(f.page * per, f.page * per + per);
    const sum = list.reduce((a, t) => a + t.amount, 0);
    return `<div class="toolbar">
      <label class="search"><span class="sr">${tt("Cari transaksi", "Search transactions")}</span>${ICON.search}<input class="input" id="kx-q" type="search" placeholder="${tt("Transaksi, invoice, kamar, atau penghuni", "Transaction, invoice, room or tenant")}" value="${esc(f.q)}"></label>
      ${this.monthYearSelects("kx", f.mo, f.year, true)}
      <label><span class="sr">${tt("Metode", "Method")}</span><select class="select" id="kx-method"><option value="">${tt("Semua metode", "All methods")}</option>${KOS.METHODS.map((m) => `<option value="${m}" ${f.method === m ? "selected" : ""}>${KOS.methodLabel(m)}</option>`).join("")}</select></label>
      <button class="btn sm" data-act="csv-trx">${ICON.download} ${tt("Ekspor CSV", "Export CSV")}</button>
    </div>
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">${tt("Pembayaran", "Payments")}</span><span class="k-val num">${nf(list.length)}</span><span class="k-sub">${tt("sesuai filter", "matching the filters")}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Total diterima", "Total received")}</span><span class="k-val num">${idrShort(sum)}</span><span class="k-sub">${idr(sum)}</span></div>
    </div>
    ${this.trxTable(page)}${this.pager("trx", list.length, per)}`;
  },

  /* ----- Reports ----- */
  v_reports() {
    const r = this.f.rep; if (r.mo === null) r.mo = curMo(); if (r.year === null) r.year = curY();
    const m = `${r.year}-${r.mo}`;
    const s = KOS.summary(m);
    const B = tt("Blok", "Block");
    const sel = `<div class="toolbar">${this.monthYearSelects("krep", r.mo, r.year, false)}
      <button class="btn primary sm" data-act="pdf-report:${m}" ${s.count ? "" : "disabled"}>${ICON.download} ${tt("Unduh laporan PDF", "Download PDF report")}</button>
      <button class="btn sm" data-act="csv-report:${m}" ${s.count ? "" : "disabled"}>${ICON.download} CSV</button></div>`;
    if (!s.count) return sel + `<div class="empty"><h3>${tt(`Belum ada tagihan untuk ${KOS.monthLabel(m)}`, `No bills for ${KOS.monthLabel(m)}`)}</h3><p>${tt(`Pilih bulan antara ${KOS.monthLabel(KOS.months().slice(-1)[0])} dan ${KOS.monthLabel(KOS.months()[0])}, atau buat tagihan bulan baru dari menu Tagihan bulanan.`, `Pick a month between ${KOS.monthLabel(KOS.months().slice(-1)[0])} and ${KOS.monthLabel(KOS.months()[0])}, or generate bills for a new month from Monthly bills.`)}</p></div>`;
    const rows = KOS.BLOCKS.map((b) => ({ b, ...KOS.sumBills(KOS.D.bills.filter((x) => x.month === m && x.roomId[0] === b)) }));
    const floors = [1, 2, 3, 4].map((fl) => ({ fl, ...KOS.sumBills(KOS.D.bills.filter((x) => x.month === m && KOS.IX.room[x.roomId].floor === fl)) }));
    const maxB = Math.max(...rows.map((x) => x.billed)) || 1;
    return sel + `
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">${tt("Ditagihkan", "Billed")}</span><span class="k-val num">${idrShort(s.billed)}</span><span class="k-sub">${nf(s.count)} ${tt("tagihan", "bills")} × ${idr(KOS.RENT)}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Terkumpul", "Collected")}</span><span class="k-val num">${idrShort(s.collected)}</span><span class="k-sub">${tt(`tingkat penagihan ${pct(s.rate)}`, `${pct(s.rate)} collection rate`)}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Belum terbayar", "Outstanding")}</span><span class="k-val num">${idrShort(s.outstanding)}</span><span class="k-sub">${nf(s.st.Overdue)} ${tt("terlambat", "overdue")} · ${nf(s.st["Due Soon"])} ${tt("segera jatuh tempo", "due soon")} · ${nf(s.st.Unpaid + s.st.Partial)} ${tt("belum jatuh tempo", "not yet due")}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Total Terkumpul Tahun Ini", "Total Collected This Year")}</span><span class="k-val num">${idrShort(KOS.collectedInYear(r.year))}</span><span class="k-sub">${tt(`semua pembayaran di ${r.year}`, `all payments in ${r.year}`)}</span></div>
    </div>
    <div class="grid-2">
      <div class="panel card-pad"><div class="card-title"><h3>${tt("Pendapatan per blok", "Revenue by block")} · ${KOS.monthLabel(m)}</h3><div class="legend"><span><i style="background:var(--series-2)"></i>${tt("Ditagihkan", "Billed")}</span><span><i style="background:var(--accent)"></i>${tt("Terkumpul", "Collected")}</span></div></div>
        <div class="hbar-list">${rows.map((x) => `<div class="hbar" title="${B} ${x.b}: ${tt("ditagihkan", "billed")} ${idr(x.billed)}, ${tt("terkumpul", "collected")} ${idr(x.collected)}"><span class="mono" style="font-size:12px">${B} ${x.b}</span>
          <span style="display:grid;gap:2px"><span class="track" style="height:7px;background:none"><i style="width:${x.billed / maxB * 100}%;background:var(--series-2);border-radius:2px"></i></span><span class="track" style="height:7px;background:none"><i style="width:${x.collected / maxB * 100}%;background:var(--accent);border-radius:2px"></i></span></span>
          <span class="v">${x.billed ? (x.rate * 100).toFixed(0) : 0}%</span></div>`).join("")}</div></div>
      <div class="panel card-pad"><div class="card-title"><h3>${tt("Per lantai", "By floor")}</h3></div>
        <div class="table-wrap" style="border:0"><table class="t" style="min-width:0"><thead><tr><th>${tt("Lantai", "Floor")}</th><th class="r">${tt("Tagihan", "Bills")}</th><th class="r">${tt("Ditagihkan", "Billed")}</th><th class="r">${tt("Terkumpul", "Collected")}</th></tr></thead><tbody>
        ${floors.map((x) => `<tr><td>${tt("Lantai", "Floor")} ${x.fl}</td><td class="r num">${nf(x.count)}</td><td class="r num">${idrShort(x.billed)}</td><td class="r num">${idrShort(x.collected)}</td></tr>`).join("")}</tbody></table></div>
        <p class="muted" style="font-size:12.5px">${KOS.included()}</p></div>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>${B}</th><th class="r">${tt("Tagihan", "Bills")}</th><th class="r">${tt("Ditagihkan", "Billed")}</th><th class="r">${tt("Terkumpul", "Collected")}</th><th class="r">${tt("Belum terbayar", "Outstanding")}</th><th class="r">${tt("Terlambat", "Overdue")}</th><th class="r">${tt("Tingkat", "Rate")}</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td class="mono">${B} ${x.b}</td><td class="r num">${nf(x.count)}</td><td class="r num">${idr(x.billed)}</td><td class="r num">${idr(x.collected)}</td><td class="r num">${idr(x.outstanding)}</td><td class="r num">${nf(x.st.Overdue)}</td><td class="r num">${x.billed ? pct(x.rate) : pct(0)}</td></tr>`).join("")}
      <tr style="font-weight:700"><td>Total</td><td class="r num">${nf(s.count)}</td><td class="r num">${idr(s.billed)}</td><td class="r num">${idr(s.collected)}</td><td class="r num">${idr(s.outstanding)}</td><td class="r num">${nf(s.st.Overdue)}</td><td class="r num">${pct(s.rate)}</td></tr>
    </tbody></table></div>`;
  },

  /* ----- Room drawer & payment ----- */
  openRoom(id) {
    const r = KOS.IX.room[id]; if (!r) return;
    const t = r.tenantId ? KOS.IX.tenant[r.tenantId] : null;
    const bills = (KOS.IX.billsByRoom[id] || []).slice().sort((a, b) => b.month.localeCompare(a.month));
    const past = KOS.D.tenants.filter((x) => x.roomId === id && !x.active);
    const m = openModal({
      title: `${tt("Kamar", "Room")} ${r.id} <span class="pill ${KOS.ROOM_PILL[r.status]}" style="vertical-align:3px;margin-left:6px">${roomLabel(r.status)}</span>`, wide: true,
      body: `<div class="detail-grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
        <dl class="kv"><dt>${tt("Kelas", "Class")}</dt><dd>${typeChip(r.type)}</dd><dt>${tt("Blok / lantai", "Block / floor")}</dt><dd>${tt("Blok", "Block")} ${r.block} · ${tt("Lantai", "Floor")} ${r.floor}</dd><dt>${tt("Sewa", "Rent")}</dt><dd class="num">${idr(r.rent || KOS.RENT)} / ${tt("bulan", "month")}</dd><dt>${tt("Termasuk", "Included")}</dt><dd style="font-weight:500">${tt("Kebersihan, keamanan, perawatan", "Cleaning, security, maintenance")}</dd><dt>${tt("Listrik", "Electricity")}</dt><dd style="font-weight:500">${tt("Token prabayar penghuni (tidak ditagihkan)", "Tenant's prepaid token (not billed)")}</dd>
          ${t ? `<dt>${tt("Penghuni", "Tenant")}</dt><dd>${esc(t.name)}</dd><dt>${tt("Telepon", "Phone")}</dt><dd class="num">${esc(t.phone)}</dd><dt>${tt("Pekerjaan", "Occupation")}</dt><dd>${esc(t.job)}</dd><dt>${tt("Sejak", "Since")}</dt><dd class="num">${tgl(t.checkIn)}</dd><dt>${tt("Jatuh tempo", "Rent due")}</dt><dd>${tt(`Tanggal ${t.dueDay} setiap bulan`, `Day ${t.dueDay} of each month`)}</dd><dt>Deposit</dt><dd class="num">${idr(t.deposit)}</dd>` : ""}</dl>
        <div style="display:grid;gap:10px;align-content:start">
          ${t ? `<button class="btn" data-act="checkout:${r.id}">${tt("Proses penghuni keluar", "Check out tenant")}</button>` : r.status !== "Maintenance" ? `<div id="ci-form" style="display:grid;gap:8px"><b>${tt("Daftarkan penghuni baru", "Check in a new tenant")}</b>
            <input class="input" id="ci-name" placeholder="${tt("Nama lengkap", "Full name")}"><input class="input" id="ci-phone" placeholder="${tt("Telepon, mis. 0812-3456-7890", "Phone, e.g. 0812-3456-7890")}" inputmode="tel">
            <input class="input" id="ci-job" placeholder="${tt("Pekerjaan", "Occupation")}"><label class="field"><span>${tt("Tanggal masuk (sewa jatuh tempo di tanggal ini setiap bulan)", "Move-in date (rent is due on this day each month)")}</span><input class="input" id="ci-date" type="date" value="${KOS.today()}"></label>
            <button class="btn primary" data-act="checkin:${r.id}">${tt(`Daftarkan dan tagih ${idr(KOS.RENT)}`, `Check in and bill ${idr(KOS.RENT)}`)}</button><p class="muted" id="ci-err" hidden style="color:var(--bad)"></p></div>` : ""}
          ${!t ? `<button class="btn sm" data-act="mnt:${r.id}">${r.status === "Maintenance" ? tt("Perbaikan selesai (jadikan kosong)", "Mark repairs done (vacant)") : tt("Tandai sedang diperbaiki", "Mark under maintenance")}</button>` : ""}
        </div></div>
        <div><b style="font-size:14px">${tt("Riwayat tagihan", "Billing history")}</b>
        <div class="table-wrap" style="margin-top:8px"><table class="t" style="min-width:560px"><thead><tr><th>${tt("Bulan", "Month")}</th><th>Invoice</th><th>${tt("Jatuh tempo", "Due")}</th><th class="r">${tt("Jumlah", "Amount")}</th><th class="r">${tt("Sisa", "Balance")}</th><th>Status</th><th></th></tr></thead><tbody>
        ${bills.map((b) => { const s = KOS.status(b); return `<tr><td>${KOS.monthLabel(b.month)}</td><td class="mono">${b.id}</td><td class="num">${tgl(b.due)}</td><td class="r num">${idr(KOS.total(b))}</td><td class="r num">${KOS.balance(b) ? idr(KOS.balance(b)) : "—"}</td><td>${statusPill(s)}</td><td style="text-align:right;white-space:nowrap">${s !== "Paid" ? `<button class="btn sm" data-pay="${b.id}">${tt("Catat", "Record")}</button>${phoneBtn(b)}${waReminder(b)}` : ""}<button class="icon-btn" data-inv="${b.id}" aria-label="${tt("Unduh PDF", "Download PDF")}">${ICON.download}</button></td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">${tt("Belum ada tagihan untuk kamar ini.", "No bills for this room yet.")}</td></tr>`}
        </tbody></table></div></div>
        ${past.length ? `<p class="muted" style="font-size:13px">${tt("Penghuni sebelumnya", "Previous tenants")}: ${past.map((p) => `${esc(p.name)} (${tgl(p.checkIn)} → ${tgl(p.checkOut)})`).join(", ")}</p>` : ""}`,
    });
    m.addEventListener("click", (e) => this.onClick(e, m));
  },
  /* What the tenant sees: the reminder arriving on their phone in WhatsApp (simulation). */
  openPhone(id) {
    const b = KOS.IX.bill[id]; if (!b) return;
    const t = KOS.IX.tenant[b.tenantId] || {}, r = KOS.IX.room[b.roomId] || {};
    const d = KOS.daysUntil(b.due), s = KOS.status(b);
    const tag = d < 0 ? `H+${-d}` : d === 0 ? "H" : `H-${d}`;
    const now = new Date(), hhmm = `${String(now.getHours()).padStart(2, "0")}.${String(now.getMinutes()).padStart(2, "0")}`;
    const msg = reminderText(b);
    const m = openModal({
      title: `${tt("Tampilan di HP penghuni", "On the tenant's phone")} · ${b.roomId} <span class="pill ${KOS.STATUS_PILL[s]}" style="vertical-align:3px;margin-left:6px">${tag} · ${stLabel(s)}</span>`, wide: true,
      body: `<div class="tp-wrap">
        <div class="tp-phone" role="img" aria-label="${tt("Simulasi layar HP penghuni yang menerima pengingat WhatsApp", "Simulated tenant phone receiving a WhatsApp reminder")}">
          <div class="tp-screen">
            <div class="tp-status"><b>${hhmm}</b><span class="tp-notch"></span><span class="tp-icons">▂▄▆ 4G ▮</span></div>
            <div class="tp-notif"><span class="tp-wa">${WA_ICON}</span><div><b>${PROPERTY.name}</b><span>${esc(msg.slice(0, 64))}…</span></div><small>${tt("sekarang", "now")}</small></div>
            <div class="tp-head"><span class="tp-back">‹</span><span class="tp-avatar">GK</span><div><b>${PROPERTY.name} <i title="${tt("Akun bisnis", "Business account")}">✔</i></b><small>${tt("Akun bisnis · online", "Business account · online")}</small></div></div>
            <div class="tp-chat">
              <div class="tp-day">${tt("Hari ini", "Today")}</div>
              <div class="tp-msg">${esc(msg)}<time>${hhmm}</time></div>
              <div class="tp-msg tp-card">
                <div class="tp-card-head"><b>${tt("Rincian tagihan", "Bill details")}</b><span class="tp-chip">${tag}</span></div>
                <dl><dt>Invoice</dt><dd class="mono">${b.id}</dd><dt>${tt("Kamar", "Room")}</dt><dd>${b.roomId} · ${r.type || "Regular"}</dd><dt>${tt("Bulan", "Month")}</dt><dd>${KOS.monthLabel(b.month)}</dd><dt>${tt("Jatuh tempo", "Due")}</dt><dd>${tgl(b.due)}</dd><dt>${tt("Sisa tagihan", "Balance")}</dt><dd><b>${idr(KOS.balance(b))}</b></dd></dl>
                <p>${tt("Bayar lewat QRIS atau transfer BCA / Mandiri / BRI, lalu kirim bukti bayar di chat ini.", "Pay with QRIS or a BCA / Mandiri / BRI transfer, then send the receipt in this chat.")}</p>
                <time>${hhmm}</time>
              </div>
            </div>
            <div class="tp-input"><span>${tt("Ketik pesan", "Message")}</span><i>➤</i></div>
          </div>
        </div>
        <div class="tp-side">
          <h4>${tt("Yang dialami penghuni", "What the tenant sees")}</h4>
          <ol class="tp-steps">
            <li>${tt(`Notifikasi WhatsApp masuk saat tagihan ${d >= 0 ? `tinggal ${d} hari lagi` : `terlambat ${-d} hari`}.`, `A WhatsApp notification arrives ${d >= 0 ? `${d} day${d === 1 ? "" : "s"} before the due date` : `${-d} day${d === -1 ? "" : "s"} after the due date`}.`)}</li>
            <li>${tt("Pesan berisi nama, kamar, bulan, sisa tagihan, dan tanggal jatuh tempo.", "The message has the name, room, month, balance and due date.")}</li>
            <li>${tt("Rincian tagihan dan cara bayar ada di pesan berikutnya.", "Bill details and how to pay follow in the next message.")}</li>
          </ol>
          <dl class="kv"><dt>${tt("Penghuni", "Tenant")}</dt><dd>${esc(t.name || "—")}</dd><dt>${tt("Masuk", "Moved in")}</dt><dd>${tgl(t.checkIn)}</dd><dt>${tt("Jatuh tempo", "Due")}</dt><dd>${tt(`tgl ${t.dueDay} setiap bulan`, `day ${t.dueDay} of each month`)}</dd></dl>
          <p class="muted" style="font-size:12.5px">${tt(`Simulasi. Tombol di bawah membuka pesan yang sama di WhatsApp ke nomor pengelola ${waDisplay((adminData().profile || {}).whatsapp)}, bukan ke nomor penghuni contoh.`, `Simulation. The button below opens the same message in WhatsApp to the manager's number ${waDisplay((adminData().profile || {}).whatsapp)}, not the sample tenant's number.`)}</p>
        </div>
      </div>`,
      foot: `<button class="btn" data-close>${tt("Tutup", "Close")}</button>${s !== "Paid" ? `<button class="btn" id="tp-pay">${tt("Catat pembayaran", "Record payment")}</button>` : ""}<a class="btn wa" href="${esc(waHref(msg))}" target="_blank" rel="noopener">${WA_ICON} ${tt("Kirim via WhatsApp", "Send via WhatsApp")}</a>`,
    });
    const pay = m.querySelector("#tp-pay"); if (pay) pay.onclick = () => { closeModal(); this.openPay(b.id); };
    requestAnimationFrame(() => { m.scrollTop = 0; });
  },
  openPay(id) {
    const b = KOS.IX.bill[id]; if (!b) return;
    const t = KOS.IX.tenant[b.tenantId] || {};
    const bal = KOS.balance(b);
    const m = openModal({
      title: `${tt("Catat pembayaran", "Record payment")} · ${b.roomId}`,
      body: `<p>${esc(t.name || "")} · ${KOS.monthLabel(b.month)} · ${tt("jatuh tempo", "due")} ${tgl(b.due)}</p>
        <dl class="kv"><dt>${tt("Sewa kamar", "Room rent")}</dt><dd class="num">${idr(b.rent)}</dd><dt>${tt("Sudah dibayar", "Already paid")}</dt><dd class="num">${idr(b.paid)}</dd><dt>${tt("Sisa tagihan", "Balance")}</dt><dd class="num">${idr(bal)}</dd></dl>
        <p class="muted" style="font-size:12.5px">${KOS.included()} ${tt("Tidak ada biaya lain yang ditambahkan.", "No other fees are added.")}</p>
        <div class="form-grid">
          <label class="field"><span>${tt("Jumlah (Rp)", "Amount (Rp)")}</span><input class="input num" id="py-amt" type="number" min="1000" max="${bal}" step="1000" value="${bal}"></label>
          <label class="field"><span>${tt("Tanggal bayar", "Paid on")}</span><input class="input" id="py-date" type="date" value="${KOS.today()}" max="${KOS.today()}"></label>
          <label class="field full"><span>${tt("Metode", "Method")}</span><select class="select" id="py-method">${KOS.METHODS.map((x) => `<option value="${x}">${KOS.methodLabel(x)}</option>`).join("")}</select></label>
        </div><p class="muted" id="py-err" hidden style="color:var(--bad)"></p>`,
      foot: `<button class="btn" data-close>${tt("Batal", "Cancel")}</button><button class="btn primary" id="py-save">${tt("Simpan pembayaran", "Save payment")}</button>`,
    });
    m.querySelector("#py-save").onclick = () => {
      const amt = Math.round(+m.querySelector("#py-amt").value), date = m.querySelector("#py-date").value, method = m.querySelector("#py-method").value;
      const err = m.querySelector("#py-err"); const say = (x) => { err.textContent = x; err.hidden = false; };
      if (!(amt > 0)) return say(tt("Masukkan jumlah lebih dari nol.", "Enter an amount above zero."));
      if (amt > bal) return say(tt(`Sisa tagihan ${idr(bal)}. Masukkan jumlah itu atau kurang.`, `The balance is ${idr(bal)}. Enter that amount or less.`));
      if (!date) return say(tt("Pilih tanggal pembayaran.", "Choose the payment date."));
      if (date > KOS.today()) return say(tt("Tanggal pembayaran tidak boleh di masa depan.", "The payment date can't be in the future."));
      const tx = KOS.recordPayment(b, amt, method, date);
      closeModal(); this.render(); toast(tt(`${tx.id} tersimpan · ${idr(amt)} · status ${b.roomId} kini ${stLabel(KOS.status(b)).toLowerCase()}`, `${tx.id} saved · ${idr(amt)} · ${b.roomId} is now ${stLabel(KOS.status(b)).toLowerCase()}`));
    };
  },
  onClick(e, scope) {
    const d = (k) => e.target.closest(`[data-${k}]`);
    let x;
    if ((x = d("kv"))) return this.setView(x.dataset.kv);
    if ((x = d("pay"))) { e.stopPropagation(); return this.openPay(x.dataset.pay); }
    if ((x = d("phone"))) { e.stopPropagation(); return this.openPhone(x.dataset.phone); }
    if ((x = d("inv"))) { e.stopPropagation(); toast(tt("Menyiapkan PDF…", "Preparing PDF…"), 1500); return pdfInvoice(KOS.IX.bill[x.dataset.inv]); }
    if (e.target.closest(".wa-ic")) return;
    if ((x = d("room"))) { if (scope) return; return this.openRoom(x.dataset.room); }
    if ((x = d("goblock"))) { Object.assign(this.f.rooms, { block: x.dataset.goblock, mode: "map" }); return this.setView("rooms"); }
    if ((x = d("bstatus"))) { this.f.bills.status = x.dataset.bstatus; this.f.bills.page = 0; return this.render(); }
    if ((x = d("rtype"))) { this.f.rooms.type = x.dataset.rtype; this.f.rooms.page = 0; return this.render(); }
    if ((x = d("rmode"))) { this.f.rooms.mode = x.dataset.rmode; this.f.rooms.page = 0; if (x.dataset.rmode === "map" && !this.f.rooms.block) this.f.rooms.block = "A"; return this.render(); }
    if ((x = d("rblock"))) { this.f.rooms.block = x.dataset.rblock; this.f.rooms.page = 0; return this.render(); }
    if ((x = d("pager"))) { const [k, dir] = x.dataset.pager.split(":"); this.f[k].page += +dir; this.render(); const t = $(".table-wrap"); if (t) t.scrollIntoView({ block: "start" }); return; }
    if ((x = d("act"))) {
      const [a, arg] = x.dataset.act.split(/:(.*)/);
      if (a === "reset-demo") {
        openModal({ title: tt("Atur ulang data demo?", "Reset demo data?"), body: `<p>${tt("Semua pembayaran, pendaftaran penghuni, dan perubahan lain yang Anda buat akan dihapus, lalu 1.000 kamar contoh dibuat ulang.", "This clears payments, check-ins and other changes you made, and regenerates the 1,000-room sample.")}</p>`, foot: `<button class="btn" data-close>${tt("Batal", "Cancel")}</button><button class="btn danger" id="rs-yes">${tt("Atur ulang", "Reset")}</button>`,
          onMount: (mm) => mm.querySelector("#rs-yes").onclick = () => { KOS.reset(); closeModal(); this.render(); toast(tt("Data demo sudah diatur ulang.", "Demo data reset.")); } });
      }
      if (a === "bills-overdue") { Object.assign(this.f.bills, { status: "Overdue", mo: "", year: "", page: 0 }); this.setView("bills"); }
      if (a === "gen") { const n = KOS.generateMonth(arg); Object.assign(this.f.bills, { mo: arg.slice(5, 7), year: arg.slice(0, 4), page: 0 }); this.render(); toast(n ? tt(`${nf(n)} tagihan dibuat untuk ${KOS.monthLabel(arg)}.`, `${nf(n)} bills created for ${KOS.monthLabel(arg)}.`) : tt(`Tagihan ${KOS.monthLabel(arg)} sudah ada.`, `${KOS.monthLabel(arg)} bills already exist.`)); }
      if (a === "checkout") { KOS.checkOut(KOS.IX.room[arg]); closeModal(); this.render(); toast(tt(`Kamar ${arg} sekarang kosong.`, `Room ${arg} is now vacant.`)); }
      if (a === "mnt") { const r = KOS.IX.room[arg]; KOS.setRoomStatus(r, r.status === "Maintenance" ? "Vacant" : "Maintenance"); closeModal(); this.render(); this.openRoom(arg); }
      if (a === "checkin") {
        const s = scope || document; const v = (q) => s.querySelector(q).value.trim();
        const err = s.querySelector("#ci-err");
        if (!v("#ci-name")) { err.textContent = tt("Masukkan nama penghuni.", "Enter the tenant's name."); err.hidden = false; return; }
        const ten = KOS.checkIn(KOS.IX.room[arg], { name: v("#ci-name"), phone: v("#ci-phone") || "—", job: v("#ci-job") || "—", date: v("#ci-date") || KOS.today() });
        closeModal(); this.render(); this.openRoom(arg); toast(tt(`${ten.name} terdaftar di kamar ${arg}.`, `${ten.name} checked in to ${arg}.`));
      }
      if (a === "pdf-report") { toast(tt("Menyiapkan PDF…", "Preparing PDF…"), 1500); pdfReport(arg); }
      if (a === "csv-tenants") { const rows = [[tt("ID Penghuni", "Tenant ID"), tt("Nama", "Name"), tt("Kamar", "Room"), tt("Kelas kamar", "Room class"), tt("Telepon", "Phone"), tt("Pekerjaan", "Occupation"), tt("Tanggal masuk", "Check-in"), tt("Tanggal keluar", "Check-out"), tt("Tanggal jatuh tempo", "Due day"), "Deposit"]].concat(KOS.D.tenants.map((t) => [t.id, t.name, t.roomId, (KOS.IX.room[t.roomId] || {}).type, t.phone, t.job, t.checkIn, t.checkOut || "", t.dueDay, t.deposit])); saveFile(`kostbills-${tt("penghuni", "tenants")}.csv`, csvOf(rows)); }
      if (a === "csv-bills") { const f = this.f.bills; const rows = [["Invoice", tt("Kamar", "Room"), tt("Kelas kamar", "Room class"), tt("Penghuni", "Tenant"), tt("Bulan", "Month"), tt("Jatuh tempo", "Due"), tt("Sewa", "Rent"), tt("Dibayar", "Paid"), tt("Sisa", "Balance"), "Status"]].concat(this.billsFiltered().map((b) => [b.id, b.roomId, (KOS.IX.room[b.roomId] || {}).type, (KOS.IX.tenant[b.tenantId] || {}).name, b.month, b.due, b.rent, b.paid, KOS.balance(b), stLabel(KOS.status(b))])); saveFile(`kostbills-${tt("tagihan", "bills")}-${f.year || tt("semua", "all")}-${f.mo || tt("semua", "all")}.csv`, csvOf(rows)); }
      if (a === "csv-trx") { const rows = [[tt("Transaksi", "Transaction"), tt("Tanggal", "Date"), "Invoice", tt("Kamar", "Room"), tt("Penghuni", "Tenant"), tt("Metode", "Method"), tt("Jumlah", "Amount")]].concat(KOS.D.trx.map((t) => [t.id, t.date, t.billId, t.roomId, (KOS.IX.tenant[t.tenantId] || {}).name, KOS.methodLabel(t.method), t.amount])); saveFile(`kostbills-${tt("transaksi", "transactions")}.csv`, csvOf(rows)); }
      if (a === "csv-report") { const rows = [[tt("Blok", "Block"), tt("Tagihan", "Bills"), tt("Ditagihkan", "Billed"), tt("Terkumpul", "Collected"), tt("Belum terbayar", "Outstanding"), tt("Terlambat", "Overdue")]]; KOS.BLOCKS.forEach((b) => { const r = KOS.sumBills(KOS.D.bills.filter((x) => x.month === arg && x.roomId[0] === b)); rows.push([b, r.count, r.billed, r.collected, r.outstanding, r.st.Overdue]); }); saveFile(`kostbills-${tt("laporan", "report")}-${arg}.csv`, csvOf(rows)); }
    }
  },
};
// filter inputs (delegated once; elements are re-rendered)
document.addEventListener("input", (e) => {
  const id = e.target.id, K = PAGES["kos-demo"]; if (!id || !/^k[rtbx]-q$/.test(id)) return;
  const map = { "kr-q": "rooms", "kt-q": "tenants", "kb-q": "bills", "kx-q": "trx" };
  K.f[map[id]].q = e.target.value; K.f[map[id]].page = 0;
  clearTimeout(K._qt); K._qt = setTimeout(() => { const pos = e.target.selectionStart; K.render(); const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (er) {} } }, 160);
});
document.addEventListener("change", (e) => {
  const id = e.target.id, K = PAGES["kos-demo"], v = e.target.value;
  const map = { "kr-floor": ["rooms", "floor"], "kr-type": ["rooms", "type"], "kr-status": ["rooms", "status"], "kt-active": ["tenants", "active"], "kb-mo": ["bills", "mo"], "kb-year": ["bills", "year"], "kb-status": ["bills", "status"], "kb-block": ["bills", "block"], "kx-method": ["trx", "method"], "kx-mo": ["trx", "mo"], "kx-year": ["trx", "year"], "krep-mo": ["rep", "mo"], "krep-year": ["rep", "year"] };
  if (!map[id]) return;
  const [g, k] = map[id]; K.f[g][k] = v; if ("page" in K.f[g]) K.f[g].page = 0; K.render();
});
