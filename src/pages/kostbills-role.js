/* ===== KostBills role picker (#kos-role): shown when "Coba Demo KostBills" is clicked ===== */
PAGES["kos-role"] = {
  mount(view) {
    this.el = view;
    view.addEventListener("submit", (e) => { const f = e.target.closest("form[data-login]"); if (f) { e.preventDefault(); this.login(f); } });
    view.addEventListener("click", (e) => { const a = e.target.closest("[data-demo-role]"); if (a) DEMO_ROLE.set(a.dataset.demoRole); });
    this.paint();
    kosPublic().then(() => { if (current === this) this.paint(); });
    if (SERVER) api("auth.php").then((a) => { if (current === this && a.ok && a.role) { this.signed = a; this.paint(); } });
  },
  onLang() { this.paint(); },
  paint() {
    const demoOn = KOS_PUBLIC.demo !== false;
    const signed = this.signed;
    const card = (role, icon, title, desc, rights) => `<article class="role-card" data-role-card="${role}">
      <div class="role-ic" aria-hidden="true">${icon}</div><h2>${title}</h2><p>${desc}</p>
      <ul class="role-rights">${rights.map(([ok, txt]) => `<li class="${ok ? "yes" : "no"}">${ok ? "✓" : "✕"} ${txt}</li>`).join("")}</ul>`;
    /* Demo entry: no password, sample data in this browser only. */
    const demoBtn = (role, label, id) => demoOn
      ? `<a class="btn primary" href="#kos-demo" data-demo-role="${role}" id="${id}">${label} ${ICON.arrow}</a><p class="role-hint">${tt("Tanpa password · data contoh di browser ini", "No password · sample data in this browser")}</p>`
      : `<p class="role-off">${tt("Mode demo sedang dinonaktifkan oleh admin.", "Demo mode is switched off by the admin.")}</p>`;
    /* Live data (Hostinger): a real sign-in, checked by the server. */
    const loginForm = (role) => !SERVER ? ""
      : `<details class="role-live" ${demoOn ? "" : "open"}><summary>${tt(`Login ${role === "admin" ? "Admin" : "Management"} untuk data operasional`, `${role === "admin" ? "Admin" : "Management"} sign-in for live data`)}</summary>
        ${signed ? `<a class="btn" href="#kos-app">${tt(`Lanjut sebagai ${signed.username}`, `Continue as ${signed.username}`)} (${signed.role === "admin" ? "Admin" : "Management"})</a>`
        : `<form data-login="${role}" class="role-form" novalidate autocomplete="on">
          <label class="field"><span>Username</span><input class="input" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
          <label class="field"><span>Password</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
          <p class="role-msg" role="alert" hidden></p>
          <button class="btn" type="submit">${tt("Masuk", "Sign in")}</button>
        </form>`}</details>`;
    const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    this.el.innerHTML = `<div class="kos-hero kos-hero-demo" style="--art:${esc(svgUrl(ART.kost()))}"><div class="wrap kos-hero-in">
        <div style="min-width:0"><a class="kos-back" href="#kos">${ICON.arrow}<span>${tt("Kembali ke halaman KostBills", "Back to the KostBills page")}</span></a>
        <div class="eyebrow">KostBills</div><h1>${tt("Pilih peran", "Choose a role")}</h1>
        <p>${tt("Coba setiap peran tanpa password dengan data contoh. Data operasional sungguhan tetap memerlukan login, dan hak aksesnya diperiksa oleh server.", "Try each role without a password on sample data. Real live data still needs a sign-in, and its rights are checked by the server.")}</p></div>
        ${langSwitch("on-dark")}
      </div></div>
      <div class="wrap role-grid">
        ${card("admin", I('<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>'), "Admin", tt("Mengelola kamar, penghuni, tagihan, dan pembayaran.", "Manages rooms, tenants, bills and payments."),
          [[1, tt("Catat pembayaran, buat tagihan", "Record payments, create bills")], [1, tt("Daftarkan dan checkout penghuni", "Check tenants in and out")], [1, tt("Ekspor CSV, PDF invoice dan laporan", "CSV export, PDF invoices and reports")]])}
          ${demoBtn("admin", tt("Coba sebagai Admin", "Try as Admin"), "role-admin-demo")}${loginForm("admin")}</article>
        ${card("management", I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'), "Management", tt("Melihat kinerja keuangan.", "Reviews financial performance."),
          [[1, tt("Tagihan bulanan", "Monthly bills")], [1, tt("Laporan keuangan", "Financial reports")], [1, tt("Ringkasan dasbor", "Dashboard summary")], [0, tt("Tidak bisa mengubah atau menghapus data", "Cannot change or delete data")]])}
          ${demoBtn("management", tt("Coba sebagai Management", "Try as Management"), "role-mgmt-demo")}${loginForm("management")}</article>
        ${card("visitor", I('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'), tt("Pengunjung Demo", "Demo visitor"), tt("Tanpa login. Melihat semua fitur dengan data contoh untuk presentasi.", "No sign-in. See every feature with sample data, for presentations."),
          [[1, tt("Seluruh fitur demo dengan 1.000 kamar contoh", "Every demo feature with 1,000 sample rooms")], [0, tt("Hanya lihat (read-only)", "View only (read-only)")], [0, tt("Data contoh, terpisah dari data operasional", "Sample data, separate from live data")]])}
          ${demoBtn("visitor", tt("Masuk sebagai Pengunjung Demo", "Enter as demo visitor"), "role-visitor")}</article>
      </div>`;
  },
  async login(form) {
    const msg = form.querySelector(".role-msg"), btn = form.querySelector("button[type=submit]");
    const say = (t) => { msg.textContent = t; msg.hidden = false; };
    const user = form.username.value.trim(), pass = form.password.value;
    if (!user || !pass) return say(tt("Isi username dan password.", "Enter your username and password."));
    btn.disabled = true; msg.hidden = true;
    const r = await api("auth.php?action=login", { method: "POST", json: { username: user, password: pass } });
    btn.disabled = false;
    if (r.ok) {
      Object.assign(KSESS, { role: r.role, username: r.username, csrf: r.csrf });
      if (r.role === "admin") ADMIN.csrf = r.csrf;
      if (r.role !== form.dataset.login) toast(tt(`Akun ini ber-peran ${r.role === "admin" ? "Admin" : "Management"}; hak aksesnya mengikuti peran akun.`, `This account's role is ${r.role === "admin" ? "Admin" : "Management"}; rights follow the account's role.`), 4500);
      go("kos-app"); return;
    }
    form.password.value = "";
    if (r.status === 401) return say(tt(`Username atau password salah. Sisa ${r.attempts_left} percobaan.`, `Wrong username or password. ${r.attempts_left} attempt(s) left.`));
    if (r.status === 429) return say(tt(`Terlalu banyak percobaan. Coba lagi dalam ${Math.max(1, Math.ceil((r.retry_after || 300) / 60))} menit.`, `Too many attempts. Try again in ${Math.max(1, Math.ceil((r.retry_after || 300) / 60))} minute(s).`));
    if (r.status === 503 || r.status === 404) return say(tt("Server belum disiapkan. Buka api/setup.php untuk membuat akun admin.", "The server isn't set up yet. Open api/setup.php to create the admin account."));
    if (r.status === 0) return say(tt("Server tidak bisa dihubungi. Periksa koneksi.", "Couldn't reach the server. Check your connection."));
    say(r.message || tt("Gagal masuk.", "Sign-in failed."));
  },
};
