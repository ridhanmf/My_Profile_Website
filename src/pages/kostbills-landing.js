/* ===== KostBills landing page (#kos) — bilingual promo page; the live demo lives at #kos-demo ===== */
const KL_TEXT = {
  id: {
    eyebrow: "Sistem manajemen tagihan kos",
    title: ["Tagihan 1.000 kamar kos,", "beres dalam satu layar."],
    lead: "KostBills membantu pengelola kos mencatat kamar dan penghuni, membuat tagihan bulanan secara otomatis, memantau status pembayaran, dan mengirim pengingat jatuh tempo lewat WhatsApp, tanpa tumpukan buku catatan atau spreadsheet.",
    ctaDemo: "Coba Demo KostBills", ctaFeatures: "Lihat fitur", ctaWa: "Tanya via WhatsApp",
    trust: ["Demo gratis tanpa daftar", "Data contoh 1.000 kamar", "Berjalan di browser"],
    mockUrl: "kostbills · dasbor", mockOcc: "Hunian", mockColl: "Terkumpul bulan ini", mockLate: "Terlambat", mockChart: "Ditagihkan vs terkumpul", mockRooms: "Blok A · 100 kamar",
    toastWa: "Pengingat terkirim", toastWaSub: "via WhatsApp", toastPaid: "Lunas",
    classRooms: (t) => `kamar ${t}`, stats: [["pengingat sebelum jatuh tempo", 7, " hari"], ["status pembayaran", 5, ""]],
    statsNote: "Angka ilustratif dari properti demo.",
    pbEyebrow: "Kenapa KostBills", pbTitle: "Dari catatan manual ke sistem yang rapi",
    before: "Tanpa KostBills", after: "Dengan KostBills",
    beforeList: ["Tagihan ditulis ulang setiap bulan di buku atau Excel", "Lupa menagih penghuni yang sudah lewat jatuh tempo", "Rekap pendapatan memakan waktu berhari-hari", "Status kamar kosong tidak pernah pasti"],
    afterList: ["Tagihan seluruh kamar terisi dibuat dengan satu klik", "Status Segera jatuh tempo & Terlambat muncul otomatis", "Laporan per blok dan lantai siap diunduh (PDF/CSV)", "Denah 1.000 kamar dengan warna status terkini"],
    fEyebrow: "Fitur utama", fTitle: "Semua yang dibutuhkan pengelola kos", fLead: "Pilih fitur untuk melihat cara kerjanya.",
    features: {
      rooms: ["Manajemen kamar & penghuni", "Denah per blok dan lantai, data penghuni, check-in dan check-out dalam satu tempat.", ["Denah 10 blok × 4 lantai × 25 kamar", "Kelas kamar Regular, Premium, dan Expensive", "Status Terisi, Kosong, Dipesan, Perbaikan"]],
      bills: ["Tagihan otomatis", "Tagihan bulanan untuk setiap kamar terisi dibuat sekaligus, dengan tarif flat yang jelas.", ["Rp850.000 per bulan, tanpa biaya tambahan", "Listrik memakai token prabayar, tidak ditagihkan", "Invoice dan kuitansi PDF siap unduh"]],
      status: ["Status pembayaran", "Lima status yang dihitung otomatis dari jatuh tempo dan jumlah yang sudah dibayar.", ["Lunas, Dibayar sebagian, Belum bayar", "Segera jatuh tempo (≤ 7 hari) dan Terlambat", "Filter per bulan, tahun, blok, dan status"]],
      reminder: ["Pengingat jatuh tempo", "Tagihan yang mendekati atau melewati jatuh tempo langsung ditandai untuk ditindaklanjuti.", ["Daftar \"Perlu ditindaklanjuti\" di ringkasan", "Hitung mundur hari menuju jatuh tempo", "Jumlah tagihan terlambat di menu samping"]],
      wa: ["Integrasi WhatsApp", "Kirim pesan pengingat yang sudah terisi otomatis: nama, kamar, bulan, dan sisa tagihan.", ["Satu klik dari tabel tagihan", "Teks pengingat sopan dan lengkap", "Langsung terbuka di WhatsApp"]],
      reports: ["Laporan & ekspor", "Pantau pendapatan bulanan dan tahunan, lalu ekspor untuk pembukuan.", ["Ditagihkan vs terkumpul 6 bulan", "Rekap per blok dan per lantai", "Ekspor CSV dan laporan PDF"]],
    },
    pv: {
      roomsLegend: ["Terisi", "Ada tunggakan", "Kosong", "Perbaikan"], tenant: "Penghuni", since: "Masuk", due: "Jatuh tempo", dueDay: "tgl",
      genBtn: "Buat tagihan bulan depan", genDone: "tagihan dibuat", inv: "Invoice", amount: "Jumlah",
      statusRule: { Paid: "Sisa tagihan Rp0", Partial: "Sudah dibayar sebagian, belum jatuh tempo", Unpaid: "Belum dibayar, jatuh tempo > 7 hari", "Due Soon": "Belum lunas, jatuh tempo ≤ 7 hari", Overdue: "Belum lunas, lewat jatuh tempo" },
      timeline: [["H-7", "Masuk daftar Segera jatuh tempo"], ["H-3", "Kirim pengingat WhatsApp"], ["H", "Hari jatuh tempo"], ["H+1", "Ditandai Terlambat & masuk daftar tindak lanjut"]],
      waFrom: "Griya Kos Sejahtera", waTry: "Coba kirim contoh pengingat", waNote: "Pesan contoh dikirim ke nomor pengelola",
      repTitle: "Pendapatan 6 bulan terakhir",
    },
    flowEyebrow: "Alur penggunaan", flowTitle: "Empat langkah, setiap bulan",
    flow: [["Daftarkan kamar & penghuni", "Isi data penghuni saat check-in. Tanggal masuk otomatis menjadi tanggal jatuh tempo bulanan."], ["Tagihan dibuat otomatis", "Satu klik membuat tagihan Rp850.000 untuk semua kamar yang terisi bulan itu."], ["Pantau & ingatkan", "Status diperbarui otomatis. Kirim pengingat WhatsApp untuk tagihan yang segera jatuh tempo atau terlambat."], ["Catat bayar & unduh laporan", "Catat pembayaran, unduh kuitansi PDF, dan ekspor laporan pendapatan untuk pembukuan."]],
    calcEyebrow: "Simulasi pendapatan", calcTitle: "Berapa potensi pendapatan kos Anda?", calcRooms: "Kamar terisi", calcRate: "Tingkat penagihan", calcMonth: "Per bulan", calcYear: "Per tahun", calcNote: "Dihitung dari tarif flat Rp850.000 per kamar per bulan. Hanya ilustrasi.",
    faqTitle: "Pertanyaan umum",
    faq: [["Bagaimana tanggal jatuh tempo ditentukan?", "Jatuh tempo mengikuti tanggal penghuni pertama kali masuk. Penghuni yang masuk tanggal 15 akan jatuh tempo setiap tanggal 15."], ["Apakah demo ini memakai data sungguhan?", "Tidak. Demo berisi 1.000 kamar dengan nama dan nomor contoh. Perubahan yang Anda buat hanya tersimpan di browser Anda dan bisa diatur ulang kapan saja."], ["Bagaimana pengingat WhatsApp bekerja?", "KostBills menyiapkan pesan pengingat lengkap dan membukanya di WhatsApp. Di demo ini, pesan diarahkan ke nomor pengelola, bukan ke nomor penghuni contoh."]],
    endTitle: "Lihat sendiri bagaimana 1.000 kamar dikelola.", endLead: "Buka demo interaktif dengan data lengkap: kamar, penghuni, tagihan, transaksi, dan laporan.",
    waIntro: "Halo, saya tertarik dengan KostBills, sistem manajemen tagihan kos. Boleh minta informasi lebih lanjut?",
  },
  en: {
    eyebrow: "Boarding-house billing system",
    title: ["Billing for 1,000 rooms,", "handled on one screen."],
    lead: "KostBills helps boarding-house managers keep track of rooms and tenants, generate monthly bills automatically, follow payment status, and send due-date reminders over WhatsApp, without notebooks or spreadsheets.",
    ctaDemo: "Try the KostBills Demo", ctaFeatures: "See features", ctaWa: "Ask on WhatsApp",
    trust: ["Free demo, no sign-up", "Sample data for 1,000 rooms", "Runs in the browser"],
    mockUrl: "kostbills · dashboard", mockOcc: "Occupancy", mockColl: "Collected this month", mockLate: "Overdue", mockChart: "Billed vs collected", mockRooms: "Block A · 100 rooms",
    toastWa: "Reminder sent", toastWaSub: "via WhatsApp", toastPaid: "Paid",
    classRooms: (t) => `${t} rooms`, stats: [["reminder before the due date", 7, " days"], ["payment statuses", 5, ""]],
    statsNote: "Illustrative figures from the demo property.",
    pbEyebrow: "Why KostBills", pbTitle: "From manual notes to a tidy system",
    before: "Without KostBills", after: "With KostBills",
    beforeList: ["Bills rewritten every month in a notebook or Excel", "Tenants past their due date get forgotten", "Revenue summaries take days", "Nobody is sure which rooms are vacant"],
    afterList: ["Bills for every occupied room in one click", "Due Soon and Overdue flags appear automatically", "Reports by block and floor, ready as PDF or CSV", "A 1,000-room floor plan with live status colours"],
    fEyebrow: "Key features", fTitle: "Everything a boarding-house manager needs", fLead: "Pick a feature to see how it works.",
    features: {
      rooms: ["Rooms & tenants", "Floor plans per block and floor, tenant records, check-in and check-out in one place.", ["10 blocks × 4 floors × 25 rooms", "Regular, Premium and Expensive room classes", "Occupied, Vacant, Reserved, Maintenance"]],
      bills: ["Automatic billing", "Monthly bills for every occupied room are created at once, with one clear flat rate.", ["Rp850,000 a month, no extra fees", "Electricity is a prepaid token, never billed", "PDF invoices and receipts"]],
      status: ["Payment status", "Five statuses worked out automatically from the due date and the amount paid.", ["Paid, Partially paid, Unpaid", "Due soon (≤ 7 days) and Overdue", "Filter by month, year, block and status"]],
      reminder: ["Due-date reminders", "Bills that are close to or past their due date are flagged for follow-up straight away.", ["\"Needs follow-up\" list on the overview", "Countdown in days to the due date", "Overdue count in the side menu"]],
      wa: ["WhatsApp integration", "Send a pre-filled reminder with the tenant's name, room, month and balance.", ["One click from the bills table", "A polite, complete reminder text", "Opens straight in WhatsApp"]],
      reports: ["Reports & export", "Follow monthly and yearly revenue, then export it for bookkeeping.", ["Billed vs collected over 6 months", "Totals by block and by floor", "CSV export and PDF reports"]],
    },
    pv: {
      roomsLegend: ["Occupied", "Overdue", "Vacant", "Maintenance"], tenant: "Tenant", since: "Moved in", due: "Due", dueDay: "day",
      genBtn: "Generate next month's bills", genDone: "bills created", inv: "Invoice", amount: "Amount",
      statusRule: { Paid: "Balance is Rp0", Partial: "Partly paid, not yet due", Unpaid: "Not paid, due in more than 7 days", "Due Soon": "Not fully paid, due within 7 days", Overdue: "Not fully paid, past the due date" },
      timeline: [["D-7", "Moves to the Due soon list"], ["D-3", "Send a WhatsApp reminder"], ["D", "Due date"], ["D+1", "Marked Overdue and added to follow-up"]],
      waFrom: "Griya Kos Sejahtera", waTry: "Send a sample reminder", waNote: "The sample goes to the manager's number",
      repTitle: "Revenue, last 6 months",
    },
    flowEyebrow: "How it works", flowTitle: "Four steps, every month",
    flow: [["Register rooms & tenants", "Add the tenant at check-in. The move-in date becomes their monthly due date."], ["Bills are generated", "One click creates a Rp850,000 bill for every occupied room that month."], ["Track & remind", "Statuses update on their own. Send WhatsApp reminders for bills that are due soon or overdue."], ["Record payments & report", "Record payments, download PDF receipts and export revenue reports for bookkeeping."]],
    calcEyebrow: "Revenue simulator", calcTitle: "What could your boarding house earn?", calcRooms: "Occupied rooms", calcRate: "Collection rate", calcMonth: "Per month", calcYear: "Per year", calcNote: "Based on the flat Rp850,000 per room per month. Illustration only.",
    faqTitle: "Frequently asked questions",
    faq: [["How is the due date set?", "It follows the tenant's move-in date. Someone who moved in on the 15th is due on the 15th of every month."], ["Does the demo use real data?", "No. The demo has 1,000 rooms with sample names and numbers. Your changes stay in your own browser and can be reset at any time."], ["How do WhatsApp reminders work?", "KostBills prepares a complete reminder and opens it in WhatsApp. In this demo the message goes to the manager's number, not to the sample tenants."]],
    endTitle: "See how 1,000 rooms are managed.", endLead: "Open the interactive demo with full data: rooms, tenants, bills, transactions and reports.",
    waIntro: "Hi, I'm interested in KostBills, the boarding-house billing system. Could you tell me more?",
  },
};
const KL_FEATURES = ["rooms", "bills", "status", "reminder", "wa", "reports"];
const KL_ICON = {
  rooms: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01"/>',
  bills: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  status: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  reminder: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 10c0 2.5 2.5 5 5 5l1.2-1.2-2-1-1 .8a3.6 3.6 0 0 1-1.8-1.8l.8-1-1-2z"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
};
const klSvg = (d, w = 20) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

