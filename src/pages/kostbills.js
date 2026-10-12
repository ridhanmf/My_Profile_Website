/* ===== KostBills demo (#kos-demo): dashboard UI, PDF and CSV exports ===== */
/* ---------- Display helpers (Bahasa Indonesia) ---------- */
const nf = (n) => Number(n || 0).toLocaleString("id-ID");
const pct = (r) => (r * 100).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
const tgl = (s) => { if (!s) return ""; const [y, m, d] = s.split("-"); return `${+d} ${KOS.MONTHS[+m - 1].slice(0, 3)} ${y}`; };
const stLabel = (s) => KOS.STATUS_LABEL[s] || s;
const roomLabel = (s) => KOS.ROOM_LABEL[s] || s;
const statusPill = (s) => `<span class="pill ${KOS.STATUS_PILL[s]}">${stLabel(s)}</span>`;
const dueText = (d) => (d < 0 ? `terlambat ${-d} hari` : d === 0 ? "jatuh tempo hari ini" : `jatuh tempo ${d} hari lagi`);

/* WhatsApp reminder. In this demo it goes to the property manager's number (the profile number),
   never to the generated tenants' phone numbers, which are fictional. */
function reminderText(b) {
  const t = KOS.IX.tenant[b.tenantId] || {}, d = KOS.daysUntil(b.due);
  return `Halo ${t.name || "Bapak/Ibu"}, ini pengingat dari ${PROPERTY.name}. Tagihan sewa kamar ${b.roomId} untuk ${KOS.monthLabel(b.month)} sebesar ${idr(KOS.balance(b))} ${d < 0 ? `sudah lewat jatuh tempo sejak ${tgl(b.due)}` : `jatuh tempo pada ${tgl(b.due)}`}. Mohon segera melakukan pembayaran. Terima kasih.`;
}
const waReminder = (b, cls = "icon-btn wa-ic") => `<a class="${cls}" href="${esc(waHref(reminderText(b)))}" target="_blank" rel="noopener" title="Kirim pengingat WhatsApp" aria-label="Kirim pengingat WhatsApp untuk ${b.roomId}">${WA_ICON}${cls.includes("btn sm") ? " Pengingat WA" : ""}</a>`;

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
const PROPERTY = { name: "Griya Kos Sejahtera", addr: "KostBills · 10 blok · 1.000 kamar · properti demo" };
async function pdfInvoice(bill) {
  let lib; try { lib = await loadJsPDF(); } catch (e) { toast("Alat PDF gagal dimuat. Periksa koneksi internet Anda."); return; }
  const { jsPDF } = lib; const doc = new jsPDF({ unit: "mm", format: "a4" });
  const room = KOS.IX.room[bill.roomId], ten = KOS.IX.tenant[bill.tenantId] || {};
  const st = KOS.status(bill), tot = KOS.total(bill), pays = KOS.IX.trxByBill[bill.id] || [];
  doc.setFillColor(31, 79, 216); doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(PROPERTY.name.toUpperCase(), 16, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(PROPERTY.addr, 16, 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(st === "Paid" ? "KUITANSI" : "INVOICE", 194, 16, { align: "right" });
  doc.setTextColor(20); doc.setFontSize(10);
  const L = (k, v, x, y) => { doc.setFont("helvetica", "normal"); doc.setTextColor(110); doc.text(k, x, y); doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.text(String(v), x, y + 5); };
  L("No. invoice", bill.id, 16, 42); L("Bulan tagihan", KOS.monthLabel(bill.month), 70, 42); L("Diterbitkan", tgl(bill.issued), 124, 42); L("Jatuh tempo", tgl(bill.due), 164, 42);
  L("Penghuni", ten.name || "—", 16, 58); L("Kamar", `${room.id} · Blok ${room.block}, lantai ${room.floor}`, 70, 58); L("Telepon", ten.phone || "—", 124, 58); L("Status", stLabel(st), 164, 58);
  let y = 78;
  doc.setDrawColor(215); doc.setFillColor(244, 246, 249); doc.rect(16, y - 6, 178, 9, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(90); doc.text("KETERANGAN", 19, y); doc.text("JUMLAH", 191, y, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setTextColor(20); doc.setFontSize(10);
  y += 10; doc.text(`Sewa kamar, ${KOS.monthLabel(bill.month)}`, 19, y); doc.text(idr(bill.rent), 191, y, { align: "right" });
  y += 5; doc.setFontSize(8.5); doc.setTextColor(110); doc.text(KOS.INCLUDED, 19, y, { maxWidth: 140 }); doc.setTextColor(20); doc.setFontSize(10);
  y += 8; doc.line(16, y, 194, y);
  y += 9; doc.setFont("helvetica", "bold"); doc.text("Total", 130, y); doc.text(idr(tot), 191, y, { align: "right" });
  y += 7; doc.setFont("helvetica", "normal"); doc.text("Dibayar", 130, y); doc.text(idr(Math.min(bill.paid, tot)), 191, y, { align: "right" });
  y += 7; doc.setFont("helvetica", "bold"); doc.setTextColor(st === "Paid" ? 23 : 194, st === "Paid" ? 128 : 43, st === "Paid" ? 61 : 43); doc.text("Sisa tagihan", 130, y); doc.text(idr(KOS.balance(bill)), 191, y, { align: "right" });
  doc.setTextColor(20);
  if (pays.length) {
    y += 16; doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Pembayaran", 16, y); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    pays.forEach((p) => { y += 6; doc.text(`${tgl(p.date)}   ${p.id}   ${KOS.methodLabel(p.method)}`, 16, y); doc.text(idr(p.amount), 191, y, { align: "right" }); });
  }
  y += 16; doc.setFontSize(9); doc.setTextColor(110);
  doc.text(`Sewa jatuh tempo setiap tanggal ${(KOS.IX.tenant[bill.tenantId] || {}).dueDay || Number(bill.due.slice(8))}, sesuai tanggal masuk penghuni.`, 16, y);
  doc.text("Dokumen demo dari proyek portofolio KostBills. Nama dan nominal adalah data contoh.", 16, 285);
  await saveFile(`${bill.id}.pdf`, doc.output("blob"));
}
async function pdfReport(m) {
  let lib; try { lib = await loadJsPDF(); } catch (e) { toast("Alat PDF gagal dimuat. Periksa koneksi internet Anda."); return; }
  const { jsPDF } = lib; const doc = new jsPDF({ unit: "mm", format: "a4" });
  const s = KOS.summary(m);
  doc.setFillColor(17, 24, 33); doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("KOSTBILLS · LAPORAN PENDAPATAN BULANAN", 16, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`${PROPERTY.name} · ${KOS.monthLabel(m)} · dicetak ${tgl(KOS.today())}`, 16, 19);
  doc.setTextColor(20);
  const occ = KOS.D.rooms.filter((r) => r.status === "Occupied").length;
  const tiles = [["Ditagihkan", idr(s.billed)], ["Terkumpul", idr(s.collected)], ["Belum terbayar", idr(s.outstanding)], ["Tingkat penagihan", pct(s.rate)], ["Tagihan terbit", nf(s.count)], ["Hunian", `${nf(occ)} / 1.000`]];
  tiles.forEach(([k, v], i) => { const x = 16 + (i % 3) * 60, y = 38 + Math.floor(i / 3) * 18; doc.setFontSize(9); doc.setTextColor(110); doc.text(k, x, y); doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(String(v), x, y + 6); doc.setFont("helvetica", "normal"); });
  doc.setFontSize(8.5); doc.setTextColor(110); doc.text(`Sewa ${idr(KOS.RENT)} per kamar per bulan. ${KOS.INCLUDED}`, 16, 76, { maxWidth: 178 }); doc.setTextColor(20);
  let y = 92;
  const head = (cols, xs) => { doc.setFillColor(244, 246, 249); doc.rect(16, y - 5, 178, 8, "F"); doc.setFontSize(8.5); doc.setTextColor(90); doc.setFont("helvetica", "bold"); cols.forEach((c, i) => doc.text(c, xs[i], y, { align: i ? "right" : "left" })); doc.setFont("helvetica", "normal"); doc.setTextColor(20); doc.setFontSize(9.5); };
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Per blok", 16, y - 8);
  const xs = [19, 70, 105, 140, 165, 191];
  head(["Blok", "Terisi", "Ditagihkan", "Terkumpul", "Terlambat", "Tingkat"], xs);
  KOS.BLOCKS.forEach((b) => {
    const r = KOS.sumBills(KOS.D.bills.filter((x) => x.month === m && x.roomId[0] === b));
    const oc = KOS.D.rooms.filter((x) => x.block === b && x.status === "Occupied").length;
    y += 7.5; [`Blok ${b}`, `${oc} / 100`, idrShort(r.billed), idrShort(r.collected), String(r.st.Overdue), r.billed ? pct(r.rate) : "—"].forEach((v, i) => doc.text(v, xs[i], y, { align: i ? "right" : "left" }));
  });
  y += 16; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Status tagihan", 16, y - 8);
  head(["Status", "Tagihan", "", "", "", "Porsi"], xs);
  Object.entries(s.st).forEach(([k, v]) => { y += 7.5; doc.text(stLabel(k), 19, y); doc.text(String(v), 70, y, { align: "right" }); doc.text(s.count ? pct(v / s.count) : "—", 191, y, { align: "right" }); });
  const od = KOS.D.bills.filter((b) => b.month === m && KOS.status(b) === "Overdue").slice(0, 14);
  if (od.length) {
    y += 16; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(`Tagihan terlambat (${od.length}${od.length === 14 ? "+" : ""})`, 16, y - 8);
    head(["Kamar · penghuni", "", "", "", "Jatuh tempo", "Sisa"], xs);
    od.forEach((b) => { y += 7; if (y > 280) return; const t = KOS.IX.tenant[b.tenantId] || {}; doc.text(`${b.roomId} · ${t.name || ""}`, 19, y); doc.text(tgl(b.due), 165, y, { align: "right" }); doc.text(idr(KOS.balance(b)), 191, y, { align: "right" }); });
  }
  doc.setFontSize(8); doc.setTextColor(120); doc.text("Laporan demo dari proyek portofolio KostBills. Semua angka adalah data contoh.", 16, 290);
  await saveFile(`kostbills-laporan-${m}.pdf`, doc.output("blob"));
}
function csvOf(rows) { return rows.map((r) => r.map((v) => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n"); }

/* ---------- Page ---------- */
const curY = () => KOS.today().slice(0, 4), curMo = () => KOS.today().slice(5, 7);
PAGES["kos-demo"] = {
  view: "overview",
  f: {
    rooms: { block: "A", floor: "", status: "", q: "", mode: "map", page: 0 },
    tenants: { q: "", active: "1", page: 0 },
    bills: { mo: null, year: null, status: "", block: "", q: "", page: 0 },
    trx: { q: "", method: "", mo: "", year: "", page: 0 },
    rep: { mo: null, year: null },
  },
  mount(view) {
    KOS.load();
    const saved = store.get("kos-view", null); if (saved) this.view = saved;
    view.innerHTML = `<div class="kos-hero kos-hero-demo" style="--art:${esc(svgUrl(ART.kost()))}"><div class="wrap kos-hero-in">
      <div style="min-width:0"><a class="kos-back" href="#kos">${ICON.arrow}<span>Kembali ke halaman KostBills</span></a>
      <div class="eyebrow">Demo interaktif · Manajemen properti</div><h1>Demo KostBills</h1>
      <p>Tagihan dan hunian untuk kos 1.000 kamar: siapa tinggal di mana, berapa tagihan tiap kamar bulan ini, dan berapa yang sudah terkumpul.</p></div>
      <div class="kos-facts"><span><b>1.000</b> kamar</span><span><b>10</b> blok</span><span><b>${idr(KOS.RENT)}</b> / bulan, sudah termasuk semua</span></div>
    </div></div>
      <div class="bleed"><div class="kos-shell"><nav class="kos-nav" id="kos-nav" aria-label="Bagian dasbor"></nav><div class="kos-main" id="kos-main"></div></div></div>`;
    view.addEventListener("click", (e) => this.onClick(e));
    this.render();
  },
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
    const items = [["overview", "Ringkasan"], ["rooms", "Kamar"], ["tenants", "Penghuni"], ["bills", "Tagihan bulanan", od], ["trx", "Transaksi"], ["reports", "Laporan pendapatan"]];
    $("#kos-nav").innerHTML = items.map(([k, l, b]) => `<button data-kv="${k}" aria-current="${this.view === k}"><span class="kn-l">${icons[k]}${l}</span>${b ? `<span class="badge num" title="Tagihan terlambat">${nf(b)}</span>` : ""}</button>`).join("") +
      `<div class="sep"></div><button data-act="reset-demo" style="font-weight:500;color:var(--muted);font-size:13px">Atur ulang data demo</button>`;
  },
  render() {
    this.nav();
    const el = $("#kos-main");
    const note = `<div class="demo-note"><b>Data demo</b><span>1.000 kamar dengan penghuni dan tagihan contoh. Sewa ${idr(KOS.RENT)}/bulan, sudah termasuk semua kecuali listrik (token prabayar). Perubahan yang Anda buat hanya tersimpan di browser ini.</span></div>`;
    el.innerHTML = note + this["v_" + this.view]();
    if (this.after) { this.after(); this.after = null; }
  },
  setView(v) { this.view = v; store.set("kos-view", v); this.render(); window.scrollTo({ top: Math.min(window.scrollY, $("#kos-main").getBoundingClientRect().top + window.scrollY - 80) }); },
  monthYearSelects(prefix, mo, year, allowAll) {
    const ys = KOS.years();
    return `<label><span class="sr">Bulan</span><select class="select" id="${prefix}-mo">${allowAll ? `<option value="" ${!mo ? "selected" : ""}>Semua bulan</option>` : ""}${KOS.MONTHS.map((n, i) => { const v = String(i + 1).padStart(2, "0"); return `<option value="${v}" ${mo === v ? "selected" : ""}>${n}</option>`; }).join("")}</select></label>
      <label><span class="sr">Tahun</span><select class="select" id="${prefix}-year">${allowAll ? `<option value="" ${!year ? "selected" : ""}>Semua tahun</option>` : ""}${ys.map((y) => `<option ${year === y ? "selected" : ""}>${y}</option>`).join("")}</select></label>`;
  },

  /* ----- Ringkasan ----- */
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
    return `
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">Tingkat hunian</span><span class="k-val num">${pct(occ / 1000)}</span><span class="k-sub">${nf(occ)} terisi · ${nf(vac)} kosong</span></div>
      <div class="panel kpi"><span class="k-label">Terkumpul · ${KOS.monthLabel(cur)}</span><span class="k-val num">${idrShort(s.collected)}</span><span class="k-sub">${pct(s.rate)} dari ${idrShort(s.billed)} ditagihkan</span></div>
      <div class="panel kpi"><span class="k-label">Total Terkumpul Tahun Ini</span><span class="k-val num">${idrShort(ytd)}</span><span class="k-sub">${nf(ytdCount)} pembayaran sejak 1 Jan ${y}</span></div>
      <div class="panel kpi"><span class="k-label">Tagihan terlambat</span><span class="k-val num" style="color:var(--bad)">${nf(od.length)}</span><span class="k-sub">${idrShort(od.reduce((a, b) => a + KOS.balance(b), 0))} lewat jatuh tempo · ${nf(soon.length)} segera jatuh tempo</span></div>
    </div>
    <div class="grid-2">
      <div class="panel card-pad"><div class="card-title"><h3>Ditagihkan vs terkumpul, 6 bulan terakhir</h3>
        <div class="legend"><span><i style="background:var(--series-2)"></i>Ditagihkan</span><span><i style="background:var(--accent)"></i>Terkumpul</span></div></div>
        <div class="chart" id="rev-chart"></div>
        <p class="muted" style="font-size:12.5px">Penagihan ${KOS.monthLabel(cur)} sejauh ini ${pct(s.rate)}, dibandingkan ${pct(prev.rate)} pada ${KOS.monthLabel(prevM)}. Setiap tagihan jatuh tempo pada tanggal masuk penghuni setiap bulan.</p>
      </div>
      <div class="panel card-pad"><div class="card-title"><h3>Kamar per blok</h3><span class="muted" style="font-size:12px">100 kamar per blok</span></div>
        <div class="legend"><span><i style="background:var(--accent)"></i>Terisi</span><span><i style="background:var(--ok)"></i>Dipesan</span><span><i style="background:var(--mnt)"></i>Perbaikan</span><span><i style="background:var(--vacant)"></i>Kosong</span></div>
        <div class="hbar-list">${blocks.map((x) => `<button class="hbar" data-goblock="${x.b}" style="border:0;background:none;padding:0;cursor:pointer;color:inherit;text-align:left" title="Blok ${x.b}: ${x.o} terisi, ${x.r} dipesan, ${x.m} perbaikan, ${x.v} kosong">
          <span class="mono" style="font-size:12px">Blok ${x.b}</span><span class="track"><i style="width:${x.o}%;background:var(--accent)"></i><i style="width:${x.r}%;background:var(--ok)"></i><i style="width:${x.m}%;background:var(--mnt)"></i><i style="width:${x.v}%;background:var(--vacant)"></i></span><span class="v">${x.o}%</span></button>`).join("")}</div>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel card-pad"><div class="card-title"><h3>Pembayaran terbaru</h3><button class="btn sm ghost" data-kv="trx">Semua transaksi ${ICON.arrow}</button></div>
        ${this.trxTable(D.trx.slice(0, 8), true)}</div>
      <div class="panel card-pad"><div class="card-title"><h3>Perlu ditindaklanjuti</h3><button class="btn sm ghost" data-act="bills-overdue">Semua yang terlambat ${ICON.arrow}</button></div>
        <div style="display:grid;gap:2px">${od.slice().sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4).concat(soon.slice().sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3)).map((b) => { const t = KOS.IX.tenant[b.tenantId] || {}; const st = KOS.status(b); const d = KOS.daysUntil(b.due); return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line-2)">
          <button style="border:0;background:none;padding:0;text-align:left;cursor:pointer;min-width:0;color:inherit" data-room="${b.roomId}"><b class="mono">${b.roomId}</b> <span>${esc(t.name || "")}</span><br><span class="muted" style="font-size:12px">${KOS.monthLabel(b.month)} · ${dueText(d)}</span></button>
          <span style="display:flex;gap:6px;align-items:center;flex-shrink:0">${statusPill(st)}${waReminder(b)}<button class="btn sm" data-pay="${b.id}">Catat</button></span></div>`; }).join("") || `<p class="muted">Tidak ada tagihan yang terlambat atau segera jatuh tempo.</p>`}</div></div>
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
    let svg = `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="Pendapatan ditagihkan dan terkumpul per bulan">`;
    for (let i = 0; i <= ticks; i++) { const v = top * i / ticks; svg += `<line class="grid-line" x1="${pl}" x2="${Wd - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 8}" y="${y(v) + 3.5}" text-anchor="end">${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 0 })} jt</text>`; }
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
        tip.innerHTML = `<b>${KOS.monthLabel(s.m)}</b><br>Ditagihkan ${idr(s.billed)}<br>Terkumpul ${idr(s.collected)} (${pct(s.rate)})`;
        tip.hidden = false; tip.style.left = clamp(rb.left - box.left + rb.width / 2, 90, box.width - 90) + "px"; tip.style.top = (rb.top - box.top + 16) + "px"; };
      r.addEventListener("mouseenter", show); r.addEventListener("click", show); r.addEventListener("mouseleave", () => tip.hidden = true);
    });
  },
  trxTable(list, compact) {
    if (!list.length) return `<p class="muted">Tidak ada transaksi yang cocok.</p>`;
    return `<div class="table-wrap" ${compact ? 'style="border:0"' : ""}><table class="t" ${compact ? 'style="min-width:520px"' : ""}><thead><tr><th>Tanggal</th>${compact ? "" : "<th>Transaksi</th>"}<th>Kamar</th><th>Penghuni</th>${compact ? "" : "<th>Invoice</th>"}<th>Metode</th><th class="r">Jumlah</th></tr></thead><tbody>
      ${list.map((t) => { const ten = KOS.IX.tenant[t.tenantId] || {}; return `<tr><td class="num">${tgl(t.date)}</td>${compact ? "" : `<td class="mono">${t.id}</td>`}<td><button class="btn ghost sm mono" style="padding:2px 4px" data-room="${t.roomId}">${t.roomId}</button></td><td>${esc(ten.name || "")}</td>${compact ? "" : `<td class="mono">${t.billId}</td>`}<td>${esc(KOS.methodLabel(t.method))}</td><td class="r num">${idr(t.amount)}</td></tr>`; }).join("")}
    </tbody></table></div>`;
  },
  pager(key, n, per) {
    const f = this.f[key], pages = Math.max(1, Math.ceil(n / per)); f.page = clamp(f.page, 0, pages - 1);
    return `<div class="pager"><span>${n ? `${nf(f.page * per + 1)}–${nf(Math.min(n, (f.page + 1) * per))} dari ${nf(n)}` : "0 hasil"}</span>
      <div class="btns"><button class="btn sm" data-pager="${key}:-1" ${f.page === 0 ? "disabled" : ""}>Sebelumnya</button><button class="btn sm" data-pager="${key}:1" ${f.page >= pages - 1 ? "disabled" : ""}>Berikutnya</button></div></div>`;
  },

  /* ----- Kamar ----- */
  roomsFiltered() {
    const f = this.f.rooms, q = f.q.trim().toLowerCase();
    return KOS.D.rooms.filter((r) => (!f.block || r.block === f.block) && (!f.floor || r.floor === +f.floor) &&
      (!f.status || (f.status === "Overdue" ? (KOS.IX.billsByRoom[r.id] || []).some((b) => KOS.status(b) === "Overdue") : r.status === f.status)) &&
      (!q || r.id.toLowerCase().includes(q) || (r.tenantId && (KOS.IX.tenant[r.tenantId].name.toLowerCase().includes(q)))));
  },
  v_rooms() {
    const f = this.f.rooms; if (f.mode === "map" && !f.block) f.block = "A";
    const list = this.roomsFiltered();
    const hasOd = (r) => (KOS.IX.billsByRoom[r.id] || []).some((b) => KOS.status(b) === "Overdue");
    const cls = (r) => hasOd(r) && r.status === "Occupied" ? "due" : { Occupied: "occ", Vacant: "vac", Maintenance: "mnt", Reserved: "res" }[r.status];
    const cnt = (s) => KOS.D.rooms.filter((r) => r.status === s).length;
    const cur = KOS.ym(new Date());
    let body;
    if (f.mode === "map") {
      const shown = new Set(list.map((r) => r.id));
      body = `<div class="panel card-pad"><div class="card-title"><h3>Denah Blok ${f.block}</h3><span class="muted" style="font-size:12px">Klik kamar untuk melihat detail</span></div>
        <div class="legend"><span><i style="background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent)"></i>Terisi</span><span><i style="background:var(--bad)"></i>Terisi, ada tunggakan</span><span><i style="background:var(--vacant)"></i>Kosong</span><span><i style="background:var(--ok-soft);box-shadow:inset 0 0 0 1px var(--ok)"></i>Dipesan</span><span><i style="background:var(--mnt)"></i>Perbaikan</span></div>
        <div class="floor-map">${[4, 3, 2, 1].map((fl) => `<div class="floor"><span>Lantai ${fl}</span><div class="rooms">${KOS.D.rooms.filter((r) => r.block === f.block && r.floor === fl).map((r) => `<button class="room ${cls(r)}" data-room="${r.id}" style="${shown.has(r.id) ? "" : "opacity:.18"}" title="${r.id} · ${roomLabel(r.status)}${r.tenantId ? " · " + esc(KOS.IX.tenant[r.tenantId].name) : ""}">${String(r.no).padStart(2, "0")}</button>`).join("")}</div></div>`).join("")}</div>
        <p class="muted" style="font-size:12.5px">${list.length} dari 100 kamar di Blok ${f.block} sesuai filter. Kamar yang pudar tidak sesuai.</p></div>`;
    } else {
      const per = 50, page = list.slice(f.page * per, f.page * per + per);
      body = `<div class="table-wrap"><table class="t"><thead><tr><th>Kamar</th><th>Blok / lantai</th><th class="r">Sewa / bulan</th><th>Status</th><th>Penghuni</th><th>Sejak</th><th>Tagihan ${KOS.monthLabel(cur, true)}</th></tr></thead><tbody>
        ${page.map((r) => { const t = r.tenantId ? KOS.IX.tenant[r.tenantId] : null; const bl = (KOS.IX.billsByRoom[r.id] || []).find((b) => b.month === cur && (!t || b.tenantId === t.id)); const bs = bl ? KOS.status(bl) : null;
          return `<tr class="click" data-room="${r.id}"><td class="mono"><b>${r.id}</b></td><td>Blok ${r.block} · ${r.floor}</td><td class="r num">${idr(r.rent || KOS.RENT)}</td><td><span class="pill ${KOS.ROOM_PILL[r.status]}">${roomLabel(r.status)}</span></td><td>${t ? esc(t.name) : '<span class="muted">—</span>'}</td><td class="num">${t ? tgl(t.checkIn) : ""}</td><td>${bs ? statusPill(bs) : '<span class="muted">—</span>'}</td></tr>`; }).join("")}
      </tbody></table></div>${this.pager("rooms", list.length, per)}`;
    }
    return `
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">Terisi</span><span class="k-val num">${nf(cnt("Occupied"))}</span><span class="k-sub">kamar yang berpenghuni</span></div>
      <div class="panel kpi"><span class="k-label">Kosong</span><span class="k-val num">${nf(cnt("Vacant"))}</span><span class="k-sub">tersedia dengan ${idr(KOS.RENT)}/bulan</span></div>
      <div class="panel kpi"><span class="k-label">Dipesan</span><span class="k-val num">${nf(cnt("Reserved"))}</span><span class="k-sub">menunggu penghuni masuk</span></div>
      <div class="panel kpi"><span class="k-label">Perbaikan</span><span class="k-val num">${nf(cnt("Maintenance"))}</span><span class="k-sub">belum bisa disewakan</span></div>
    </div>
    <div class="toolbar">
      <label class="search"><span class="sr">Cari kamar</span>${ICON.search}<input class="input" id="kr-q" type="search" placeholder="Nomor kamar atau nama penghuni" value="${esc(f.q)}"></label>
      <label><span class="sr">Lantai</span><select class="select" id="kr-floor"><option value="">Semua lantai</option>${[1, 2, 3, 4].map((x) => `<option value="${x}" ${+f.floor === x ? "selected" : ""}>Lantai ${x}</option>`).join("")}</select></label>
      <label><span class="sr">Status</span><select class="select" id="kr-status"><option value="">Semua status</option>${["Occupied", "Vacant", "Reserved", "Maintenance", "Overdue"].map((x) => `<option value="${x}" ${f.status === x ? "selected" : ""}>${x === "Overdue" ? "Ada tagihan terlambat" : roomLabel(x)}</option>`).join("")}</select></label>
      <div class="seg" role="group" aria-label="Tampilan"><button data-rmode="map" aria-pressed="${f.mode === "map"}">Denah</button><button data-rmode="table" aria-pressed="${f.mode === "table"}">Tabel</button></div>
    </div>
    <div class="block-tabs">${f.mode === "table" ? `<button data-rblock="" aria-pressed="${!f.block}">Semua blok</button>` : ""}${KOS.BLOCKS.map((b) => `<button data-rblock="${b}" aria-pressed="${f.block === b}">Blok ${b}</button>`).join("")}</div>
    ${body}`;
  },

  /* ----- Penghuni ----- */
  v_tenants() {
    const f = this.f.tenants, q = f.q.trim().toLowerCase();
    const list = KOS.D.tenants.filter((t) => (f.active === "" || t.active === (f.active === "1")) && (!q || t.name.toLowerCase().includes(q) || t.roomId.toLowerCase().includes(q) || t.phone.includes(q) || t.job.toLowerCase().includes(q)))
      .sort((a, b) => a.roomId.localeCompare(b.roomId, "en", { numeric: true }));
    const per = 50, page = list.slice(f.page * per, f.page * per + per);
    const cur = KOS.ym(new Date());
    return `<div class="toolbar">
      <label class="search"><span class="sr">Cari penghuni</span>${ICON.search}<input class="input" id="kt-q" type="search" placeholder="Nama, kamar, telepon, atau pekerjaan" value="${esc(f.q)}"></label>
      <label><span class="sr">Status hunian</span><select class="select" id="kt-active"><option value="1" ${f.active === "1" ? "selected" : ""}>Penghuni aktif</option><option value="0" ${f.active === "0" ? "selected" : ""}>Sudah keluar</option><option value="" ${f.active === "" ? "selected" : ""}>Semua penghuni</option></select></label>
      <button class="btn sm" data-act="csv-tenants">${ICON.download} Ekspor CSV</button>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Penghuni</th><th>Kamar</th><th>Telepon</th><th>Pekerjaan</th><th>Masuk</th><th>Jatuh tempo</th><th class="r">Deposit</th><th>Tagihan ${KOS.monthLabel(cur, true)}</th></tr></thead><tbody>
      ${page.map((t) => { const b = t.active ? (KOS.IX.billsByRoom[t.roomId] || []).find((x) => x.month === cur && x.tenantId === t.id) : null; const s = b ? KOS.status(b) : null;
        return `<tr class="click" data-room="${t.roomId}"><td><b>${esc(t.name)}</b> <span class="muted mono" style="font-size:11px">${t.id}</span></td><td class="mono">${t.roomId}</td><td class="num">${esc(t.phone)}</td><td>${esc(t.job)}</td><td class="num">${tgl(t.checkIn)}${t.checkOut ? ` → ${tgl(t.checkOut)}` : ""}</td><td class="num">${t.active ? `tgl ${t.dueDay}` : "—"}</td><td class="r num">${t.deposit ? idr(t.deposit) : "—"}</td><td>${s ? statusPill(s) : t.active ? '<span class="muted">Belum ada tagihan</span>' : '<span class="pill plain">Sudah keluar</span>'}</td></tr>`; }).join("") || `<tr><td colspan="8" class="muted" style="padding:24px">Tidak ada penghuni yang cocok dengan pencarian itu.</td></tr>`}
    </tbody></table></div>${this.pager("tenants", list.length, per)}`;
  },

  /* ----- Tagihan ----- */
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
    const period = f.mo && f.year ? KOS.monthLabel(`${f.year}-${f.mo}`) : f.year ? `Sepanjang ${f.year}` : f.mo ? `${KOS.MONTHS[+f.mo - 1]}, semua tahun` : "Semua tagihan";
    return `
    ${ms[0] < curReal ? `<div class="panel card-pad" style="border-color:var(--accent)"><b>Tagihan ${KOS.monthLabel(curReal)} belum dibuat.</b><div><button class="btn primary sm" data-act="gen:${curReal}">Buat tagihan ${KOS.monthLabel(curReal)}</button></div></div>` : ""}
    <div class="toolbar">
      <label class="search"><span class="sr">Cari tagihan</span>${ICON.search}<input class="input" id="kb-q" type="search" placeholder="Invoice, kamar, atau penghuni" value="${esc(f.q)}"></label>
      ${this.monthYearSelects("kb", f.mo, f.year, true)}
      <label><span class="sr">Status</span><select class="select" id="kb-status"><option value="">Semua status</option>${KOS.STATUSES.map((x) => `<option value="${x}" ${f.status === x ? "selected" : ""}>${stLabel(x)}</option>`).join("")}</select></label>
      <label><span class="sr">Blok</span><select class="select" id="kb-block"><option value="">Semua blok</option>${KOS.BLOCKS.map((b) => `<option value="${b}" ${f.block === b ? "selected" : ""}>Blok ${b}</option>`).join("")}</select></label>
      <button class="btn sm" data-act="csv-bills">${ICON.download} CSV</button>
      <button class="btn sm" data-act="gen:${next}" title="Buat tagihan untuk semua kamar yang terisi">Buat tagihan ${KOS.monthLabel(next)}</button>
    </div>
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">Tagihan · ${esc(period)}</span><span class="k-val num">${nf(sm.count)}</span><span class="k-sub">${idr(KOS.RENT)} per tagihan, tanpa biaya tambahan</span></div>
      <div class="panel kpi"><span class="k-label">Ditagihkan</span><span class="k-val num">${idrShort(sm.billed)}</span><span class="k-sub">${idr(sm.billed)}</span></div>
      <div class="panel kpi"><span class="k-label">Terkumpul</span><span class="k-val num">${idrShort(sm.collected)}</span><span class="k-sub">${pct(sm.rate)} dari yang ditagihkan</span></div>
      <div class="panel kpi"><span class="k-label">Belum dibayar</span><span class="k-val num" style="color:${sm.outstanding ? "var(--bad)" : "inherit"}">${idrShort(sm.outstanding)}</span><span class="k-sub">${idr(sm.outstanding)}</span></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${KOS.STATUSES.map((s) => `<button class="pill ${KOS.STATUS_PILL[s]}" data-bstatus="${f.status === s ? "" : s}" style="border:0;cursor:pointer;${f.status && f.status !== s ? "opacity:.5" : ""}" title="${f.status === s ? "Tampilkan semua status" : "Tampilkan hanya " + stLabel(s)}">${stLabel(s)} ${nf(sm.st[s])}</button>`).join("")}</div>
    <p class="muted wa-note">${WA_ICON}<span>Tombol WhatsApp membuka pesan pengingat yang sudah terisi. Di demo ini pesan dikirim ke nomor pengelola ${waDisplay((adminData().profile || {}).whatsapp)}, bukan ke nomor penghuni contoh.</span></p>
    <div class="table-wrap"><table class="t"><thead><tr><th>Invoice</th><th>Kamar</th><th>Penghuni</th><th>Bulan</th><th>Jatuh tempo</th><th class="r">Jumlah</th><th class="r">Sisa</th><th>Status</th><th></th></tr></thead><tbody>
      ${page.map((b) => { const t = KOS.IX.tenant[b.tenantId] || {}; const s = KOS.status(b); const d = KOS.daysUntil(b.due);
        return `<tr><td class="mono">${b.id}</td><td><button class="btn ghost sm mono" style="padding:2px 4px" data-room="${b.roomId}">${b.roomId}</button></td><td>${esc(t.name || "")}</td><td>${KOS.monthLabel(b.month)}</td><td class="num">${tgl(b.due)}${s === "Due Soon" ? `<br><span class="muted" style="font-size:11.5px">${d === 0 ? "hari ini" : `${d} hari lagi`}</span>` : ""}</td><td class="r num">${idr(KOS.total(b))}</td><td class="r num">${KOS.balance(b) ? idr(KOS.balance(b)) : "—"}</td><td>${statusPill(s)}</td>
        <td style="white-space:nowrap;text-align:right">${s !== "Paid" ? `<button class="btn sm" data-pay="${b.id}">Catat pembayaran</button> ` : ""}${s === "Overdue" || s === "Due Soon" ? waReminder(b) : ""}<button class="icon-btn" data-inv="${b.id}" title="Unduh PDF ${s === "Paid" ? "kuitansi" : "invoice"}" aria-label="Unduh PDF">${ICON.download}</button></td></tr>`; }).join("") || `<tr><td colspan="9" class="muted" style="padding:24px">Tidak ada tagihan yang cocok dengan filter itu.</td></tr>`}
    </tbody></table></div>${this.pager("bills", list.length, per)}`;
  },

  /* ----- Transaksi ----- */
  v_trx() {
    const f = this.f.trx, q = f.q.trim().toLowerCase();
    const list = KOS.D.trx.filter((t) => (!f.method || t.method === f.method) && (!f.year || t.date.slice(0, 4) === f.year) && (!f.mo || t.date.slice(5, 7) === f.mo) &&
      (!q || t.id.toLowerCase().includes(q) || t.roomId.toLowerCase().includes(q) || t.billId.toLowerCase().includes(q) || (KOS.IX.tenant[t.tenantId] || { name: "" }).name.toLowerCase().includes(q)));
    const per = 50, page = list.slice(f.page * per, f.page * per + per);
    const sum = list.reduce((a, t) => a + t.amount, 0);
    return `<div class="toolbar">
      <label class="search"><span class="sr">Cari transaksi</span>${ICON.search}<input class="input" id="kx-q" type="search" placeholder="Transaksi, invoice, kamar, atau penghuni" value="${esc(f.q)}"></label>
      ${this.monthYearSelects("kx", f.mo, f.year, true)}
      <label><span class="sr">Metode</span><select class="select" id="kx-method"><option value="">Semua metode</option>${KOS.METHODS.map((m) => `<option value="${m}" ${f.method === m ? "selected" : ""}>${KOS.methodLabel(m)}</option>`).join("")}</select></label>
      <button class="btn sm" data-act="csv-trx">${ICON.download} Ekspor CSV</button>
    </div>
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">Pembayaran</span><span class="k-val num">${nf(list.length)}</span><span class="k-sub">sesuai filter</span></div>
      <div class="panel kpi"><span class="k-label">Total diterima</span><span class="k-val num">${idrShort(sum)}</span><span class="k-sub">${idr(sum)}</span></div>
    </div>
    ${this.trxTable(page)}${this.pager("trx", list.length, per)}`;
  },

  /* ----- Laporan ----- */
  v_reports() {
    const r = this.f.rep; if (r.mo === null) r.mo = curMo(); if (r.year === null) r.year = curY();
    const m = `${r.year}-${r.mo}`;
    const s = KOS.summary(m);
    const sel = `<div class="toolbar">${this.monthYearSelects("krep", r.mo, r.year, false)}
      <button class="btn primary sm" data-act="pdf-report:${m}" ${s.count ? "" : "disabled"}>${ICON.download} Unduh laporan PDF</button>
      <button class="btn sm" data-act="csv-report:${m}" ${s.count ? "" : "disabled"}>${ICON.download} CSV</button></div>`;
    if (!s.count) return sel + `<div class="empty"><h3>Belum ada tagihan untuk ${KOS.monthLabel(m)}</h3><p>Pilih bulan antara ${KOS.monthLabel(KOS.months().slice(-1)[0])} dan ${KOS.monthLabel(KOS.months()[0])}, atau buat tagihan bulan baru dari menu Tagihan bulanan.</p></div>`;
    const rows = KOS.BLOCKS.map((b) => ({ b, ...KOS.sumBills(KOS.D.bills.filter((x) => x.month === m && x.roomId[0] === b)) }));
    const floors = [1, 2, 3, 4].map((fl) => ({ fl, ...KOS.sumBills(KOS.D.bills.filter((x) => x.month === m && KOS.IX.room[x.roomId].floor === fl)) }));
    const maxB = Math.max(...rows.map((x) => x.billed)) || 1;
    return sel + `
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">Ditagihkan</span><span class="k-val num">${idrShort(s.billed)}</span><span class="k-sub">${nf(s.count)} tagihan × ${idr(KOS.RENT)}</span></div>
      <div class="panel kpi"><span class="k-label">Terkumpul</span><span class="k-val num">${idrShort(s.collected)}</span><span class="k-sub">tingkat penagihan ${pct(s.rate)}</span></div>
      <div class="panel kpi"><span class="k-label">Belum terbayar</span><span class="k-val num">${idrShort(s.outstanding)}</span><span class="k-sub">${nf(s.st.Overdue)} terlambat · ${nf(s.st["Due Soon"])} segera jatuh tempo · ${nf(s.st.Unpaid + s.st.Partial)} belum jatuh tempo</span></div>
      <div class="panel kpi"><span class="k-label">Total Terkumpul Tahun Ini</span><span class="k-val num">${idrShort(KOS.collectedInYear(r.year))}</span><span class="k-sub">semua pembayaran di ${r.year}</span></div>
    </div>
    <div class="grid-2">
      <div class="panel card-pad"><div class="card-title"><h3>Pendapatan per blok · ${KOS.monthLabel(m)}</h3><div class="legend"><span><i style="background:var(--series-2)"></i>Ditagihkan</span><span><i style="background:var(--accent)"></i>Terkumpul</span></div></div>
        <div class="hbar-list">${rows.map((x) => `<div class="hbar" title="Blok ${x.b}: ditagihkan ${idr(x.billed)}, terkumpul ${idr(x.collected)}"><span class="mono" style="font-size:12px">Blok ${x.b}</span>
          <span style="display:grid;gap:2px"><span class="track" style="height:7px;background:none"><i style="width:${x.billed / maxB * 100}%;background:var(--series-2);border-radius:2px"></i></span><span class="track" style="height:7px;background:none"><i style="width:${x.collected / maxB * 100}%;background:var(--accent);border-radius:2px"></i></span></span>
          <span class="v">${x.billed ? (x.rate * 100).toFixed(0) : 0}%</span></div>`).join("")}</div></div>
      <div class="panel card-pad"><div class="card-title"><h3>Per lantai</h3></div>
        <div class="table-wrap" style="border:0"><table class="t" style="min-width:0"><thead><tr><th>Lantai</th><th class="r">Tagihan</th><th class="r">Ditagihkan</th><th class="r">Terkumpul</th></tr></thead><tbody>
        ${floors.map((x) => `<tr><td>Lantai ${x.fl}</td><td class="r num">${nf(x.count)}</td><td class="r num">${idrShort(x.billed)}</td><td class="r num">${idrShort(x.collected)}</td></tr>`).join("")}</tbody></table></div>
        <p class="muted" style="font-size:12.5px">${KOS.INCLUDED}</p></div>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Blok</th><th class="r">Tagihan</th><th class="r">Ditagihkan</th><th class="r">Terkumpul</th><th class="r">Belum terbayar</th><th class="r">Terlambat</th><th class="r">Tingkat</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td class="mono">Blok ${x.b}</td><td class="r num">${nf(x.count)}</td><td class="r num">${idr(x.billed)}</td><td class="r num">${idr(x.collected)}</td><td class="r num">${idr(x.outstanding)}</td><td class="r num">${nf(x.st.Overdue)}</td><td class="r num">${x.billed ? pct(x.rate) : "0,0%"}</td></tr>`).join("")}
      <tr style="font-weight:700"><td>Total</td><td class="r num">${nf(s.count)}</td><td class="r num">${idr(s.billed)}</td><td class="r num">${idr(s.collected)}</td><td class="r num">${idr(s.outstanding)}</td><td class="r num">${nf(s.st.Overdue)}</td><td class="r num">${pct(s.rate)}</td></tr>
    </tbody></table></div>`;
  },

  /* ----- Detail kamar & pembayaran ----- */
  openRoom(id) {
    const r = KOS.IX.room[id]; if (!r) return;
    const t = r.tenantId ? KOS.IX.tenant[r.tenantId] : null;
    const bills = (KOS.IX.billsByRoom[id] || []).slice().sort((a, b) => b.month.localeCompare(a.month));
    const past = KOS.D.tenants.filter((x) => x.roomId === id && !x.active);
    const m = openModal({
      title: `Kamar ${r.id} <span class="pill ${KOS.ROOM_PILL[r.status]}" style="vertical-align:3px;margin-left:6px">${roomLabel(r.status)}</span>`, wide: true,
      body: `<div class="detail-grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
        <dl class="kv"><dt>Blok / lantai</dt><dd>Blok ${r.block} · Lantai ${r.floor}</dd><dt>Sewa</dt><dd class="num">${idr(r.rent || KOS.RENT)} / bulan</dd><dt>Termasuk</dt><dd style="font-weight:500">Kebersihan, keamanan, perawatan</dd><dt>Listrik</dt><dd style="font-weight:500">Token prabayar penghuni (tidak ditagihkan)</dd>
          ${t ? `<dt>Penghuni</dt><dd>${esc(t.name)}</dd><dt>Telepon</dt><dd class="num">${esc(t.phone)}</dd><dt>Pekerjaan</dt><dd>${esc(t.job)}</dd><dt>Sejak</dt><dd class="num">${tgl(t.checkIn)}</dd><dt>Jatuh tempo</dt><dd>Tanggal ${t.dueDay} setiap bulan</dd><dt>Deposit</dt><dd class="num">${idr(t.deposit)}</dd>` : ""}</dl>
        <div style="display:grid;gap:10px;align-content:start">
          ${t ? `<button class="btn" data-act="checkout:${r.id}">Proses penghuni keluar</button>` : r.status !== "Maintenance" ? `<div id="ci-form" style="display:grid;gap:8px"><b>Daftarkan penghuni baru</b>
            <input class="input" id="ci-name" placeholder="Nama lengkap"><input class="input" id="ci-phone" placeholder="Telepon, mis. 0812-3456-7890" inputmode="tel">
            <input class="input" id="ci-job" placeholder="Pekerjaan"><label class="field"><span>Tanggal masuk (sewa jatuh tempo di tanggal ini setiap bulan)</span><input class="input" id="ci-date" type="date" value="${KOS.today()}"></label>
            <button class="btn primary" data-act="checkin:${r.id}">Daftarkan dan tagih ${idr(KOS.RENT)}</button><p class="muted" id="ci-err" hidden style="color:var(--bad)"></p></div>` : ""}
          ${!t ? `<button class="btn sm" data-act="mnt:${r.id}">${r.status === "Maintenance" ? "Perbaikan selesai (jadikan kosong)" : "Tandai sedang diperbaiki"}</button>` : ""}
        </div></div>
        <div><b style="font-size:14px">Riwayat tagihan</b>
        <div class="table-wrap" style="margin-top:8px"><table class="t" style="min-width:560px"><thead><tr><th>Bulan</th><th>Invoice</th><th>Jatuh tempo</th><th class="r">Jumlah</th><th class="r">Sisa</th><th>Status</th><th></th></tr></thead><tbody>
        ${bills.map((b) => { const s = KOS.status(b); return `<tr><td>${KOS.monthLabel(b.month)}</td><td class="mono">${b.id}</td><td class="num">${tgl(b.due)}</td><td class="r num">${idr(KOS.total(b))}</td><td class="r num">${KOS.balance(b) ? idr(KOS.balance(b)) : "—"}</td><td>${statusPill(s)}</td><td style="text-align:right;white-space:nowrap">${s !== "Paid" ? `<button class="btn sm" data-pay="${b.id}">Catat</button>${waReminder(b)}` : ""}<button class="icon-btn" data-inv="${b.id}" aria-label="Unduh PDF">${ICON.download}</button></td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">Belum ada tagihan untuk kamar ini.</td></tr>`}
        </tbody></table></div></div>
        ${past.length ? `<p class="muted" style="font-size:13px">Penghuni sebelumnya: ${past.map((p) => `${esc(p.name)} (${tgl(p.checkIn)} → ${tgl(p.checkOut)})`).join(", ")}</p>` : ""}`,
    });
    m.addEventListener("click", (e) => this.onClick(e, m));
  },
  openPay(id) {
    const b = KOS.IX.bill[id]; if (!b) return;
    const t = KOS.IX.tenant[b.tenantId] || {};
    const bal = KOS.balance(b);
    const m = openModal({
      title: `Catat pembayaran · ${b.roomId}`,
      body: `<p>${esc(t.name || "")} · ${KOS.monthLabel(b.month)} · jatuh tempo ${tgl(b.due)}</p>
        <dl class="kv"><dt>Sewa kamar</dt><dd class="num">${idr(b.rent)}</dd><dt>Sudah dibayar</dt><dd class="num">${idr(b.paid)}</dd><dt>Sisa tagihan</dt><dd class="num">${idr(bal)}</dd></dl>
        <p class="muted" style="font-size:12.5px">${KOS.INCLUDED} Tidak ada biaya lain yang ditambahkan.</p>
        <div class="form-grid">
          <label class="field"><span>Jumlah (Rp)</span><input class="input num" id="py-amt" type="number" min="1000" max="${bal}" step="1000" value="${bal}"></label>
          <label class="field"><span>Tanggal bayar</span><input class="input" id="py-date" type="date" value="${KOS.today()}" max="${KOS.today()}"></label>
          <label class="field full"><span>Metode</span><select class="select" id="py-method">${KOS.METHODS.map((x) => `<option value="${x}">${KOS.methodLabel(x)}</option>`).join("")}</select></label>
        </div><p class="muted" id="py-err" hidden style="color:var(--bad)"></p>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn primary" id="py-save">Simpan pembayaran</button>`,
    });
    m.querySelector("#py-save").onclick = () => {
      const amt = Math.round(+m.querySelector("#py-amt").value), date = m.querySelector("#py-date").value, method = m.querySelector("#py-method").value;
      const err = m.querySelector("#py-err"); const say = (x) => { err.textContent = x; err.hidden = false; };
      if (!(amt > 0)) return say("Masukkan jumlah lebih dari nol.");
      if (amt > bal) return say(`Sisa tagihan ${idr(bal)}. Masukkan jumlah itu atau kurang.`);
      if (!date) return say("Pilih tanggal pembayaran.");
      if (date > KOS.today()) return say("Tanggal pembayaran tidak boleh di masa depan.");
      const tx = KOS.recordPayment(b, amt, method, date);
      closeModal(); this.render(); toast(`${tx.id} tersimpan · ${idr(amt)} · status ${b.roomId} kini ${stLabel(KOS.status(b)).toLowerCase()}`);
    };
  },
  onClick(e, scope) {
    const d = (k) => e.target.closest(`[data-${k}]`);
    let x;
    if ((x = d("kv"))) return this.setView(x.dataset.kv);
    if ((x = d("pay"))) { e.stopPropagation(); return this.openPay(x.dataset.pay); }
    if ((x = d("inv"))) { e.stopPropagation(); toast("Menyiapkan PDF…", 1500); return pdfInvoice(KOS.IX.bill[x.dataset.inv]); }
    if (e.target.closest(".wa-ic")) return;
    if ((x = d("room"))) { if (scope) return; return this.openRoom(x.dataset.room); }
    if ((x = d("goblock"))) { Object.assign(this.f.rooms, { block: x.dataset.goblock, mode: "map" }); return this.setView("rooms"); }
    if ((x = d("bstatus"))) { this.f.bills.status = x.dataset.bstatus; this.f.bills.page = 0; return this.render(); }
    if ((x = d("rmode"))) { this.f.rooms.mode = x.dataset.rmode; this.f.rooms.page = 0; if (x.dataset.rmode === "map" && !this.f.rooms.block) this.f.rooms.block = "A"; return this.render(); }
    if ((x = d("rblock"))) { this.f.rooms.block = x.dataset.rblock; this.f.rooms.page = 0; return this.render(); }
    if ((x = d("pager"))) { const [k, dir] = x.dataset.pager.split(":"); this.f[k].page += +dir; this.render(); const t = $(".table-wrap"); if (t) t.scrollIntoView({ block: "start" }); return; }
    if ((x = d("act"))) {
      const [a, arg] = x.dataset.act.split(/:(.*)/);
      if (a === "reset-demo") {
        openModal({ title: "Atur ulang data demo?", body: "<p>Semua pembayaran, pendaftaran penghuni, dan perubahan lain yang Anda buat akan dihapus, lalu 1.000 kamar contoh dibuat ulang.</p>", foot: `<button class="btn" data-close>Batal</button><button class="btn danger" id="rs-yes">Atur ulang</button>`,
          onMount: (mm) => mm.querySelector("#rs-yes").onclick = () => { KOS.reset(); closeModal(); this.render(); toast("Data demo sudah diatur ulang."); } });
      }
      if (a === "bills-overdue") { Object.assign(this.f.bills, { status: "Overdue", mo: "", year: "", page: 0 }); this.setView("bills"); }
      if (a === "gen") { const n = KOS.generateMonth(arg); Object.assign(this.f.bills, { mo: arg.slice(5, 7), year: arg.slice(0, 4), page: 0 }); this.render(); toast(n ? `${nf(n)} tagihan dibuat untuk ${KOS.monthLabel(arg)}.` : `Tagihan ${KOS.monthLabel(arg)} sudah ada.`); }
      if (a === "checkout") { KOS.checkOut(KOS.IX.room[arg]); closeModal(); this.render(); toast(`Kamar ${arg} sekarang kosong.`); }
      if (a === "mnt") { const r = KOS.IX.room[arg]; KOS.setRoomStatus(r, r.status === "Maintenance" ? "Vacant" : "Maintenance"); closeModal(); this.render(); this.openRoom(arg); }
      if (a === "checkin") {
        const s = scope || document; const v = (q) => s.querySelector(q).value.trim();
        const err = s.querySelector("#ci-err");
        if (!v("#ci-name")) { err.textContent = "Masukkan nama penghuni."; err.hidden = false; return; }
        const ten = KOS.checkIn(KOS.IX.room[arg], { name: v("#ci-name"), phone: v("#ci-phone") || "—", job: v("#ci-job") || "—", date: v("#ci-date") || KOS.today() });
        closeModal(); this.render(); this.openRoom(arg); toast(`${ten.name} terdaftar di kamar ${arg}.`);
      }
      if (a === "pdf-report") { toast("Menyiapkan PDF…", 1500); pdfReport(arg); }
      if (a === "csv-tenants") { const rows = [["ID Penghuni", "Nama", "Kamar", "Telepon", "Pekerjaan", "Tanggal masuk", "Tanggal keluar", "Tanggal jatuh tempo", "Deposit"]].concat(KOS.D.tenants.map((t) => [t.id, t.name, t.roomId, t.phone, t.job, t.checkIn, t.checkOut || "", t.dueDay, t.deposit])); saveFile("kostbills-penghuni.csv", csvOf(rows)); }
      if (a === "csv-bills") { const f = this.f.bills; const rows = [["Invoice", "Kamar", "Penghuni", "Bulan", "Jatuh tempo", "Sewa", "Dibayar", "Sisa", "Status"]].concat(this.billsFiltered().map((b) => [b.id, b.roomId, (KOS.IX.tenant[b.tenantId] || {}).name, b.month, b.due, b.rent, b.paid, KOS.balance(b), stLabel(KOS.status(b))])); saveFile(`kostbills-tagihan-${f.year || "semua"}-${f.mo || "semua"}.csv`, csvOf(rows)); }
      if (a === "csv-trx") { const rows = [["Transaksi", "Tanggal", "Invoice", "Kamar", "Penghuni", "Metode", "Jumlah"]].concat(KOS.D.trx.map((t) => [t.id, t.date, t.billId, t.roomId, (KOS.IX.tenant[t.tenantId] || {}).name, KOS.methodLabel(t.method), t.amount])); saveFile("kostbills-transaksi.csv", csvOf(rows)); }
      if (a === "csv-report") { const rows = [["Blok", "Tagihan", "Ditagihkan", "Terkumpul", "Belum terbayar", "Terlambat"]]; KOS.BLOCKS.forEach((b) => { const r = KOS.sumBills(KOS.D.bills.filter((x) => x.month === arg && x.roomId[0] === b)); rows.push([b, r.count, r.billed, r.collected, r.outstanding, r.st.Overdue]); }); saveFile(`kostbills-laporan-${arg}.csv`, csvOf(rows)); }
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
  const map = { "kr-floor": ["rooms", "floor"], "kr-status": ["rooms", "status"], "kt-active": ["tenants", "active"], "kb-mo": ["bills", "mo"], "kb-year": ["bills", "year"], "kb-status": ["bills", "status"], "kb-block": ["bills", "block"], "kx-method": ["trx", "method"], "kx-mo": ["trx", "mo"], "kx-year": ["trx", "year"], "krep-mo": ["rep", "mo"], "krep-year": ["rep", "year"] };
  if (!map[id]) return;
  const [g, k] = map[id]; K.f[g][k] = v; if ("page" in K.f[g]) K.f[g].page = 0; K.render();
});
