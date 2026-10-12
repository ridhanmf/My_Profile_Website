/* ---------- Site data (embedded in the page; the owner's edits republish it) ---------- */
const SITE = (() => {
  try { return JSON.parse(document.getElementById("site-data").textContent); }
  catch (e) { return { v: 1, profile: {}, cars: [] }; }
})();
SITE.cars = SITE.cars || [];

