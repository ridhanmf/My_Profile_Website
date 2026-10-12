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

