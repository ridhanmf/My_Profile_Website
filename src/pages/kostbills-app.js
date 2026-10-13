/* ===== KostBills Admin / Management dashboard (#kos-app) =====
   Live data from the server (api/kos.php). It reuses every view of the demo dashboard (overview, rooms,
   bills, transactions, reports, PDFs, CSV) and adds the operational sections. Admin can change data;
   Management only sees overview, bills, reports and profit. Every change is checked again by the API. */
const tidOf = (n) => "T" + String(n).padStart(4, "0");
const OPS = { st: null };
const DEMO_PAGE = PAGES["kos-demo"];
const phoneOk = (p) => /^(?:\+?62|0)8\d{7,12}$/.test(String(p || "").replace(/[\s().-]/g, ""));
const dtm = (s) => (s ? `${tgl(s.slice(0, 10))} ${s.slice(11, 16)}` : "—");

/* Server rows → the shape the shared dashboard views use. */
function kosMap(st) {
  const types = Object.fromEntries(st.types.map((t) => [t.type, t]));
  const active = {}; st.tenants.forEach((t) => { if (+t.active) active[t.room_id] = tidOf(t.id); });
  return {
    v: 3, ops: true, today: st.today, propertyName: st.settings.property_name, types: st.types,
    rooms: st.rooms.map((r) => ({ id: r.id, block: r.block, floor: +r.floor, no: +r.num, type: r.type, rent: types[r.type].sale, status: r.status, tenantId: active[r.id] || null })),
    tenants: st.tenants.map((t) => ({ id: tidOf(t.id), dbId: +t.id, name: t.name, phone: t.phone == null ? null : t.phone, job: t.job || "", roomId: t.room_id, checkIn: t.check_in, checkOut: t.check_out, deposit: +(t.deposit || 0), dueDay: t.due_day ? +t.due_day : null, active: !!+t.active, paidUntil: t.paid_until, source: t.source || "admin" })),
    bills: st.bills.map((b) => ({ id: b.code, dbId: +b.id, roomId: b.room_id, tenantId: tidOf(b.tenant_id), month: b.period_start, monthEnd: b.period_end, months: +b.months, kind: b.kind, rent: +b.total, paid: +b.paid, due: b.due_date, issued: String(b.created_at).slice(0, 10), start: b.start_date, end: b.end_date, base: +b.base_price, markup: +b.markup, sale: +b.sale_price, subtotal: +b.subtotal, discount: +b.discount_amount, discountBp: +b.discount_bp, profit: +b.profit, model: b.profit_model, state: b.status })),
    trx: st.trx.map((p) => ({ id: p.ref || "PAY-" + p.id, billId: p.code, roomId: p.room_id, tenantId: tidOf(p.tenant_id), date: String(p.paid_at || p.created_at).slice(0, 10), amount: +p.amount, method: p.method || p.gateway, gateway: p.gateway })),
  };
}

Object.assign(KOS_ICONS, (() => {
  const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  return {
    profit: I('<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>'),
    pays: I('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'),
    auto: I('<path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5"/><circle cx="12" cy="12" r="4"/>'),
    archive: I('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>'),
    settings: I('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 11l2 2 4-4"/>'),
    audit: I('<path d="M9 4h6l1 2h3v15H5V6h3z"/><path d="M9 12l2 2 4-4"/>'),
  };
})());