PAGES.kos = {
  feature: "rooms",
  lang() { return LANG.get(); },
  onLang() { const y = window.scrollY; this.render(); window.scrollTo(0, y); },
  mount(view) {
    KOS.load();
    this.view = view;
    this.render();
    view.addEventListener("click", (e) => this.onClick(e));
    view.addEventListener("input", (e) => { if (e.target.matches(".kl-calc input")) this.calc(); });
  },
  /* Numbers for the dashboard visual come from the same demo dataset the demo page uses. */
  numbers() {
    const D = KOS.D, cur = KOS.ym(new Date()), s = KOS.summary(cur);
    const occ = D.rooms.filter((r) => r.status === "Occupied").length;
    const late = D.bills.filter((b) => KOS.status(b) === "Overdue").length;
    const series = KOS.months().slice(0, 6).reverse().map((m) => KOS.summary(m));
    const blockA = D.rooms.filter((r) => r.block === "A").map((r) => (r.status === "Occupied" && (KOS.IX.billsByRoom[r.id] || []).some((b) => KOS.status(b) === "Overdue")) ? "due" : { Occupied: "occ", Vacant: "vac", Maintenance: "mnt", Reserved: "res" }[r.status]);
    const sample = D.bills.filter((b) => b.month === cur && KOS.status(b) === "Due Soon")[0] || D.bills.find((b) => KOS.balance(b) > 0) || D.bills[0];
    return { occ, occRate: occ / 1000, coll: s.collected, rate: s.rate, late, series, blockA, sample, st: s.st };
  },
  render() {
    const L = this.lang(), T = KL_TEXT[L], N = this.numbers(), view = this.view;
    const loc = L === "id" ? "id-ID" : "en-US";
    const num = (n, d = 0) => Number(n).toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
    const maxS = Math.max(...N.series.map((s) => s.billed)) || 1;
    const sampleT = KOS.IX.tenant[N.sample.tenantId] || {};
    const waReminderText = reminderText(N.sample);
    view.lang = L;
    view.innerHTML = `
    <section class="kl-hero" style="--art:${esc(svgUrl(ART.kost()))}">
      <div class="wrap kl-hero-in">
        <div class="kl-copy">
          <div class="kl-top"><div class="eyebrow">${T.eyebrow}</div>
            ${langSwitch("on-dark")}</div>
          <h1 class="kl-title"><span>${T.title[0]}</span> <span class="kl-hl">${T.title[1]}</span></h1>
          <p class="kl-lead">${T.lead}</p>
          <div class="kl-cta">
            <a class="btn primary kl-btn-demo" href="#kos-demo" id="kl-demo">${T.ctaDemo} ${ICON.arrow}</a>
            <button class="btn kl-btn-ghost" type="button" data-scroll="kl-features">${T.ctaFeatures}</button>
            <a class="btn kl-btn-wa" href="${esc(waHref(T.waIntro))}" target="_blank" rel="noopener">${WA_ICON} ${T.ctaWa}</a>
          </div>
          <ul class="kl-trust">${T.trust.map((x) => `<li>${klSvg('<path d="m5 12 4 4 10-10"/>', 15)}${x}</li>`).join("")}</ul>
        </div>
        <div class="kl-visual" aria-hidden="true">
          <div class="kl-window">
            <div class="kl-bar"><i></i><i></i><i></i><span>${T.mockUrl}</span></div>
            <div class="kl-dash">
              <div class="kl-kpis">
                <div><span>${T.mockOcc}</span><b data-count="${(N.occRate * 100).toFixed(1)}" data-dec="1" data-suffix="%">0%</b></div>
                <div><span>${T.mockColl}</span><b data-count="${(N.coll / 1e6).toFixed(0)}" data-prefix="Rp " data-suffix=" jt">Rp 0 jt</b></div>
                <div><span>${T.mockLate}</span><b class="bad" data-count="${N.late}">0</b></div>
              </div>
              <div class="kl-chart"><span class="kl-cap">${T.mockChart}</span>
                <div class="kl-bars">${N.series.map((s, i) => `<div class="kl-col" style="--d:${i * 70}ms"><i class="b" style="--h:${(s.billed / maxS * 100).toFixed(1)}%"></i><i class="c" style="--h:${(s.collected / maxS * 100).toFixed(1)}%"></i><em>${KOS.monthLabel(s.m, true)}</em></div>`).join("")}</div>
              </div>
              <div class="kl-rooms"><span class="kl-cap">${T.mockRooms}</span><div class="kl-grid">${N.blockA.map((c, i) => `<i class="${c}" style="--d:${(i % 25) * 18 + Math.floor(i / 25) * 60}ms"></i>`).join("")}</div></div>
            </div>
          </div>
          <div class="kl-float kl-float-wa"><span class="kl-fi wa">${WA_ICON}</span><div><b>${T.toastWa}</b><small>${N.sample.roomId} · ${T.toastWaSub}</small></div></div>
          <div class="kl-float kl-float-paid"><span class="kl-fi ok">${klSvg('<path d="m5 12 4 4 10-10"/>', 16)}</span><div><b>${T.toastPaid} · ${idr(KOS.RENT)}</b><small>INV-${KOS.ym(new Date()).replace("-", "").slice(2)}-B214</small></div></div>
        </div>
      </div>
    </section>

    <div class="wrap"><section class="kl-stats reveal" aria-label="${T.statsNote}">
      ${typeCount(KOS.D.rooms).map(([t, n]) => [T.classRooms(t), n, ""]).concat(T.stats).map(([label, n, suf]) => `<div class="kl-stat"><b data-count="${n}" data-suffix="${suf}">0</b><span>${label}</span></div>`).join("")}
      <p class="kl-note">${T.statsNote}</p>
    </section></div>

    <section class="wrap kl-section">
      <div class="kl-head reveal"><div class="eyebrow">${T.pbEyebrow}</div><h2>${T.pbTitle}</h2></div>
      <div class="kl-compare">
        <div class="kl-col-before reveal"><h3>${T.before}</h3><ul>${T.beforeList.map((x) => `<li>${klSvg('<path d="M6 6l12 12M18 6 6 18"/>', 16)}${x}</li>`).join("")}</ul></div>
        <div class="kl-col-after reveal"><h3>${T.after}</h3><ul>${T.afterList.map((x) => `<li>${klSvg('<path d="m5 12 4 4 10-10"/>', 16)}${x}</li>`).join("")}</ul></div>
      </div>
    </section>

    <section class="kl-features-band" id="kl-features">
      <div class="wrap kl-section">
        <div class="kl-head reveal"><div class="eyebrow">${T.fEyebrow}</div><h2>${T.fTitle}</h2><p>${T.fLead}</p></div>
        <div class="kl-feat reveal">
          <div class="kl-tabs" role="tablist" aria-label="${T.fTitle}">${KL_FEATURES.map((k) => `<button role="tab" id="klt-${k}" aria-controls="kl-panel" aria-selected="${this.feature === k}" data-feature="${k}"><span class="kl-ti">${klSvg(KL_ICON[k])}</span><span><b>${T.features[k][0]}</b><small>${T.features[k][1]}</small></span></button>`).join("")}</div>
          <div class="kl-panel" id="kl-panel" role="tabpanel" aria-labelledby="klt-${this.feature}">${this.panel(T, N, num, waReminderText, sampleT)}</div>
        </div>
      </div>
    </section>

    <section class="wrap kl-section">
      <div class="kl-head reveal"><div class="eyebrow">${T.flowEyebrow}</div><h2>${T.flowTitle}</h2></div>
      <ol class="kl-flow">${T.flow.map(([h, p], i) => `<li class="reveal" style="--d:${i * 110}ms"><span class="kl-n">${i + 1}</span><h3>${h}</h3><p>${p}</p></li>`).join("")}</ol>
    </section>

    <section class="wrap kl-section">
      <div class="kl-calc reveal">
        <div><div class="eyebrow">${T.calcEyebrow}</div><h2>${T.calcTitle}</h2>
          <label class="kl-range"><span>${T.calcRooms} <b id="klc-rooms-v"></b></span><input type="range" id="klc-rooms" min="0" max="1000" step="10" value="${Math.round(N.occ / 10) * 10}"></label>
          <label class="kl-range"><span>${T.calcRate} <b id="klc-rate-v"></b></span><input type="range" id="klc-rate" min="50" max="100" step="1" value="95"></label>
          <p class="kl-note">${T.calcNote}</p></div>
        <div class="kl-calc-out"><div><span>${T.calcMonth}</span><b id="klc-month">—</b></div><div><span>${T.calcYear}</span><b id="klc-year">—</b></div></div>
      </div>
    </section>

    <section class="wrap kl-section">
      <div class="kl-head reveal"><h2>${T.faqTitle}</h2></div>
      <div class="kl-faq">${T.faq.map(([q, a], i) => `<details class="reveal" ${i === 0 ? "open" : ""}><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>
    </section>

    <section class="kl-end" style="--art:${esc(svgUrl(ART.kost()))}">
      <div class="wrap kl-end-in reveal">
        <h2>${T.endTitle}</h2><p>${T.endLead}</p>
        <div class="kl-cta"><a class="btn primary kl-btn-demo" href="#kos-demo">${T.ctaDemo} ${ICON.arrow}</a>
          <a class="btn kl-btn-wa" href="${esc(waHref(T.waIntro))}" target="_blank" rel="noopener">${WA_ICON} ${T.ctaWa} · ${waDisplay((adminData().profile || {}).whatsapp)}</a></div>
      </div>
    </section>`;
    this.calc();
    this.animate();
  },
  panel(T, N, num, waText, sampleT) {
    const k = this.feature, F = T.features[k], P = T.pv;
    const head = `<div class="kl-ph"><span class="kl-ti">${klSvg(KL_ICON[k], 22)}</span><div><h3>${F[0]}</h3><p>${F[1]}</p></div></div><ul class="kl-points">${F[2].map((x) => `<li>${klSvg('<path d="m5 12 4 4 10-10"/>', 15)}${x}</li>`).join("")}</ul>`;
    let demo = "";
    if (k === "rooms") {
      demo = `<div class="kl-mini"><div class="kl-legend">${["occ", "due", "vac", "mnt"].map((c, i) => `<span><i class="${c}"></i>${P.roomsLegend[i]}</span>`).join("")}</div>
        <div class="kl-grid big">${N.blockA.map((c) => `<i class="${c}"></i>`).join("")}</div>
        <dl class="kl-tenant"><dt>${P.tenant}</dt><dd>${esc(sampleT.name || "—")} · ${N.sample.roomId} (${(KOS.IX.room[N.sample.roomId] || {}).type || "Regular"})</dd><dt>${P.since}</dt><dd>${tgl(sampleT.checkIn || KOS.today())}</dd><dt>${P.due}</dt><dd>${P.dueDay} ${sampleT.dueDay || 1}</dd></dl></div>`;
    } else if (k === "bills") {
      const list = KOS.D.bills.filter((b) => b.month === KOS.ym(new Date())).slice(0, 4);
      demo = `<div class="kl-mini"><button class="btn primary sm" type="button" data-gen>${klSvg(KL_ICON.bills, 16)} ${P.genBtn}</button><span class="kl-gen" id="kl-gen" hidden></span>
        <table class="kl-tbl"><thead><tr><th>${P.inv}</th><th>${P.tenant}</th><th class="r">${P.amount}</th></tr></thead><tbody>${list.map((b, i) => `<tr style="--d:${i * 90}ms"><td class="mono">${b.id}</td><td>${esc((KOS.IX.tenant[b.tenantId] || {}).name || "")}</td><td class="r num">${idr(b.rent)}</td></tr>`).join("")}</tbody></table></div>`;
    } else if (k === "status") {
      demo = `<div class="kl-mini kl-status">${KOS.STATUSES.map((s) => `<div><span class="pill ${KOS.STATUS_PILL[s]}">${KOS.statusLabel(s)}</span><small>${P.statusRule[s]}</small><b class="num">${num(N.st[s])}</b></div>`).join("")}</div>`;
    } else if (k === "reminder") {
      demo = `<div class="kl-mini"><ol class="kl-timeline">${P.timeline.map(([d, t], i) => `<li class="${i === 3 ? "bad" : i === 2 ? "now" : ""}" style="--d:${i * 120}ms"><b>${d}</b><span>${t}</span></li>`).join("")}</ol></div>`;
    } else if (k === "wa") {
      demo = `<div class="kl-mini kl-chat"><div class="kl-chat-head"><span class="kl-fi wa">${WA_ICON}</span><b>${P.waFrom}</b></div>
        <div class="kl-bubble">${esc(waText)}<time>09.00 ✓✓</time></div>
        <a class="btn kl-btn-wa sm" href="${esc(waHref(waText))}" target="_blank" rel="noopener">${WA_ICON} ${P.waTry}</a><small class="kl-note">${P.waNote} (${waDisplay((adminData().profile || {}).whatsapp)}).</small></div>`;
    } else {
      const max = Math.max(...N.series.map((s) => s.billed)) || 1;
      demo = `<div class="kl-mini"><span class="kl-cap">${P.repTitle}</span><div class="kl-bars tall in">${N.series.map((s, i) => `<div class="kl-col" style="--d:${i * 70}ms"><i class="b" style="--h:${(s.billed / max * 100).toFixed(1)}%"></i><i class="c" style="--h:${(s.collected / max * 100).toFixed(1)}%"></i><em>${KOS.monthLabel(s.m, true)}</em></div>`).join("")}</div>
        <div class="kl-badges"><span>PDF</span><span>CSV</span></div></div>`;
    }
    return `<div class="kl-pin">${head}</div>${demo}`;
  },
  setFeature(k) {
    if (!KL_FEATURES.includes(k) || k === this.feature) return;
    this.feature = k;
    const L = this.lang(), T = KL_TEXT[L], N = this.numbers();
    const loc = L === "id" ? "id-ID" : "en-US";
    const num = (n) => Number(n).toLocaleString(loc);
    $$(".kl-tabs [data-feature]", this.view).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.feature === k)));
    const p = $("#kl-panel", this.view);
    p.setAttribute("aria-labelledby", "klt-" + k);
    p.innerHTML = this.panel(T, N, num, reminderText(N.sample), KOS.IX.tenant[N.sample.tenantId] || {});
    p.classList.remove("swap"); void p.offsetWidth; p.classList.add("swap");
  },
  calc() {
    const r = $("#klc-rooms", this.view), q = $("#klc-rate", this.view); if (!r) return;
    const L = this.lang(), loc = L === "id" ? "id-ID" : "en-US";
    const month = +r.value * KOS.RENT * (+q.value / 100);
    $("#klc-rooms-v", this.view).textContent = (+r.value).toLocaleString(loc);
    $("#klc-rate-v", this.view).textContent = q.value + "%";
    $("#klc-month", this.view).textContent = idrShort(month);
    $("#klc-year", this.view).textContent = idrShort(month * 12);
    r.style.setProperty("--p", (r.value / 10) + "%"); q.style.setProperty("--p", ((q.value - 50) * 2) + "%");
  },
  /* Scroll reveal + count-up. With reduced motion everything is shown at once. */
  animate() {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loc = this.lang() === "id" ? "id-ID" : "en-US";
    const countUp = (el) => {
      const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
      const fmt = (v) => pre + v.toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
      if (reduce) { el.textContent = fmt(to); return; }
      const t0 = performance.now(), dur = 1100;
      const tick = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1 && el.isConnected) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    };
    const show = (el) => { el.classList.add("in"); $$("[data-count]", el).forEach(countUp); };
    if (this.io) this.io.disconnect();
    const hero = $(".kl-hero", this.view);
    if (reduce || !("IntersectionObserver" in window)) { $$(".reveal", this.view).forEach(show); show(hero); return; }
    requestAnimationFrame(() => show(hero));
    this.io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { show(en.target); this.io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    $$(".reveal", this.view).forEach((el) => this.io.observe(el));
  },
  onClick(e) {
    let x;
    if ((x = e.target.closest("[data-feature]"))) return this.setFeature(x.dataset.feature);
    if ((x = e.target.closest("[data-scroll]"))) { const t = document.getElementById(x.dataset.scroll); if (t) t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); return; }
    if (e.target.closest("[data-gen]")) {
      const g = $("#kl-gen", this.view), occ = KOS.D.rooms.filter((r) => r.status === "Occupied").length;
      const L = this.lang();
      g.textContent = `✓ ${occ.toLocaleString(L === "id" ? "id-ID" : "en-US")} ${KL_TEXT[L].pv.genDone} · ${KOS.monthLabel(KOS.addMonths(KOS.ym(new Date()), 1))}`;
      g.hidden = false; g.classList.remove("pop"); void g.offsetWidth; g.classList.add("pop");
    }
  },
  unmount() { if (this.io) this.io.disconnect(); },
};
/* Keyboard support for the feature tabs (arrow keys move between tabs). */
document.addEventListener("keydown", (e) => {
  const tab = e.target.closest && e.target.closest(".kl-tabs [role=tab]"); if (!tab) return;
  const tabs = $$(".kl-tabs [role=tab]"), i = tabs.indexOf(tab);
  const j = e.key === "ArrowDown" || e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : -1;
  if (j < 0) return;
  e.preventDefault(); tabs[j].focus(); PAGES.kos.setFeature(tabs[j].dataset.feature);
});
