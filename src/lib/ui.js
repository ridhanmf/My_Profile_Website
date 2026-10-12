/* ===== UI primitives: toast, modal, clipboard, image upload ===== */
/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, ms = 2600) {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ---------- Modal ---------- */
function openModal({ title, body, foot = "", wide = false, onMount }) {
  closeModal();
  const ov = document.createElement("div");
  ov.className = "overlay"; ov.id = "modal-overlay";
  ov.innerHTML = `<div class="modal${wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-head"><h3 id="modal-title">${title}</h3><button class="icon-btn" data-close aria-label="Close">${ICON.close}</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ""}</div>`;
  ov.addEventListener("mousedown", (e) => { if (e.target === ov) closeModal(); });
  ov.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  document.body.appendChild(ov);
  const m = ov.querySelector(".modal");
  if (onMount) onMount(m);
  const f = m.querySelector("input, select, textarea, button:not([data-close])");
  if (f) setTimeout(() => f.focus(), 30);
  return m;
}
function closeModal() { const o = $("#modal-overlay"); if (o) o.remove(); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); toast("Copied " + text); }
  catch (e) {
    const el = btn && btn.closest(".contact") && btn.closest(".contact").querySelector(".value");
    if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    toast("Press Ctrl+C / ⌘C to copy");
  }
}


/* ---------- Image compression for uploads ---------- */
function compressImage(file, max = 1100, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("read"));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- WhatsApp ----------
   Numbers can be written 0812…, +62 812… or 62812…; wa.me needs the 62… form.
   Every WhatsApp button on the site uses the profile number (Admin → Edit profile). */
const WA_DEFAULT = "081224504181";
const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3c.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';
function waNumber(n) {
  let d = String(n || "").replace(/\D/g, "") || WA_DEFAULT;
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}
const waDisplay = (n) => { const d = "0" + waNumber(n).slice(2); return d.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3"); };
function waHref(text, num) { return `https://wa.me/${waNumber(num || (adminData().profile || {}).whatsapp)}?text=${encodeURIComponent(text)}`; }

/* ---------- Language switch (🇮🇩 ID / 🇬🇧 EN) used by the project pages ---------- */
function langSwitch(extra = "") {
  const l = LANG.get();
  return `<div class="seg lang-switch ${extra}" role="group" aria-label="Bahasa / Language">` +
    `<button type="button" data-setlang="id" aria-pressed="${l === "id"}" title="Bahasa Indonesia"><span aria-hidden="true">🇮🇩</span> ID</button>` +
    `<button type="button" data-setlang="en" aria-pressed="${l === "en"}" title="English"><span aria-hidden="true">🇬🇧</span> EN</button></div>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-setlang]");
  if (b) LANG.set(b.dataset.setlang);
});