PAGES["kos-app"] = Object.assign(Object.create(DEMO_PAGE), {
  view: "overview",
  ro: true,
  f: {
    rooms: { block: "A", floor: "", status: "", type: "", q: "", mode: "map", page: 0 },
    tenants: { q: "", active: "1", page: 0 },
    bills: { mo: null, year: null, status: "", block: "", q: "", page: 0 },
    trx: { q: "", method: "", mo: "", year: "", page: 0 },
    rep: { mo: null, year: null },
    wa: { q: "", kind: "", page: 0 },
    pays: { status: "", page: 0 },
    audit: { q: "", action: "", page: 0 },
  },
  imported: [],

  async mount(view) {
    this.el = view;
    view.addEventListener("click", (e) => this.onClick(e));
    view.addEventListener("submit", (e) => { const f = e.target.closest("form[data-form]"); if (f) { e.preventDefault(); this.submitForm(f); } });
    view.addEventListener("change", (e) => { if (e.target.id === "imp-file") this.readImportFile(e.target); });
    if (!SERVER) {
      view.innerHTML = `<div class="wrap" style="padding:48px 16px"><div class="empty"><h3>${tt("Dasbor operasional butuh server", "The live dashboard needs the server")}</h3><p>${tt("Login Admin dan Management hanya berfungsi di website yang memakai PHP + MySQL (Hostinger). Di sini Anda bisa mencoba demo sebagai Pengunjung.", "Admin and Management sign-in only work on the website that runs PHP + MySQL (Hostinger). Here you can try the demo as a visitor.")}</p><p><a class="btn" href="#kos-role">${tt("Pilih peran", "Choose a role")}</a></p></div></div>`;
      return;
    }
    view.innerHTML = `<div class="wrap" style="padding:64px 16px"><p class="muted">${tt("Memuat data KostBills…", "Loading KostBills data…")}</p></div>`;
    const a = await api("auth.php");
    if (current !== this) return;
    if (!a.ok || !a.role) return this.lost(true);
    Object.assign(KSESS, { role: a.role, username: a.username, csrf: a.csrf });
    if (!(await this.reload())) return;
    const saved = store.get("kos-app-view", null); if (saved) this.view = saved;
    this.paint();
  },
  async reload() {
    const r = await api("kos.php?action=state");
    if (current !== this) return false;
    if (r.status === 401) { this.lost(); return false; }
    if (!r.ok) { this.el.innerHTML = `<div class="wrap" style="padding:48px 16px"><div class="empty"><h3>${tt("Data tidak bisa dimuat", "Couldn't load the data")}</h3><p>${esc(r.message || tt("Server tidak bisa dihubungi.", "Couldn't reach the server."))}</p></div></div>`; return false; }
    OPS.st = r;
    this.ro = r.role !== "admin";
    KOS.setData(kosMap(r));
    return true;
  },
  async refresh() { const y = window.scrollY; if (await this.reload()) { this.render(); window.scrollTo(0, y); } },
  lost(silent) {
    Object.assign(KSESS, { role: null, username: "", csrf: "" });
    if (!silent) toast(tt("Sesi berakhir. Silakan masuk lagi.", "Your session ended. Please sign in again."), 4000);
    go("kos-role");
  },
  unmount() { if (KOS.MODE === "ops") KOS.load(); }, // live data never lingers in the shared engine
  setView(v) { this.view = v; store.set("kos-app-view", v); this.render(); window.scrollTo({ top: Math.min(window.scrollY, $("#kos-main").getBoundingClientRect().top + window.scrollY - 80) }); },

  paint() {
    this.el.lang = LANG.get();
    const st = OPS.st, admin = st.role === "admin";
    this.el.innerHTML = `<div class="kos-hero kos-hero-demo" style="--art:${esc(svgUrl(ART.kost()))}"><div class="wrap kos-hero-in">
      <div style="min-width:0"><a class="kos-back" href="#kos">${ICON.arrow}<span>${tt("Kembali ke halaman KostBills", "Back to the KostBills page")}</span></a>
      <div class="eyebrow">${tt("Data operasional", "Live data")} · ${esc(st.settings.property_name)}</div><h1>${tt("Dasbor KostBills", "KostBills dashboard")}</h1>
      <p class="ops-who"><span class="pill ${admin ? "info" : "plain"}">${admin ? "Admin" : "Management"}</span> <b>${esc(st.username)}</b> <button class="btn sm" data-op="logout">${tt("Keluar", "Sign out")}</button></p></div>
      ${langSwitch("on-dark")}
    </div></div>
    <div class="bleed"><div class="kos-shell"><nav class="kos-nav" id="kos-nav" aria-label="${tt("Bagian dasbor", "Dashboard sections")}"></nav><div class="kos-main" id="kos-main"></div></div></div>`;
    this.render();
  },
  navItems(od) {
    const all = [["overview", tt("Ringkasan", "Overview")], ["rooms", tt("Kamar", "Rooms")], ["tenants", tt("Penghuni", "Tenants")], ["bills", tt("Tagihan bulanan", "Monthly bills"), od], ["trx", tt("Transaksi", "Transactions")], ["reports", tt("Laporan pendapatan", "Revenue reports")],
      ["profit", tt("Keuntungan", "Profit")], ["pays", tt("Pembayaran online", "Online payments")], ["auto", tt("Otomatisasi & WhatsApp", "Automation & WhatsApp")], ["archive", tt("Arsip penghuni", "Tenant archive")], ["settings", tt("Pengaturan", "Settings")], ["users", tt("Pengguna", "Users")], ["audit", tt("Log audit", "Audit log")]];
    return OPS.st.role === "admin" ? all : all.filter(([k]) => ["overview", "bills", "reports", "profit"].includes(k));
  },
  navFooter() { return `<div class="sep"></div><button data-op="refresh" style="font-weight:500;color:var(--muted);font-size:13px">${tt("Muat ulang data", "Reload data")}</button>`; },
  noteHtml() {
    const st = OPS.st;
    if (st.role !== "admin") return `<div class="demo-note ops-note"><b>Management · ${tt("hanya lihat", "view only")}</b><span>${tt("Data operasional. Peran ini bisa melihat tagihan bulanan, laporan keuangan, keuntungan, dan ringkasan, tetapi tidak bisa mengubah atau menghapus data.", "Live data. This role can see monthly bills, financial reports, profit and the summary, but can't change or delete anything.")}</span></div>`;
    const ig = st.integration;
    const chip = (ok, label) => `<span class="pill ${ok ? "ok" : "warn"}">${label}</span>`;
    return `<div class="demo-note ops-note"><b>${tt("Data operasional", "Live data")}</b><span>${chip(ig.payment.live, ig.payment.live ? "PayPro " + tt("aktif", "live") : tt("Pembayaran: simulasi", "Payments: simulation"))} ${chip(ig.wa.live, ig.wa.live ? "WhatsApp " + tt("aktif", "live") : tt("WhatsApp: simulasi", "WhatsApp: simulation"))} ${chip(ig.cron, ig.cron ? tt("Cron siap", "Cron ready") : tt("Cron belum diatur", "Cron not set"))}</span><button class="btn sm" data-kv="pays">${tt("Detail integrasi", "Integration details")}</button></div>`;
  },
  waNote() {
    if (this.ro) return "";
    const wa = OPS.st.integration.wa;
    return `<p class="muted wa-note">${WA_ICON}<span>${wa.live ? tt("Tombol WhatsApp mengirim tagihan dan link pembayaran ke nomor penghuni lewat WhatsApp Cloud API.", "The WhatsApp button sends the bill and payment link to the tenant through the WhatsApp Cloud API.") : tt("WhatsApp masih mode simulasi: pesan dicatat di log (menu Otomatisasi) dan tidak dikirim. Dari log Anda bisa membukanya di WhatsApp secara manual.", "WhatsApp is in simulation: messages are logged (Automation) and not sent. From the log you can open one in WhatsApp yourself.")}</span></p>`;
  },
  rowActions(b, s, opts = {}) {
    const pdf = opts.noPdf ? "" : `<button class="icon-btn" data-inv="${b.id}" title="${tt("Unduh PDF", "Download PDF")}" aria-label="${tt("Unduh PDF", "Download PDF")}">${ICON.download}</button>`;
    if (this.ro || b.state !== "open") return pdf;
    return `<button class="btn sm" data-pay="${b.id}">${tt("Catat", "Record")}</button> <button class="btn sm" data-op="link:${b.dbId}">${tt("Link bayar", "Pay link")}</button> <button class="icon-btn wa-send" data-op="wa:${b.dbId}" title="${tt("Kirim Ulang WhatsApp", "Resend WhatsApp")}" aria-label="${tt("Kirim Ulang WhatsApp", "Resend WhatsApp")} ${b.roomId}">${WA_ICON}</button>${b.paid === 0 ? `<button class="icon-btn" data-op="void:${b.dbId}" title="${tt("Batalkan tagihan", "Cancel bill")}" aria-label="${tt("Batalkan tagihan", "Cancel bill")} ${b.id}">✕</button>` : ""}${pdf}`;
  },

  /* ----- API helper ----- */
  async call(action, json, btn) {
    if (btn) btn.disabled = true;
    const r = await api("kos.php?action=" + action, { method: "POST", json });
    if (btn) btn.disabled = false;
    if (r.status === 401) { closeModal(); this.lost(); return null; }
    if (!r.ok) { toast(r.message || tt("Permintaan gagal.", "The request failed."), 5500); return null; }
    return r;
  },
  waToast(w) { const t = this.waText(w); if (t) toast(t, 4500); },
  waText(w) {
    if (!w) return "";
    const m = { simulated: tt("Pesan WhatsApp dicatat (simulasi, tidak dikirim).", "WhatsApp message logged (simulation, not sent)."), sent: tt("Pesan WhatsApp terkirim lewat Cloud API.", "WhatsApp message sent through the Cloud API."), failed: tt(`WhatsApp gagal: ${w.error || ""}`, `WhatsApp failed: ${w.error || ""}`), skipped: w.reason === "no_phone" ? tt("Nomor WhatsApp penghuni belum diisi, pesan tidak dibuat.", "The tenant has no WhatsApp number; no message was made.") : tt("Pesan dilewati.", "Message skipped."), duplicate: tt("Pesan ini sudah pernah dikirim.", "That message was already sent.") };
    return m[w.status] || w.status;
  },

  /* ----- Views that differ from the demo ----- */
  v_overview() {
    if (!KOS.D.tenants.length) return `<div class="empty ops-empty"><h3>${tt("Belum ada penghuni", "No tenants yet")}</h3><p>${tt("Data operasional dimulai kosong dan terpisah dari demo. Mulai dari menu Kamar: pilih kamar kosong lalu daftarkan penghuni. Atur harga dasar, model keuntungan, dan pengingat di Pengaturan.", "Live data starts empty and separate from the demo. Start in Rooms: pick a vacant room and check a tenant in. Set base prices, the profit model and reminders in Settings.")}</p>
      ${this.ro ? "" : `<p style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn primary" data-kv="rooms">${tt("Buka Kamar", "Open Rooms")}</button><button class="btn" data-kv="settings">${tt("Pengaturan", "Settings")}</button><button class="btn" data-kv="auto">${tt("Impor penghuni uji", "Import test tenant")}</button></p>`}</div>`;
    return DEMO_PAGE.v_overview.call(this);
  },
  v_reports() {
    if (!KOS.D.bills.length) return `<div class="empty"><h3>${tt("Belum ada tagihan", "No bills yet")}</h3><p>${tt("Laporan muncul setelah tagihan pertama dibuat.", "Reports appear once the first bill exists.")}</p></div>`;
    return DEMO_PAGE.v_reports.call(this);
  },
  v_bills() {
    if (!KOS.D.bills.length) return `<div class="empty"><h3>${tt("Belum ada tagihan", "No bills yet")}</h3><p>${tt("Tagihan pertama dibuat saat penghuni didaftarkan. Tagihan bulanan berikutnya dibuat oleh tombol Generate Tagihan atau cron harian.", "The first bill is made at check-in. Later monthly bills come from Generate bills or the daily cron.")}</p>${this.ro ? "" : `<p><button class="btn" data-kv="auto">${tt("Buka Otomatisasi", "Open Automation")}</button></p>`}</div>`;
    return DEMO_PAGE.v_bills.call(this);
  },
  v_tenants() {
    const f = this.f.tenants, q = f.q.trim().toLowerCase(), today = KOS.today();
    const list = KOS.D.tenants.filter((t) => t.active && (!q || t.name.toLowerCase().includes(q) || t.roomId.toLowerCase().includes(q) || (t.phone || "").includes(q)))
      .sort((a, b) => a.roomId.localeCompare(b.roomId, "en", { numeric: true }));
    const per = 50, page = list.slice(f.page * per, f.page * per + per), cur = today.slice(0, 7);
    const lease = (t) => { if (!t.paidUntil) return `<span class="muted">${tt("belum ada pembayaran", "nothing paid yet")}</span>`; const d = Math.round((new Date(t.paidUntil) - new Date(today)) / 86400000); return `${tt("s.d.", "until")} ${tgl(t.paidUntil)}<br><span class="${d < 0 ? "bad-t" : "muted"}" style="font-size:12px">${d < 0 ? tt(`lewat ${-d} hari`, `${-d} days ago`) : tt(`sisa ${d} hari`, `${d} days left`)}</span>`; };
    return `<div class="toolbar">
      <label class="search"><span class="sr">${tt("Cari penghuni", "Search tenants")}</span>${ICON.search}<input class="input" id="kt-q" type="search" placeholder="${tt("Nama, kamar, atau telepon", "Name, room or phone")}" value="${esc(f.q)}"></label>
      <button class="btn sm" data-act="csv-tenants">${ICON.download} ${tt("Ekspor CSV", "Export CSV")}</button>
      <button class="btn sm" data-kv="archive">${tt("Arsip penghuni", "Tenant archive")}</button>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>${tt("Penghuni", "Tenant")}</th><th>${tt("Kamar", "Room")}</th><th>WhatsApp</th><th>${tt("Jatuh tempo", "Due every")}</th><th>${tt("Masa sewa aktif", "Active lease")}</th><th>${tt("Tagihan", "Bill")} ${KOS.monthLabel(cur, true)}</th><th></th></tr></thead><tbody>
      ${page.map((t) => { const r = KOS.IX.room[t.roomId] || {}; const b = (KOS.IX.billsByTenant[t.id] || []).find((x) => x.month <= cur && x.monthEnd >= cur); const s = b ? KOS.status(b) : null;
        return `<tr><td><b>${esc(t.name)}</b> <span class="muted mono" style="font-size:11px">${t.id}</span>${t.source === "import" ? ` <span class="pill plain">${tt("impor", "imported")}</span>` : ""}<br><span class="muted" style="font-size:12px">${tt("masuk", "since")} ${tgl(t.checkIn)}</span></td><td><button class="btn ghost sm mono" style="padding:2px 4px" data-room="${t.roomId}">${t.roomId}</button> ${typeChip(r.type || "Regular")}</td>
          <td class="num">${t.phone && phoneOk(t.phone) ? esc(t.phone) : `<span class="pill warn">${tt("belum diisi", "missing")}</span>`}</td><td>${t.dueDay ? tt(`tgl ${t.dueDay}`, `day ${t.dueDay}`) : `<span class="pill warn">${tt("belum diisi", "missing")}</span>`}</td><td class="num">${lease(t)}</td>
          <td>${s ? statusPill(s) + (b.months > 1 ? ` <span class="muted" style="font-size:11.5px">${b.months} ${tt("bln", "mo")}</span>` : "") : `<span class="muted">${tt("Belum ada", "None")}</span>`}</td>
          <td style="white-space:nowrap;text-align:right"><button class="btn sm" data-op="prepay:${t.dbId}">${tt("Bayar di muka", "Prepay")}</button> <button class="btn sm ghost" data-op="edit:${t.dbId}">${tt("Ubah", "Edit")}</button></td></tr>`; }).join("") || `<tr><td colspan="7" class="muted" style="padding:24px">${KOS.D.tenants.some((t) => t.active) ? tt("Tidak ada penghuni yang cocok.", "No tenants match.") : tt("Belum ada penghuni aktif. Daftarkan dari menu Kamar.", "No current tenants. Check one in from Rooms.")}</td></tr>`}
    </tbody></table></div>${this.pager("tenants", list.length, per)}`;
  },
  v_archive() {
    const past = KOS.D.tenants.filter((t) => !t.active).sort((a, b) => (b.checkOut || "").localeCompare(a.checkOut || ""));
    return `<p class="muted" style="margin:0">${tt("Penghuni yang sudah checkout. Tagihan mereka tetap tersimpan untuk audit dan laporan, tetapi tidak pernah tampil sebagai riwayat penghuni baru di kamar yang sama.", "Tenants who moved out. Their bills are kept for audit and reports, but never shown as the history of the next tenant in the same room.")}</p>
    <div class="table-wrap"><table class="t"><thead><tr><th>${tt("Penghuni", "Tenant")}</th><th>${tt("Kamar", "Room")}</th><th>${tt("Masa tinggal", "Stay")}</th><th class="r">${tt("Tagihan", "Bills")}</th><th class="r">${tt("Ditagihkan", "Billed")}</th><th class="r">${tt("Tunggakan", "Owed")}</th><th></th></tr></thead><tbody>
    ${past.map((t) => { const bl = KOS.IX.billsByTenant[t.id] || []; const owed = bl.reduce((a, b) => a + KOS.balance(b), 0);
      return `<tr><td><b>${esc(t.name)}</b> <span class="muted mono" style="font-size:11px">${t.id}</span></td><td class="mono">${t.roomId}</td><td class="num">${tgl(t.checkIn)} → ${tgl(t.checkOut)}</td><td class="r num">${bl.length}</td><td class="r num">${idr(bl.reduce((a, b) => a + b.rent, 0))}</td><td class="r num" style="${owed ? "color:var(--bad)" : ""}">${owed ? idr(owed) : "—"}</td><td style="text-align:right"><button class="btn sm" data-op="arch:${t.dbId}">${tt("Lihat tagihan", "View bills")}</button></td></tr>`; }).join("") || `<tr><td colspan="7" class="muted" style="padding:24px">${tt("Belum ada penghuni yang checkout.", "Nobody has moved out yet.")}</td></tr>`}
    </tbody></table></div>`;
  },
  v_profit() {
    const st = OPS.st, model = st.settings.profit_model;
    const comm = st.commissions || [], cur = KOS.today().slice(0, 7), y = cur.slice(0, 4);
    const commAll = comm.reduce((a, c) => a + +c.total, 0), commN = comm.reduce((a, c) => a + +c.n, 0);
    const commMonth = comm.filter((c) => c.period === cur).reduce((a, c) => a + +c.total, 0);
    const commYear = comm.filter((c) => c.period.slice(0, 4) === y).reduce((a, c) => a + +c.total, 0);
    const mk = KOS.D.bills.filter((b) => b.model === "markup");
    const mkReal = mk.filter((b) => b.state === "paid").reduce((a, b) => a + b.profit, 0), mkOpen = mk.filter((b) => b.state === "open").reduce((a, b) => a + b.profit, 0);
    const periods = [...new Set(comm.map((c) => c.period).concat(mk.map((b) => b.month)))].sort().reverse().slice(0, 12);
    return `<div class="panel card-pad"><div class="card-title"><h3>${tt("Model keuntungan aktif", "Active profit model")}</h3>${this.ro ? "" : `<button class="btn sm" data-kv="settings">${tt("Ubah di Pengaturan", "Change in Settings")}</button>`}</div>
      <p style="margin:0"><b>${model === "markup" ? tt("Markup harga kamar", "Room price markup") : tt(`Komisi ${idr(st.settings.commission_amount)} per pelanggan per bulan`, `Commission ${idr(st.settings.commission_amount)} per tenant per month`)}</b></p>
      <div class="table-wrap" style="border:0"><table class="t" style="min-width:0"><thead><tr><th>${tt("Kelas", "Class")}</th><th class="r">${tt("Harga dasar", "Base price")}</th><th class="r">Markup</th><th class="r">${tt("Harga tagihan", "Billed price")}</th></tr></thead><tbody>
      ${st.types.map((t) => `<tr><td>${typeChip(t.type)}</td><td class="r num">${idr(t.base)}</td><td class="r num">${t.markup ? idr(t.markup) : "—"}</td><td class="r num"><b>${idr(t.sale)}</b></td></tr>`).join("")}</tbody></table></div>
      <p class="muted" style="font-size:12.5px;margin:0">${tt("Setiap tagihan menyimpan harga dasar, markup, harga jual, dan model keuntungan saat diterbitkan. Mengganti model tidak mengubah tagihan lama, dan satu tagihan tidak pernah dihitung untuk dua model sekaligus. Komisi dicatat sekali per penghuni per bulan setelah tagihan bulan itu lunas.", "Every bill stores its base price, markup, sale price and profit model when issued. Switching models doesn't change old bills, and no bill counts under both models. Commission is recorded once per tenant per month after that month's bill is paid.")}</p></div>
    <div class="kpi-row">
      <div class="panel kpi"><span class="k-label">${tt("Komisi tercatat", "Commission recorded")}</span><span class="k-val num">${idrShort(commAll)}</span><span class="k-sub">${nf(commN)} ${tt("pelanggan-bulan", "tenant-months")}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Komisi", "Commission")} · ${KOS.monthLabel(cur)}</span><span class="k-val num">${idrShort(commMonth)}</span><span class="k-sub">${tt("tahun ini", "this year")} ${idr(commYear)}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Markup terealisasi", "Markup realised")}</span><span class="k-val num">${idrShort(mkReal)}</span><span class="k-sub">${tt("dari tagihan markup yang lunas", "from paid markup bills")}</span></div>
      <div class="panel kpi"><span class="k-label">${tt("Markup menunggu", "Markup pending")}</span><span class="k-val num">${idrShort(mkOpen)}</span><span class="k-sub">${tt("tagihan markup belum lunas", "unpaid markup bills")}</span></div>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>${tt("Periode", "Period")}</th><th class="r">${tt("Pelanggan dengan komisi", "Tenants with commission")}</th><th class="r">${tt("Komisi", "Commission")}</th><th class="r">${tt("Markup ditagihkan", "Markup billed")}</th><th class="r">${tt("Markup terealisasi", "Markup realised")}</th></tr></thead><tbody>
      ${periods.map((p) => { const c = comm.find((x) => x.period === p); const mb = mk.filter((b) => b.month === p); return `<tr><td>${KOS.monthLabel(p)}</td><td class="r num">${c ? nf(+c.n) : "—"}</td><td class="r num">${c ? idr(+c.total) : "—"}</td><td class="r num">${mb.length ? idr(mb.reduce((a, b) => a + b.profit, 0)) : "—"}</td><td class="r num">${mb.length ? idr(mb.filter((b) => b.state === "paid").reduce((a, b) => a + b.profit, 0)) : "—"}</td></tr>`; }).join("") || `<tr><td colspan="5" class="muted" style="padding:20px">${tt("Belum ada keuntungan tercatat.", "No profit recorded yet.")}</td></tr>`}
    </tbody></table></div>
    ${st.commission_rows ? `<div class="panel card-pad"><div class="card-title"><h3>${tt("Riwayat komisi", "Commission history")}</h3></div>
      <div class="table-wrap" style="border:0"><table class="t" style="min-width:520px"><thead><tr><th>${tt("Dicatat", "Recorded")}</th><th>${tt("Periode", "Period")}</th><th>${tt("Penghuni", "Tenant")}</th><th>${tt("Kamar", "Room")}</th><th class="r">${tt("Jumlah", "Amount")}</th></tr></thead><tbody>
      ${st.commission_rows.slice(0, 60).map((c) => `<tr><td class="num">${dtm(c.created_at)}</td><td>${KOS.monthLabel(c.period)}</td><td>${esc(c.name)}</td><td class="mono">${c.room_id}</td><td class="r num">${idr(+c.amount)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">${tt("Belum ada.", "None yet.")}</td></tr>`}</tbody></table></div></div>` : ""}`;
  },
  v_pays() {
    const st = OPS.st, ig = st.integration, f = this.f.pays, sim = ig.payment.name === "simulation";
    const list = st.payments.filter((p) => !f.status || p.status === f.status);
    const per = 50, page = list.slice(f.page * per, f.page * per + per);
    const pill = { pending: "warn", success: "ok", failed: "bad", expired: "plain" };
    const lbl = { pending: tt("Menunggu", "Pending"), success: tt("Berhasil", "Success"), failed: tt("Gagal", "Failed"), expired: tt("Kedaluwarsa", "Expired") };
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    return `<div class="grid-2">
      <div class="panel card-pad"><div class="card-title"><h3>${tt("Payment gateway", "Payment gateway")}</h3><span class="pill ${ig.payment.live ? "ok" : "warn"}">${ig.payment.live ? tt("aktif", "live") : tt("belum aktif", "not live")}</span></div>
        <dl class="kv">${row("Driver", `<span class="mono">${ig.payment.name}</span>`)}${row("Status", esc(ig.payment.note))}${ig.payment.missing.length ? row(tt("Perlu diisi", "Needs"), ig.payment.missing.map((m) => `<code>${m}</code>`).join(" ")) : ""}${row("Webhook", `<code>${esc((ig.base_url || "(alamat situs)") + "/api/webhook.php?gateway=paypro")}</code>`)}</dl></div>
      <div class="panel card-pad"><div class="card-title"><h3>WhatsApp</h3><span class="pill ${ig.wa.live ? "ok" : "warn"}">${ig.wa.live ? tt("aktif", "live") : tt("simulasi", "simulation")}</span></div>
        <dl class="kv">${row("Driver", `<span class="mono">${ig.wa.name}</span>`)}${row("Status", esc(ig.wa.note))}${ig.wa.missing.length ? row(tt("Perlu diisi", "Needs"), ig.wa.missing.map((m) => `<code>${m}</code>`).join(" ")) : ""}${row("Cron", ig.cron ? tt("CRON_KEY terpasang", "CRON_KEY set") : tt("CRON_KEY belum diisi (min. 24 karakter)", "CRON_KEY not set (24+ characters)"))}${row(tt("Alamat situs", "Site address"), esc(ig.base_url || "—"))}</dl></div>
    </div>
    <p class="muted" style="font-size:13px;margin:0">${tt("Status tagihan menjadi Lunas hanya dari notifikasi gateway yang tanda tangannya valid. Membuka link pembayaran tidak mengubah apa pun. Satu tagihan hanya punya satu link aktif; notifikasi berulang diproses sekali.", "A bill becomes Paid only from a gateway notification with a valid signature. Opening a payment link changes nothing. A bill has one active link at a time; repeated notifications are processed once.")}</p>
    <div class="toolbar"><label><span class="sr">Status</span><select class="select" id="kp-status"><option value="">${tt("Semua status", "Any status")}</option>${Object.keys(lbl).map((k) => `<option value="${k}" ${f.status === k ? "selected" : ""}>${lbl[k]}</option>`).join("")}</select></label></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>${tt("Dibuat", "Created")}</th><th>Invoice</th><th>Gateway</th><th class="r">${tt("Jumlah", "Amount")}</th><th>Status</th><th>${tt("ID transaksi", "Transaction ID")}</th><th>${tt("Berlaku s.d.", "Expires")}</th><th></th></tr></thead><tbody>
      ${page.map((p) => `<tr><td class="num">${dtm(p.created_at)}</td><td class="mono">${p.code}<br><span class="muted" style="font-size:11.5px">${p.room_id}</span></td><td class="mono">${p.gateway}</td><td class="r num">${idr(+p.amount)}</td><td><span class="pill ${pill[p.status]}">${lbl[p.status]}</span>${p.note ? `<br><span class="muted" style="font-size:11.5px">${esc(p.note)}</span>` : ""}</td><td class="mono" style="font-size:12px">${esc(p.ref || "—")}</td><td class="num">${p.expires_at ? dtm(p.expires_at) : "—"}</td>
        <td style="white-space:nowrap;text-align:right">${p.url && p.status === "pending" ? `<button class="btn sm" data-copy="${esc(p.url)}">${tt("Salin link", "Copy link")}</button> ` : ""}${sim && p.gateway === "simulation" && p.status === "pending" ? `<span class="sim-btns"><button class="btn sm" data-op="sim:${p.id}:success">${tt("Simulasi berhasil", "Simulate success")}</button> <button class="btn sm ghost" data-op="sim:${p.id}:failed">${tt("Gagal", "Fail")}</button> <button class="btn sm ghost" data-op="sim:${p.id}:expired">${tt("Kedaluwarsa", "Expire")}</button></span>` : ""}</td></tr>`).join("") || `<tr><td colspan="8" class="muted" style="padding:24px">${tt("Belum ada link pembayaran.", "No payment links yet.")}</td></tr>`}
    </tbody></table></div>${this.pager("pays", list.length, per)}
    <div class="panel card-pad"><div class="card-title"><h3>${tt("Notifikasi gateway (webhook)", "Gateway notifications (webhook)")}</h3></div>
      <div class="table-wrap" style="border:0"><table class="t" style="min-width:560px"><thead><tr><th>${tt("Diterima", "Received")}</th><th>Gateway</th><th>${tt("ID transaksi", "Transaction ID")}</th><th>Status</th><th class="r">${tt("Jumlah", "Amount")}</th><th>${tt("Tanda tangan", "Signature")}</th><th>${tt("Hasil", "Result")}</th></tr></thead><tbody>
      ${st.webhooks.slice(0, 50).map((w) => `<tr><td class="num">${dtm(w.received_at)}</td><td class="mono">${w.gateway}</td><td class="mono" style="font-size:12px">${esc(w.ref || "—")}</td><td>${esc(w.event_status || "—")}</td><td class="r num">${w.amount != null ? idr(+w.amount) : "—"}</td><td>${+w.signature_ok ? `<span class="pill ok">${tt("valid", "valid")}</span>` : `<span class="pill bad">${tt("ditolak", "rejected")}</span>`}</td><td class="mono" style="font-size:12px">${esc(w.result)}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">${tt("Belum ada notifikasi.", "No notifications yet.")}</td></tr>`}</tbody></table></div></div>`;
  },
  v_auto() {
    const st = OPS.st, s = st.settings, cur = KOS.today().slice(0, 7), next = KOS.addMonths(cur, 1);
    const need = KOS.D.tenants.filter((t) => t.active && (!phoneOk(t.phone) || !t.dueDay));
    const f = this.f.wa, q = f.q.trim().toLowerCase();
    const tName = (id) => (KOS.IX.tenant[tidOf(id)] || {}).name || "";
    const wa = st.wa.filter((m) => (!f.kind || m.kind.startsWith(f.kind)) && (!q || tName(m.tenant_id).toLowerCase().includes(q) || m.to_phone.includes(q)));
    const per = 30, page = wa.slice(f.page * per, f.page * per + per);
    const kindL = (k) => k === "issued" ? tt("Tagihan terbit", "Bill issued") : k === "resend" ? tt("Kirim ulang", "Resend") : k === "due_0" ? tt("Jatuh tempo hari ini", "Due today") : k.startsWith("before_") ? `H-${k.slice(7)}` : k.startsWith("after_") ? `H+${k.slice(6)}` : k;
    const stPill = { simulated: "info", sent: "ok", failed: "bad", queued: "plain" };
    const cands = this.importCandidates();
    const billByDb = Object.fromEntries(KOS.D.bills.map((b) => [b.dbId, b]));
    return `<div class="grid-2">
      <div class="panel card-pad"><div class="card-title"><h3>${tt("Generate Tagihan", "Generate bills")}</h3></div>
        <p class="muted" style="font-size:13px;margin:0">${tt("Membuat tagihan bulanan untuk semua penghuni aktif sesuai kelas kamar, harga aktif, dan tanggal jatuh tempo masing-masing. Bulan yang sudah ditagihkan (termasuk yang sudah dibayar di muka) dilewati, jadi aman dijalankan berulang.", "Creates monthly bills for every current tenant from their room class, active price and due day. Months already billed (including prepaid ones) are skipped, so it's safe to run again.")}</p>
        <form data-form="generate" class="toolbar" style="margin:0"><label><span class="sr">${tt("Periode", "Period")}</span><select class="select" name="period"><option value="${cur}">${KOS.monthLabel(cur)}</option><option value="${next}">${KOS.monthLabel(next)}</option></select></label><button class="btn primary" type="submit">${tt("Generate Tagihan", "Generate bills")}</button></form>
        <p class="muted" style="font-size:12.5px;margin:0">${s.send_on_generate ? tt("Tagihan baru langsung dikirim lewat WhatsApp (sesuai mode WhatsApp).", "New bills are sent by WhatsApp right away (in the current WhatsApp mode).") : tt("Pengiriman WhatsApp saat generate dimatikan di Pengaturan.", "Sending on generate is off in Settings.")}</p></div>
      <div class="panel card-pad"><div class="card-title"><h3>${tt("Pengingat jatuh tempo", "Due-date reminders")}</h3></div>
        <p style="margin:0">${tt("Jadwal", "Schedule")}: ${s.reminders_before.map((d) => `<span class="pill plain">${d ? "H-" + d : "H"}</span>`).join(" ")} ${s.reminders_after.map((d) => `<span class="pill warn">H+${d}</span>`).join(" ")}</p>
        <p class="muted" style="font-size:13px;margin:0">${tt("Setiap pengingat dikirim sekali per tagihan. Cron harian menjalankan ini otomatis; tombol di bawah menjalankannya sekarang.", "Each reminder goes out once per bill. The daily cron runs this automatically; the button runs it now.")}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-op="reminders">${tt("Jalankan pengingat sekarang", "Run reminders now")}</button><button class="btn ghost" data-kv="settings">${tt("Ubah jadwal", "Change schedule")}</button></div></div>
    </div>
    ${need.length ? `<div class="panel card-pad need-config"><div class="card-title"><h3>${tt(`Perlu dikonfigurasi (${need.length})`, `Needs setup (${need.length})`)}</h3></div>
      <p class="muted" style="font-size:13px;margin:0">${tt("Penghuni ini tidak bisa menerima tagihan WhatsApp sampai nomornya diisi. Nomor tidak pernah ditebak.", "These tenants can't get WhatsApp bills until a number is entered. Numbers are never guessed.")}</p>
      ${need.map((t) => `<div class="need-row"><span><b>${esc(t.name)}</b> · ${t.roomId} — ${[!phoneOk(t.phone) ? tt("nomor WhatsApp", "WhatsApp number") : "", !t.dueDay ? tt("tanggal jatuh tempo", "due day") : ""].filter(Boolean).join(", ")}</span><button class="btn sm" data-op="edit:${t.dbId}">${tt("Lengkapi", "Complete")}</button></div>`).join("")}</div>` : ""}
    <div class="panel card-pad"><div class="card-title"><h3>${tt("Penghuni uji dari demo", "Test tenant from the demo")}</h3></div>
      <p class="muted" style="font-size:13px;margin:0">${tt("Penghuni yang Anda daftarkan sendiri di demo tersimpan di browser tempat Anda mendaftarkannya, bukan di database. Di sini terbaca otomatis jika ada di browser ini; dari browser lain, ekspor dulu di demo (menu Penghuni → Ekspor untuk Admin) lalu pilih file-nya.", "Tenants you registered yourself in the demo live in that browser, not in the database. They're read here automatically if they're in this browser; from another browser, export them in the demo (Tenants → Export for Admin) and pick the file.")}</p>
      <label class="field" style="max-width:360px"><span>${tt("File ekspor (kostbills-penghuni-saya.json)", "Export file (kostbills-penghuni-saya.json)")}</span><input class="input" id="imp-file" type="file" accept="application/json,.json"></label>
      ${cands.length ? `<div class="table-wrap" style="border:0"><table class="t" style="min-width:640px"><thead><tr><th>${tt("Nama", "Name")}</th><th>WhatsApp</th><th>${tt("Masuk", "Since")}</th><th>${tt("Kamar tujuan", "Target room")}</th><th>${tt("Perlu dilengkapi", "Missing")}</th><th></th></tr></thead><tbody>
        ${cands.map((c, i) => { const miss = [!phoneOk(c.phone) ? tt("nomor WhatsApp", "WhatsApp number") : "", !c.checkIn ? tt("tanggal masuk", "move-in date") : ""].filter(Boolean); const exists = KOS.D.tenants.some((t) => t.active && t.name === c.name && (t.phone || "") === String(c.phone || "").replace(/[\s().-]/g, "").replace(/^\+?62/, "0"));
          return `<tr><td><b>${esc(c.name)}</b><br><span class="muted" style="font-size:11.5px">${c.from === "file" ? tt("dari file", "from file") : tt("dari browser ini", "from this browser")}</span></td><td class="num">${esc(c.phone || "—")}</td><td class="num">${c.checkIn ? tgl(c.checkIn) : "—"}</td><td><input class="input" style="width:96px" data-imp-room="${i}" value="${esc(c.roomId || "")}" aria-label="${tt("Kamar tujuan", "Target room")}"></td><td>${miss.length ? `<span class="pill warn">${miss.join(", ")}</span>` : `<span class="pill ok">${tt("lengkap", "complete")}</span>`}</td><td style="text-align:right">${exists ? `<span class="pill ok">${tt("sudah diimpor", "imported")}</span>` : `<button class="btn sm primary" data-op="import:${i}">${tt("Impor", "Import")}</button>`}</td></tr>`; }).join("")}</tbody></table></div>`
        : `<p class="muted" style="margin:0"><b>${tt("Belum ditemukan data penghuni buatan Anda di browser ini.", "No tenant you registered was found in this browser.")}</b></p>`}
    </div>
    <div class="toolbar">
      <label class="search"><span class="sr">${tt("Cari pesan", "Search messages")}</span>${ICON.search}<input class="input" id="kw-q" type="search" placeholder="${tt("Nama penghuni atau nomor", "Tenant name or number")}" value="${esc(f.q)}"></label>
      <label><span class="sr">${tt("Jenis", "Kind")}</span><select class="select" id="kw-kind"><option value="">${tt("Semua pesan", "All messages")}</option><option value="issued" ${f.kind === "issued" ? "selected" : ""}>${tt("Tagihan terbit", "Bill issued")}</option><option value="before" ${f.kind === "before" ? "selected" : ""}>${tt("Sebelum jatuh tempo", "Before due")}</option><option value="after" ${f.kind === "after" ? "selected" : ""}>${tt("Sesudah jatuh tempo", "After due")}</option><option value="resend" ${f.kind === "resend" ? "selected" : ""}>${tt("Kirim ulang", "Resend")}</option></select></label>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>${tt("Waktu", "Time")}</th><th>${tt("Penghuni", "Tenant")}</th><th>${tt("Jenis", "Kind")}</th><th>${tt("Ke", "To")}</th><th>Status</th><th></th></tr></thead><tbody>
      ${page.map((m) => { const b = billByDb[+m.bill_id]; return `<tr><td class="num">${dtm(m.created_at)}</td><td>${esc(tName(m.tenant_id))}<br><span class="muted mono" style="font-size:11.5px">${b ? b.id : ""}</span></td><td>${kindL(m.kind)}</td><td class="num">${esc(m.to_phone)}</td><td><span class="pill ${stPill[m.status] || "plain"}">${m.status}</span>${m.error ? `<br><span class="muted" style="font-size:11.5px">${esc(m.error)}</span>` : ""}</td>
        <td style="white-space:nowrap;text-align:right"><button class="btn sm ghost" data-op="msg:${m.id}">${tt("Lihat pesan", "View")}</button> ${b && b.state === "open" ? `<button class="btn sm" data-op="wa:${b.dbId}">${tt("Kirim Ulang WhatsApp", "Resend WhatsApp")}</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="6" class="muted" style="padding:24px">${tt("Belum ada pesan.", "No messages yet.")}</td></tr>`}
    </tbody></table></div>${this.pager("wa", wa.length, per)}`;
  },
  v_settings() {
    const s = OPS.st.settings, types = OPS.st.types;
    const pct = (bp) => (+bp || 0) / 100;
    const reg = types[0];
    return `<form data-form="prices" class="panel card-pad"><div class="card-title"><h3>${tt("Harga dasar kamar", "Base room prices")}</h3></div>
      <p class="muted" style="font-size:13px;margin:0">${tt("Harga dasar per kelas. Markup tidak pernah mengubah angka ini. Perubahan hanya berlaku untuk tagihan baru.", "Base price per class. Markup never changes these. Changes apply to new bills only.")}</p>
      <div class="form-grid">${types.map((t) => `<label class="field"><span>${t.type}</span><input class="input num" name="base_${t.type}" type="number" min="100000" step="1000" value="${t.base}" required></label>`).join("")}</div>
      <div><button class="btn primary" type="submit">${tt("Simpan harga dasar", "Save base prices")}</button></div></form>
    <form data-form="profit" class="panel card-pad"><div class="card-title"><h3>${tt("Model keuntungan admin", "Admin profit model")}</h3></div>
      <label class="radio-row"><input type="radio" name="profit_model" value="commission" ${s.profit_model !== "markup" ? "checked" : ""}> <span><b>${tt("Komisi per pelanggan", "Commission per tenant")}</b> — ${tt("tarif kamar tetap harga dasar; admin mencatat komisi untuk setiap penghuni aktif per bulan yang lunas.", "rooms are billed at base price; the admin records a commission for each active tenant per paid month.")}</span></label>
      <label class="field" style="max-width:240px"><span>${tt("Komisi per pelanggan per bulan (Rp)", "Commission per tenant per month (Rp)")}</span><input class="input num" name="commission_amount" type="number" min="0" step="500" value="${s.commission_amount}"></label>
      <label class="radio-row"><input type="radio" name="profit_model" value="markup" ${s.profit_model === "markup" ? "checked" : ""}> <span><b>${tt("Markup harga kamar", "Room price markup")}</b> — ${tt("harga tagihan = harga dasar + markup; keuntungan admin = markup.", "billed price = base + markup; admin profit = the markup.")}</span></label>
      <div class="form-grid">${types.map((t) => `<label class="field"><span>Markup ${t.type} (Rp)</span><input class="input num" name="markup_${t.type}" type="number" min="0" step="500" value="${s.markup[t.type] || 0}"></label>`).join("")}</div>
      <p class="muted" style="font-size:12.5px;margin:0">${tt("Contoh", "Example")}: Regular ${idr(reg.base)} + markup ${idr(s.markup.Regular || 0)} = ${idr(reg.base + (s.markup.Regular || 0))}/${tt("bulan", "month")}.</p>
      <div><button class="btn primary" type="submit">${tt("Simpan model keuntungan", "Save profit model")}</button></div></form>
    <form data-form="longterm" class="panel card-pad"><div class="card-title"><h3>${tt("Pembayaran jangka panjang", "Long-term payment")}</h3></div>
      <p class="muted" style="font-size:13px;margin:0">${tt("Total = harga tagihan per bulan × lama sewa − diskon. Default diskon 0%.", "Total = monthly billed price × months − discount. Discounts default to 0%.")}</p>
      <div class="form-grid"><label class="field"><span>${tt("Diskon 6 bulan (%)", "6-month discount (%)")}</span><input class="input num" name="d6" type="number" min="0" max="50" step="0.5" value="${pct(s.discount_bp["6"])}"></label><label class="field"><span>${tt("Diskon 12 bulan (%)", "12-month discount (%)")}</span><input class="input num" name="d12" type="number" min="0" max="50" step="0.5" value="${pct(s.discount_bp["12"])}"></label></div>
      <p class="muted" style="font-size:12.5px;margin:0">Regular ${idr(reg.sale)}/${tt("bln", "mo")} → 1 ${tt("bln", "mo")} ${idr(reg.sale)} · 6 ${tt("bln", "mo")} ${idr(reg.sale * 6 - Math.round(reg.sale * 6 * pct(s.discount_bp["6"]) / 100))} · 12 ${tt("bln", "mo")} ${idr(reg.sale * 12 - Math.round(reg.sale * 12 * pct(s.discount_bp["12"]) / 100))}</p>
      <label class="field"><span>${tt("Kebijakan refund (ditampilkan saat checkout lebih awal; tidak ada refund otomatis)", "Refund policy (shown on early check-out; nothing is refunded automatically)")}</span><textarea class="input" name="refund_policy" rows="3" minlength="10" maxlength="1000">${esc(s.refund_policy)}</textarea></label>
      <div><button class="btn primary" type="submit">${tt("Simpan", "Save")}</button></div></form>
    <form data-form="wa" class="panel card-pad"><div class="card-title"><h3>${tt("WhatsApp & pengingat", "WhatsApp & reminders")}</h3></div>
      <div class="form-grid"><label class="field"><span>${tt("Kirim sebelum jatuh tempo (hari, pisahkan koma; 0 = hari H)", "Send before due (days, comma separated; 0 = due day)")}</span><input class="input" name="before" value="${s.reminders_before.join(", ")}"></label>
      <label class="field"><span>${tt("Kirim sesudah jatuh tempo (hari)", "Send after due (days)")}</span><input class="input" name="after" value="${s.reminders_after.join(", ")}"></label>
      <label class="field"><span>${tt("Masa berlaku link bayar (jam)", "Payment link lifetime (hours)")}</span><input class="input num" name="ttl" type="number" min="1" max="720" value="${s.link_ttl_hours}"></label></div>
      <label class="radio-row"><input type="checkbox" name="send_on_generate" ${s.send_on_generate ? "checked" : ""}> <span>${tt("Kirim tagihan lewat WhatsApp saat tagihan dibuat", "Send the bill by WhatsApp when it is created")}</span></label>
      <div><button class="btn primary" type="submit">${tt("Simpan", "Save")}</button></div></form>
    <form data-form="general" class="panel card-pad"><div class="card-title"><h3>${tt("Umum", "General")}</h3></div>
      <label class="field" style="max-width:360px"><span>${tt("Nama properti", "Property name")}</span><input class="input" name="property_name" value="${esc(s.property_name)}" minlength="2" maxlength="80"></label>
      <label class="radio-row"><input type="checkbox" name="demo_enabled" ${s.demo_enabled ? "checked" : ""}> <span><b>${tt("Mode demo aktif", "Demo mode on")}</b> — ${tt("peran Pengunjung Demo bisa dipilih. Matikan saat KostBills dipakai untuk data sungguhan.", "the demo visitor role is available. Switch it off when KostBills is used with real data.")}</span></label>
      <div><button class="btn primary" type="submit">${tt("Simpan", "Save")}</button></div></form>`;
  },
  v_users() {
    const users = OPS.st.users;
    return `<div class="table-wrap"><table class="t"><thead><tr><th>Username</th><th>${tt("Peran", "Role")}</th><th>${tt("Dibuat", "Created")}</th><th></th></tr></thead><tbody>
      ${users.map((u) => `<tr><td><b>${esc(u.username)}</b>${u.username === OPS.st.username ? ` <span class="pill plain">${tt("Anda", "you")}</span>` : ""}</td><td><span class="pill ${u.role === "admin" ? "info" : "plain"}">${u.role === "admin" ? "Admin" : "Management"}</span></td><td class="num">${dtm(u.created_at)}</td><td style="text-align:right;white-space:nowrap"><button class="btn sm" data-op="upw:${u.id}">${tt("Atur password", "Set password")}</button>${u.username === OPS.st.username ? "" : ` <button class="btn sm danger" data-op="udel:${u.id}">${tt("Hapus", "Delete")}</button>`}</td></tr>`).join("")}
    </tbody></table></div>
    <form data-form="user" class="panel card-pad"><div class="card-title"><h3>${tt("Tambah akun", "Add an account")}</h3></div>
      <div class="form-grid"><label class="field"><span>Username</span><input class="input" name="username" required pattern="[A-Za-z0-9._\\-]{3,64}" autocomplete="off"></label>
      <label class="field"><span>${tt("Password (min. 10 karakter)", "Password (10+ characters)")}</span><input class="input" name="password" type="password" minlength="10" required autocomplete="new-password"></label>
      <label class="field"><span>${tt("Peran", "Role")}</span><select class="select" name="role"><option value="management">Management</option><option value="admin">Admin</option></select></label></div>
      <p class="muted" style="font-size:12.5px;margin:0">${tt("Password disimpan sebagai hash (password_hash) di database. Tidak ada password bawaan.", "Passwords are stored as hashes (password_hash) in the database. There are no default passwords.")}</p>
      <div><button class="btn primary" type="submit">${tt("Buat akun", "Create account")}</button></div></form>`;
  },
  v_audit() {
    const f = this.f.audit, q = f.q.trim().toLowerCase(), all = OPS.st.audit;
    const actions = [...new Set(all.map((a) => a.action.split(".")[0]))].sort();
    const list = all.filter((a) => (!f.action || a.action.startsWith(f.action + ".")) && (!q || (a.entity_id + " " + a.actor + " " + a.detail).toLowerCase().includes(q)));
    const per = 50, page = list.slice(f.page * per, f.page * per + per);
    return `<div class="toolbar">
      <label class="search"><span class="sr">${tt("Cari log", "Search log")}</span>${ICON.search}<input class="input" id="ka-q" type="search" placeholder="${tt("Invoice, penghuni, pengguna", "Invoice, tenant, user")}" value="${esc(f.q)}"></label>
      <label><span class="sr">${tt("Jenis", "Kind")}</span><select class="select" id="ka-action"><option value="">${tt("Semua aktivitas", "All activity")}</option>${actions.map((a) => `<option value="${a}" ${f.action === a ? "selected" : ""}>${a}</option>`).join("")}</select></label></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>${tt("Waktu", "Time")}</th><th>${tt("Oleh", "By")}</th><th>${tt("Aktivitas", "Activity")}</th><th>${tt("Objek", "Object")}</th><th>${tt("Rincian", "Details")}</th></tr></thead><tbody>
      ${page.map((a) => `<tr><td class="num">${dtm(a.at)}</td><td>${esc(a.actor)}<br><span class="muted" style="font-size:11.5px">${esc(a.role)}</span></td><td class="mono">${esc(a.action)}</td><td class="mono" style="font-size:12px">${esc(a.entity)} ${esc(a.entity_id)}</td><td class="audit-detail">${esc(a.detail || "")}</td></tr>`).join("") || `<tr><td colspan="5" class="muted" style="padding:24px">${tt("Belum ada aktivitas.", "No activity yet.")}</td></tr>`}
    </tbody></table></div>${this.pager("audit", list.length, per)}`;
  },

  /* ----- Room drawer (live data) ----- */
  openRoom(id) {
    if (this.ro) return DEMO_PAGE.openRoom.call(this, id);
    const r = KOS.IX.room[id]; if (!r) return;
    const t = r.tenantId ? KOS.IX.tenant[r.tenantId] : null;
    const bills = KOS.currentBills(r).slice().sort((a, b) => b.month.localeCompare(a.month));
    const past = KOS.D.tenants.filter((x) => x.roomId === id && !x.active);
    const s = OPS.st.settings, sale = r.rent;
    const opt = (m) => { const bp = m > 1 ? +(s.discount_bp[String(m)] || 0) : 0; const sub = sale * m; const tot = sub - Math.round(sub * bp / 10000); return `<option value="${m}">${m} ${tt("bulan", "month" + (m > 1 ? "s" : ""))} · ${idr(tot)}${bp ? ` (${tt("diskon", "discount")} ${bp / 100}%)` : ""}</option>`; };
    const m = openModal({
      title: `${tt("Kamar", "Room")} ${r.id} <span class="pill ${KOS.ROOM_PILL[r.status]}" style="vertical-align:3px;margin-left:6px">${roomLabel(r.status)}</span>`, wide: true,
      body: `<div class="detail-grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
        <dl class="kv"><dt>${tt("Kelas", "Class")}</dt><dd>${typeChip(r.type)}</dd><dt>${tt("Blok / lantai", "Block / floor")}</dt><dd>${tt("Blok", "Block")} ${r.block} · ${tt("Lantai", "Floor")} ${r.floor}</dd><dt>${tt("Harga tagihan", "Billed price")}</dt><dd class="num">${idr(sale)} / ${tt("bulan", "month")}</dd>
          ${t ? `<dt>${tt("Penghuni", "Tenant")}</dt><dd>${esc(t.name)} <span class="muted mono" style="font-size:11px">${t.id}</span></dd><dt>WhatsApp</dt><dd class="num">${phoneOk(t.phone) ? esc(t.phone) : `<span class="pill warn">${tt("belum diisi", "missing")}</span>`}</dd><dt>${tt("Sejak", "Since")}</dt><dd class="num">${tgl(t.checkIn)}</dd><dt>${tt("Jatuh tempo", "Rent due")}</dt><dd>${t.dueDay ? tt(`Tanggal ${t.dueDay} setiap bulan`, `Day ${t.dueDay} of each month`) : "—"}</dd><dt>${tt("Masa sewa dibayar", "Paid until")}</dt><dd class="num">${t.paidUntil ? tgl(t.paidUntil) : "—"}</dd>` : ""}</dl>
        <div style="display:grid;gap:10px;align-content:start">
          ${t ? `<button class="btn" data-op="prepay:${t.dbId}">${tt("Bayar di muka (1/6/12 bulan)", "Prepay (1/6/12 months)")}</button><button class="btn ghost" data-op="edit:${t.dbId}">${tt("Ubah data penghuni", "Edit tenant")}</button><button class="btn danger" data-op="checkout:${t.dbId}">${tt("Checkout penghuni", "Check out tenant")}</button>`
          : r.status !== "Maintenance" ? `<form data-form="checkin" data-room="${r.id}" style="display:grid;gap:8px" novalidate><b>${tt("Daftarkan penghuni baru", "Check in a new tenant")}</b>
            <input class="input" name="name" placeholder="${tt("Nama lengkap", "Full name")}" required minlength="2" maxlength="120">
            <input class="input" name="phone" placeholder="${tt("WhatsApp, mis. 0812-3456-7890", "WhatsApp, e.g. 0812-3456-7890")}" inputmode="tel">
            <input class="input" name="job" placeholder="${tt("Pekerjaan", "Occupation")}" maxlength="80">
            <label class="field"><span>${tt("Tanggal masuk (jatuh tempo di tanggal ini setiap bulan)", "Move-in date (due on this day every month)")}</span><input class="input" name="check_in" type="date" value="${KOS.today()}"></label>
            <label class="field"><span>${tt("Pembayaran pertama", "First payment")}</span><select class="select" name="months">${[1, 6, 12].map(opt).join("")}</select></label>
            <label class="radio-row"><input type="checkbox" name="send_wa" checked> <span>${tt("Kirim tagihan dan link bayar lewat WhatsApp", "Send the bill and payment link by WhatsApp")}</span></label>
            <button class="btn primary" type="submit">${tt("Daftarkan & buat tagihan", "Check in & bill")}</button><p class="muted form-err" hidden style="color:var(--bad)"></p></form>` : ""}
          ${!t ? `<button class="btn sm" data-op="mnt:${r.id}:${r.status === "Maintenance" ? "Vacant" : "Maintenance"}">${r.status === "Maintenance" ? tt("Perbaikan selesai (jadikan kosong)", "Mark repairs done (vacant)") : tt("Tandai sedang diperbaiki", "Mark under maintenance")}</button>` : ""}
        </div></div>
        <div><b style="font-size:14px">${t ? tt(`Tagihan ${t.name}`, `${t.name}'s bills`) : tt("Tagihan", "Bills")}</b>
        <div class="table-wrap" style="margin-top:8px"><table class="t" style="min-width:600px"><thead><tr><th>${tt("Periode", "Period")}</th><th>Invoice</th><th>${tt("Jatuh tempo", "Due")}</th><th class="r">${tt("Jumlah", "Amount")}</th><th class="r">${tt("Sisa", "Balance")}</th><th>Status</th><th></th></tr></thead><tbody>
        ${bills.map((b) => { const st = KOS.status(b); return `<tr><td>${KOS.monthLabel(b.month)}${b.months > 1 ? ` – ${KOS.monthLabel(b.monthEnd)}` : ""}</td><td class="mono">${b.id}</td><td class="num">${tgl(b.due)}</td><td class="r num">${idr(b.rent)}</td><td class="r num">${KOS.balance(b) ? idr(KOS.balance(b)) : "—"}</td><td>${statusPill(st)}</td><td style="text-align:right;white-space:nowrap">${this.rowActions(b, st)}</td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">${t ? tt("Belum ada tagihan.", "No bills yet.") : tt("Kamar kosong: tidak ada penghuni aktif, jadi tidak ada tagihan berjalan.", "Vacant room: no current tenant, so no running bills.")}</td></tr>`}
        </tbody></table></div></div>
        ${past.length ? `<p class="muted" style="font-size:13px">${tt(`${past.length} penghuni sebelumnya ada di Arsip penghuni (tagihan mereka tidak ditampilkan di sini).`, `${past.length} previous tenant(s) are in the Tenant archive (their bills aren't shown here).`)} <button class="btn sm ghost" data-kv="archive">${tt("Buka arsip", "Open archive")}</button></p>` : ""}`,
    });
    m.addEventListener("click", (e) => { if (e.target.closest("[data-kv]")) closeModal(); this.onClick(e, m); });
    m.addEventListener("submit", (e) => { const f = e.target.closest("form[data-form]"); if (f) { e.preventDefault(); this.submitForm(f, m); } });
  },
  savePayment(b, amt, method, date, say) {
    this.call("pay_manual", { bill_id: b.dbId, amount: amt, method, date }).then((r) => {
      if (!r) return;
      closeModal(); toast(tt(`${r.ref} tersimpan · ${idr(amt)}${r.paid_off ? " · lunas" : ""}`, `${r.ref} saved · ${idr(amt)}${r.paid_off ? " · paid" : ""}`)); this.refresh();
    });
  },
  act(a, arg, scope, x) {
    if (a === "gen") { if (this.ro) return; return this.call("generate", { period: arg }).then((r) => { if (!r) return; toast(tt(`${r.created} tagihan dibuat untuk ${KOS.monthLabel(arg)}, ${r.skipped} dilewati.`, `${r.created} bills created for ${KOS.monthLabel(arg)}, ${r.skipped} skipped.`), 4500); Object.assign(this.f.bills, { mo: arg.slice(5, 7), year: arg.slice(0, 4), page: 0 }); this.refresh(); }); }
    if (["reset-demo", "checkout", "checkin", "mnt"].includes(a)) return;
    return DEMO_PAGE.act.call(this, a, arg, scope, x);
  },
  onClick(e, scope) {
    const c = e.target.closest("[data-copy]");
    if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy).then(() => toast(tt("Link disalin.", "Link copied.")), () => toast(c.dataset.copy, 6000)); return; }
    const o = e.target.closest("[data-op]");
    if (o) { e.stopPropagation(); return this.op(o.dataset.op.split(":"), o, scope); }
    return DEMO_PAGE.onClick.call(this, e, scope);
  },
  async op([k, a, b], btn, scope) {
    const T = (id) => KOS.D.tenants.find((t) => t.dbId === +id);
    if (k === "refresh") { await this.refresh(); return toast(tt("Data dimuat ulang.", "Data reloaded.")); }
    if (k === "logout") { await api("auth.php?action=logout", { method: "POST" }); Object.assign(KSESS, { role: null, username: "", csrf: "" }); if (ADMIN.on) stopAdmin(); toast(tt("Anda sudah keluar.", "Signed out.")); return go("kos-role"); }
    if (k === "arch") return this.openArchive(T(a));
    if (k === "msg") { const m = OPS.st.wa.find((x) => +x.id === +a); if (!m) return; const ten = KOS.IX.tenant[tidOf(m.tenant_id)] || {}; return openModal({ title: tt("Isi pesan WhatsApp", "WhatsApp message"), body: `<p class="muted" style="margin:0">${tt("Ke", "To")} ${esc(m.to_phone)} · ${esc(ten.name || "")} · ${m.driver} · ${m.status}</p><pre class="wa-body">${esc(m.body)}</pre>`, foot: `<button class="btn" data-close>${tt("Tutup", "Close")}</button><a class="btn wa" href="${esc(waHref(m.body, m.to_phone))}" target="_blank" rel="noopener">${WA_ICON} ${tt("Buka di WhatsApp (manual)", "Open in WhatsApp (manual)")}</a>` }); }
    if (this.ro) return toast(tt("Peran ini hanya bisa melihat data.", "This role can only view data."));
    if (k === "link") { const r = await this.call("paylink", { bill_id: +a }, btn); if (!r) return; return this.showLink(r); }
    if (k === "wa") { const r = await this.call("wa_send", { bill_id: +a }, btn); if (!r) return; this.waToast(r.wa); return this.refresh(); }
    if (k === "void") return this.confirmVoid(+a);
    if (k === "reminders") { const r = await this.call("reminders_run", {}, btn); if (!r) return; const n = Object.entries(r.result).map(([s, v]) => `${v} ${s}`).join(", "); toast(r.considered ? tt(`${r.considered} pengingat diproses: ${n}.`, `${r.considered} reminders processed: ${n}.`) : tt("Tidak ada tagihan yang dijadwalkan untuk diingatkan hari ini.", "No bills are due for a reminder today."), 5000); return this.refresh(); }
    if (k === "sim") { const r = await this.call("sim_webhook", { payment_id: +a, status: b }, btn); if (!r) return; toast(tt(`Callback simulasi diproses: ${r.result}.`, `Simulated callback processed: ${r.result}.`), 4000); return this.refresh(); }
    if (k === "mnt") { const r = await this.call("room_status", { room: a, status: b }, btn); if (!r) return; closeModal(); await this.refresh(); return this.openRoom(a); }
    if (k === "edit") return this.openEdit(T(a));
    if (k === "prepay") return this.openPrepay(T(a));
    if (k === "checkout") return this.openCheckout(T(a));
    if (k === "import") return this.importOne(+a, btn);
    if (k === "upw") return this.openUserPassword(+a);
    if (k === "udel") { const u = OPS.st.users.find((x) => +x.id === +a); return openModal({ title: tt(`Hapus akun ${u.username}?`, `Delete ${u.username}?`), body: `<p>${tt("Akun ini tidak bisa masuk lagi.", "This account won't be able to sign in.")}</p>`, foot: `<button class="btn" data-close>${tt("Batal", "Cancel")}</button><button class="btn danger" id="ud-yes">${tt("Hapus", "Delete")}</button>`, onMount: (mm) => mm.querySelector("#ud-yes").onclick = async (e) => { const r = await this.call("user_delete", { id: +a }, e.currentTarget); if (r) { closeModal(); toast(tt("Akun dihapus.", "Account deleted.")); this.refresh(); } } }); }
  },
  showLink(r) {
    const sim = r.gateway === "simulation";
    openModal({ title: tt("Link pembayaran", "Payment link"), body: `<p style="margin:0">${tt("Link unik untuk tagihan ini. Kirimkan ke penghuni (atau pakai Kirim Ulang WhatsApp).", "A unique link for this bill. Send it to the tenant (or use Resend WhatsApp).")}</p>
      <input class="input mono" readonly value="${esc(r.url)}" style="width:100%" onfocus="this.select()">
      <p class="muted" style="font-size:12.5px;margin:0">${tt("Berlaku sampai", "Valid until")} ${dtm(r.expires_at)} WIB${r.reused ? " · " + tt("link yang masih berlaku dipakai ulang", "the still-valid link was reused") : ""}. ${sim ? tt("Mode simulasi: tidak ada uang sungguhan.", "Simulation mode: no real money.") : ""}</p>`,
      foot: `<button class="btn" data-close>${tt("Tutup", "Close")}</button><button class="btn" data-copy="${esc(r.url)}">${tt("Salin", "Copy")}</button><a class="btn primary" href="${esc(r.url)}" target="_blank" rel="noopener">${tt("Buka", "Open")}</a>`,
      onMount: (mm) => mm.addEventListener("click", (e) => { const c = e.target.closest("[data-copy]"); if (c) this.onClick(e); }) });
  },
  confirmVoid(id) {
    const b = KOS.D.bills.find((x) => x.dbId === id);
    openModal({ title: tt(`Batalkan ${b.id}?`, `Cancel ${b.id}?`), body: `<p>${tt("Tagihan yang belum menerima pembayaran bisa dibatalkan. Bulannya dibuka lagi sehingga bisa ditagih ulang. Tercatat di log audit.", "A bill with no payment can be cancelled. Its months are released so they can be billed again. It's recorded in the audit log.")}</p><label class="field"><span>${tt("Alasan", "Reason")}</span><input class="input" id="vd-reason" minlength="3" maxlength="200"></label>`,
      foot: `<button class="btn" data-close>${tt("Kembali", "Back")}</button><button class="btn danger" id="vd-yes">${tt("Batalkan tagihan", "Cancel bill")}</button>`,
      onMount: (mm) => mm.querySelector("#vd-yes").onclick = async (e) => { const r = await this.call("void_bill", { bill_id: id, reason: mm.querySelector("#vd-reason").value }, e.currentTarget); if (r) { closeModal(); toast(tt("Tagihan dibatalkan.", "Bill cancelled.")); this.refresh(); } } });
  },
  openArchive(t) {
    if (!t) return;
    const bl = (KOS.IX.billsByTenant[t.id] || []).slice().sort((a, b) => b.month.localeCompare(a.month));
    openModal({ title: `${tt("Arsip", "Archive")} · ${esc(t.name)}`, wide: true, body: `<p class="muted" style="margin:0">${t.roomId} · ${tgl(t.checkIn)} → ${tgl(t.checkOut)} · ${t.id}</p>
      <div class="table-wrap"><table class="t" style="min-width:560px"><thead><tr><th>${tt("Periode", "Period")}</th><th>Invoice</th><th class="r">${tt("Jumlah", "Amount")}</th><th class="r">${tt("Dibayar", "Paid")}</th><th>Status</th><th></th></tr></thead><tbody>
      ${bl.map((b) => `<tr><td>${KOS.monthLabel(b.month)}${b.months > 1 ? ` – ${KOS.monthLabel(b.monthEnd)}` : ""}</td><td class="mono">${b.id}</td><td class="r num">${idr(b.rent)}</td><td class="r num">${idr(b.paid)}</td><td>${statusPill(KOS.status(b))}</td><td><button class="icon-btn" data-inv="${b.id}" aria-label="${tt("Unduh PDF", "Download PDF")}">${ICON.download}</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">${tt("Tidak ada tagihan.", "No bills.")}</td></tr>`}</tbody></table></div>`,
      onMount: (mm) => mm.addEventListener("click", (e) => { const x = e.target.closest("[data-inv]"); if (x) pdfInvoice(KOS.IX.bill[x.dataset.inv]); }) });
  },
  openEdit(t) {
    if (!t) return;
    openModal({ title: `${tt("Ubah penghuni", "Edit tenant")} · ${esc(t.name)}`, body: `<form data-form="edit" data-tid="${t.dbId}" class="form-grid" novalidate>
      <label class="field full"><span>${tt("Nama", "Name")}</span><input class="input" name="name" value="${esc(t.name)}" minlength="2" maxlength="120"></label>
      <label class="field"><span>WhatsApp</span><input class="input" name="phone" value="${esc(t.phone || "")}" inputmode="tel" placeholder="08…"></label>
      <label class="field"><span>${tt("Tanggal jatuh tempo (1–31)", "Due day (1–31)")}</span><input class="input num" name="due_day" type="number" min="1" max="31" value="${t.dueDay || ""}"></label>
      <label class="field full"><span>${tt("Pekerjaan", "Occupation")}</span><input class="input" name="job" value="${esc(t.job || "")}" maxlength="80"></label>
      <p class="muted full" style="font-size:12.5px;margin:0">${tt("Tanggal jatuh tempo baru berlaku untuk tagihan berikutnya.", "A new due day applies to the next bills.")}</p>
      <button type="submit" hidden></button></form>`,
      foot: `<button class="btn" data-close>${tt("Batal", "Cancel")}</button><button class="btn primary" id="ed-save">${tt("Simpan", "Save")}</button>`,
      onMount: (mm) => { mm.querySelector("#ed-save").onclick = () => this.submitForm(mm.querySelector("form"), mm); mm.addEventListener("submit", (e) => { e.preventDefault(); this.submitForm(e.target, mm); }); } });
  },
  openPrepay(t) {
    if (!t) return;
    const mm = openModal({ title: `${tt("Pembayaran jangka panjang", "Long-term payment")} · ${esc(t.name)}`, body: `<div class="seg" role="group" aria-label="${tt("Lama sewa", "Length")}">${[1, 6, 12].map((m) => `<button data-pm="${m}" aria-pressed="${m === 6}">${m} ${tt("bulan", m > 1 ? "months" : "month")}</button>`).join("")}</div><div id="pp-q" class="pp-quote"><p class="muted">${tt("Menghitung…", "Calculating…")}</p></div>
      <label class="radio-row"><input type="checkbox" id="pp-wa" checked> <span>${tt("Kirim rincian dan link bayar lewat WhatsApp", "Send the details and payment link by WhatsApp")}</span></label>`,
      foot: `<button class="btn" data-close>${tt("Batal", "Cancel")}</button><button class="btn primary" id="pp-go" disabled>${tt("Buat tagihan", "Create bill")}</button>` });
    let months = 6;
    const load = async () => {
      mm.querySelector("#pp-go").disabled = true;
      const r = await this.call("prepay_quote", { tenant_id: t.dbId, months }); if (!r) return;
      const q = r.quote;
      mm.querySelector("#pp-q").innerHTML = `<dl class="kv"><dt>${tt("Periode", "Period")}</dt><dd>${KOS.monthLabel(q.period_start)}${months > 1 ? ` – ${KOS.monthLabel(q.period_end)}` : ""} (${months} ${tt("bulan", "mo")})</dd><dt>${tt("Mulai", "Starts")}</dt><dd>${tgl(q.start_date)}</dd><dt>${tt("Berakhir", "Ends")}</dt><dd>${tgl(q.end_date)}</dd><dt>${tt("Harga per bulan", "Per month")}</dt><dd class="num">${idr(q.sale)}${q.markup ? ` <span class="muted" style="font-size:12px">(${tt("dasar", "base")} ${idr(q.base)} + markup ${idr(q.markup)})</span>` : ""}</dd><dt>Subtotal</dt><dd class="num">${idr(q.subtotal)}</dd><dt>${tt("Diskon", "Discount")}</dt><dd class="num">${q.discount ? `${idr(q.discount)} (${q.discount_bp / 100}%)` : "—"}</dd><dt><b>Total</b></dt><dd class="num"><b>${idr(q.total)}</b></dd><dt>${tt("Keuntungan admin", "Admin profit")}</dt><dd class="num">${q.model === "markup" ? `${idr(q.profit)} (markup)` : `${idr(q.commission)} (${tt("komisi, dicatat setelah lunas", "commission, recorded once paid")})`}</dd></dl>
        <p class="muted" style="font-size:12.5px;margin:0">${tt("Setelah pembayaran terverifikasi, masa sewa diperpanjang otomatis dan bulan-bulan ini tidak akan ditagih lagi.", "After a verified payment the lease is extended automatically and these months won't be billed again.")}</p>`;
      mm.querySelector("#pp-go").disabled = false;
    };
    mm.addEventListener("click", (e) => { const b = e.target.closest("[data-pm]"); if (!b) return; months = +b.dataset.pm; mm.querySelectorAll("[data-pm]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); load(); });
    mm.querySelector("#pp-go").onclick = async (e) => {
      const r = await this.call("prepay_create", { tenant_id: t.dbId, months, send_wa: mm.querySelector("#pp-wa").checked }, e.currentTarget); if (!r) return;
      closeModal(); toast(tt(`Tagihan ${r.bill.code} dibuat: ${idr(+r.bill.total)}.`, `Bill ${r.bill.code} created: ${idr(+r.bill.total)}.`) + " " + this.waText(r.wa), 5500); this.refresh();
    };
    load();
  },
  openCheckout(t) {
    if (!t) return;
    const bl = KOS.IX.billsByTenant[t.id] || [], owed = bl.reduce((a, b) => a + KOS.balance(b), 0);
    const today = KOS.today();
    const prepaid = bl.filter((b) => b.state === "paid" && b.monthEnd > today.slice(0, 7));
    openModal({ title: `${tt("Checkout", "Check out")} · ${esc(t.name)}`, body: `<dl class="kv"><dt>${tt("Kamar", "Room")}</dt><dd>${t.roomId}</dd><dt>${tt("Tunggakan", "Owed")}</dt><dd class="num">${owed ? idr(owed) : "—"}</dd><dt>${tt("Masa sewa dibayar", "Paid until")}</dt><dd>${t.paidUntil ? tgl(t.paidUntil) : "—"}</dd></dl>
      <label class="field"><span>${tt("Tanggal keluar", "Move-out date")}</span><input class="input" id="co-date" type="date" value="${today}" max="${today}" min="${t.checkIn}"></label>
      <ul class="co-list"><li>${tt("Penghuni menjadi tidak aktif dan kamar dilepas (Kosong).", "The tenant becomes inactive and the room is released (Vacant).")}</li><li>${tt("Tagihan penghuni ini tetap tersimpan di Arsip untuk audit; penghuni berikutnya mulai tanpa riwayat.", "This tenant's bills stay in the Archive for audit; the next tenant starts with no history.")}</li><li>${tt("Tagihan yang belum dibayar untuk bulan setelah tanggal keluar dibatalkan.", "Unpaid bills for months after the move-out date are cancelled.")}</li>${prepaid.length ? `<li><b>${tt("Ada masa sewa yang sudah dibayar di muka.", "Part of the lease was prepaid.")}</b> ${tt("Tidak ada refund otomatis.", "Nothing is refunded automatically.")}</li>` : ""}</ul>
      <div class="refund-policy"><b>${tt("Kebijakan refund", "Refund policy")}</b><p>${esc(OPS.st.settings.refund_policy)}</p></div>`,
      foot: `<button class="btn" data-close>${tt("Batal", "Cancel")}</button><button class="btn danger" id="co-yes">${tt("Proses checkout", "Check out")}</button>`,
      onMount: (mm) => mm.querySelector("#co-yes").onclick = async (e) => {
        const r = await this.call("checkout", { tenant_id: t.dbId, date: mm.querySelector("#co-date").value }, e.currentTarget); if (!r) return;
        closeModal();
        toast(tt(`Checkout selesai. Kamar ${r.room} kosong.${r.prepaid_months_after ? ` ${r.prepaid_months_after} bulan prabayar (± ${idr(r.prepaid_value_after)}) tercatat; refund mengikuti kebijakan admin.` : ""}`, `Checked out. Room ${r.room} is vacant.${r.prepaid_months_after ? ` ${r.prepaid_months_after} prepaid month(s) (≈ ${idr(r.prepaid_value_after)}) noted; refunds follow the admin's policy.` : ""}`), 6500);
        this.refresh();
      } });
  },
  openUserPassword(id) {
    const u = OPS.st.users.find((x) => +x.id === id);
    openModal({ title: `${tt("Atur password", "Set password")} · ${esc(u.username)}`, body: `<label class="field"><span>${tt("Password baru (min. 10 karakter)", "New password (10+ characters)")}</span><input class="input" id="up-pass" type="password" minlength="10" autocomplete="new-password"></label>`,
      foot: `<button class="btn" data-close>${tt("Batal", "Cancel")}</button><button class="btn primary" id="up-save">${tt("Simpan", "Save")}</button>`,
      onMount: (mm) => mm.querySelector("#up-save").onclick = async (e) => { const r = await this.call("user_password", { id, password: mm.querySelector("#up-pass").value }, e.currentTarget); if (r) { closeModal(); toast(tt("Password diperbarui.", "Password updated.")); } } });
  },

  /* ----- Forms ----- */
  async submitForm(f, modal) {
    const kind = f.dataset.form, fd = new FormData(f), btn = f.querySelector("[type=submit]") || (modal && modal.querySelector(".btn.primary"));
    const v = (k) => String(fd.get(k) == null ? "" : fd.get(k)).trim();
    const days = (s) => s.split(/[\s,;]+/).filter(Boolean).map(Number);
    const done = async (msg) => { if (modal) closeModal(); toast(msg, 3500); await this.refresh(); };
    if (kind === "generate") { return this.act("gen", v("period")); }
    if (kind === "prices") {
      const changed = OPS.st.types.filter((t) => +v("base_" + t.type) !== t.base);
      if (!changed.length) return toast(tt("Tidak ada perubahan.", "No changes."));
      for (const t of changed) if (!(await this.call("price", { type: t.type, base_price: +v("base_" + t.type) }, btn))) return;
      return done(tt("Harga dasar disimpan. Berlaku untuk tagihan baru.", "Base prices saved. They apply to new bills."));
    }
    if (kind === "profit") {
      const markup = Object.fromEntries(OPS.st.types.map((t) => [t.type, +v("markup_" + t.type)]));
      if (await this.call("settings", { profit_model: v("profit_model"), commission_amount: +v("commission_amount"), markup }, btn)) return done(tt("Model keuntungan disimpan. Harga dasar tidak berubah; berlaku untuk tagihan baru.", "Profit model saved. Base prices are unchanged; applies to new bills."));
      return;
    }
    if (kind === "longterm") { if (await this.call("settings", { discount_pct: { 6: +v("d6"), 12: +v("d12") }, refund_policy: v("refund_policy") }, btn)) return done(tt("Disimpan.", "Saved.")); return; }
    if (kind === "wa") { if (await this.call("settings", { reminders_before: days(v("before")), reminders_after: days(v("after")), link_ttl_hours: +v("ttl"), send_on_generate: fd.get("send_on_generate") === "on" }, btn)) return done(tt("Jadwal disimpan.", "Schedule saved.")); return; }
    if (kind === "general") { if (await this.call("settings", { property_name: v("property_name"), demo_enabled: fd.get("demo_enabled") === "on" }, btn)) return done(tt("Disimpan.", "Saved.")); return; }
    if (kind === "user") { if (await this.call("user_create", { username: v("username"), password: String(fd.get("password")), role: v("role") }, btn)) { f.reset(); return done(tt("Akun dibuat.", "Account created.")); } return; }
    if (kind === "edit") {
      const fields = { name: v("name"), phone: v("phone"), job: v("job") }; if (v("due_day")) fields.due_day = +v("due_day");
      if (await this.call("tenant_update", { tenant_id: +f.dataset.tid, fields }, btn)) return done(tt("Data penghuni disimpan.", "Tenant saved."));
      return;
    }
    if (kind === "checkin") {
      const err = f.querySelector(".form-err"), say = (x) => { err.textContent = x; err.hidden = false; };
      if (v("name").length < 2) return say(tt("Masukkan nama penghuni.", "Enter the tenant's name."));
      if (v("phone") && !phoneOk(v("phone"))) return say(tt("Nomor WhatsApp tidak valid (08… atau +628…).", "Invalid WhatsApp number (08… or +628…)."));
      const r = await this.call("checkin", { room: f.dataset.room, name: v("name"), phone: v("phone"), job: v("job"), check_in: v("check_in"), months: +v("months"), send_wa: fd.get("send_wa") === "on" }, btn);
      if (!r) return;
      closeModal(); toast(tt(`${r.tenant.name} terdaftar di ${r.tenant.room_id}. Tagihan ${r.bill.code}: ${idr(+r.bill.total)}.`, `${r.tenant.name} checked in to ${r.tenant.room_id}. Bill ${r.bill.code}: ${idr(+r.bill.total)}.`) + " " + this.waText(r.wa), 6000);
      await this.refresh(); return this.openRoom(r.tenant.room_id);
    }
  },

  /* ----- Import of a test tenant registered in the demo ----- */
  importCandidates() {
    const saved = store.get(KOS.KEY, null);
    const local = saved && saved.tenants ? KOS.userTenants(saved).map((t) => ({ ...t, from: "browser" })) : [];
    return local.concat(this.imported);
  },
  readImportFile(input) {
    const file = input.files && input.files[0]; if (!file) return;
    if (file.size > 200000) return toast(tt("File terlalu besar.", "File too large."));
    file.text().then((txt) => {
      let d; try { d = JSON.parse(txt); } catch (e) { return toast(tt("File bukan JSON yang valid.", "That file isn't valid JSON.")); }
      const list = d && d.kind === "kostbills-tenants" && Array.isArray(d.tenants) ? d.tenants : null;
      if (!list) return toast(tt("Ini bukan file ekspor penghuni KostBills.", "That isn't a KostBills tenant export."));
      this.imported = list.slice(0, 50).filter((t) => t && typeof t.name === "string").map((t) => ({ name: t.name.slice(0, 120), phone: String(t.phone || "").slice(0, 20), job: String(t.job || "").slice(0, 80), roomId: String(t.roomId || "").slice(0, 8), checkIn: /^\d{4}-\d{2}-\d{2}$/.test(t.checkIn) ? t.checkIn : "", from: "file" }));
      toast(tt(`${this.imported.length} penghuni terbaca dari file.`, `${this.imported.length} tenant(s) read from the file.`)); this.render();
    });
  },
  async importOne(i, btn) {
    const c = this.importCandidates()[i]; if (!c) return;
    const roomId = ($(`[data-imp-room="${i}"]`) || {}).value || c.roomId;
    if (!phoneOk(c.phone)) toast(tt("Nomor WhatsApp belum valid: penghuni diimpor tanpa nomor, lengkapi di bagian Perlu dikonfigurasi.", "The WhatsApp number isn't valid: imported without one; complete it under Needs setup."), 5000);
    const r = await this.call("checkin", { room: roomId.trim().toUpperCase(), name: c.name, phone: phoneOk(c.phone) ? c.phone : "", job: c.job === "—" ? "" : c.job, check_in: c.checkIn && c.checkIn <= KOS.today() ? c.checkIn : KOS.today(), months: 1, send_wa: false, source: "import" }, btn);
    if (!r) return;
    toast(tt(`${r.tenant.name} diimpor ke ${r.tenant.room_id}. Tagihan ${KOS.monthLabel(r.bill.period_start)} dibuat; kirim lewat Kirim Ulang WhatsApp.`, `${r.tenant.name} imported to ${r.tenant.room_id}. The ${KOS.monthLabel(r.bill.period_start)} bill was made; send it with Resend WhatsApp.`), 6000);
    this.refresh();
  },
});
