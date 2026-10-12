/* ===== Illustrations (inline SVG, no external images) =====
   Each returns an SVG string; svgUrl() turns it into a CSS background url(). */
const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const ART = {
  /* Data Analyst: dashboard bars, a trend line and a scatter of points */
  data() {
    const bars = [62, 90, 74, 128, 110, 156, 140, 188, 170, 214].map((h, i) => `<rect x="${330 + i * 25}" y="${300 - h}" width="15" height="${h}" rx="3" fill="url(#b)" opacity="${0.55 + i * 0.04}"/>`).join("");
    const pts = [[20, 250], [80, 228], [140, 236], [200, 190], [260, 202], [320, 150], [380, 162], [440, 112], [500, 120], [580, 70]];
    const dots = Array.from({ length: 28 }, (_, i) => `<circle cx="${30 + ((i * 97) % 270)}" cy="${60 + ((i * 53) % 150)}" r="${2 + (i % 3)}" fill="#7dd3fc" opacity=".55"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1633"/><stop offset="1" stop-color="#123a6b"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs><rect width="600" height="340" fill="url(#g)"/><g stroke="#ffffff" stroke-opacity=".07">${Array.from({ length: 12 }, (_, i) => `<line x1="0" x2="600" y1="${i * 30}" y2="${i * 30}"/>`).join("")}${Array.from({ length: 20 }, (_, i) => `<line y1="0" y2="340" x1="${i * 30}" x2="${i * 30}"/>`).join("")}</g>${bars}${dots}<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#fbbf24" stroke-width="3" stroke-linejoin="round"/>${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#0a1633" stroke="#fbbf24" stroke-width="2"/>`).join("")}</svg>`;
  },
  /* NOC Engineer: network topology plus a server rack with status LEDs */
  noc() {
    const N = [[70, 80], [170, 50], [250, 130], [120, 180], [210, 240], [320, 70], [60, 270], [330, 200]];
    const E = [[0, 1], [1, 2], [0, 3], [3, 2], [3, 4], [2, 5], [1, 5], [4, 6], [3, 6], [2, 7], [4, 7], [5, 7]];
    const lines = E.map(([a, b]) => `<line x1="${N[a][0]}" y1="${N[a][1]}" x2="${N[b][0]}" y2="${N[b][1]}"/>`).join("");
    const nodes = N.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 2 ? 11 : 7}" fill="#06141a" stroke="${i === 2 ? "#34d399" : "#5eead4"}" stroke-width="2.5"/>${i === 2 ? `<circle cx="${x}" cy="${y}" r="22" fill="none" stroke="#34d399" stroke-opacity=".35" stroke-width="2"/><circle cx="${x}" cy="${y}" r="34" fill="none" stroke="#34d399" stroke-opacity=".15" stroke-width="2"/>` : ""}`).join("");
    let rack = "";
    for (let u = 0; u < 9; u++) {
      const y = 40 + u * 30;
      rack += `<rect x="420" y="${y}" width="150" height="24" rx="3" fill="#0d2830" stroke="#1f4a54"/>`;
      for (let l = 0; l < 5; l++) rack += `<circle cx="${436 + l * 10}" cy="${y + 12}" r="2.6" fill="${(u * 3 + l) % 7 === 0 ? "#fbbf24" : (u + l) % 5 === 0 ? "#64748b" : "#34d399"}"/>`;
      rack += `<rect x="500" y="${y + 9}" width="56" height="6" rx="2" fill="#16404a"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041015"/><stop offset="1" stop-color="#0b3a40"/></linearGradient></defs><rect width="600" height="340" fill="url(#g)"/><g stroke="#5eead4" stroke-opacity=".45" stroke-width="1.6">${lines}</g>${nodes}<rect x="410" y="28" width="170" height="290" rx="6" fill="#071d23" stroke="#1f4a54"/>${rack}</svg>`;
  },
  /* Web Developer: an editor window with syntax-coloured code lines */
  web() {
    const cols = ["#c084fc", "#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#94a3b8"];
    let code = "";
    const rows = [[0, 90, 0], [1, 140, 1], [2, 60, 2], [2, 120, 3], [1, 80, 4], [2, 160, 1], [3, 70, 3], [2, 110, 0], [1, 50, 5], [0, 40, 0], [0, 130, 1], [1, 100, 4]];
    rows.forEach(([ind, w, c], i) => { const y = 92 + i * 18; code += `<text x="96" y="${y + 5}" font-family="monospace" font-size="10" fill="#475569">${i + 1}</text><rect x="${122 + ind * 18}" y="${y - 2}" width="${w}" height="8" rx="4" fill="${cols[c]}" opacity=".85"/>${w > 90 ? `<rect x="${130 + ind * 18 + w}" y="${y - 2}" width="${w / 3}" height="8" rx="4" fill="${cols[(c + 2) % 6]}" opacity=".7"/>` : ""}`; });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#160c33"/><stop offset="1" stop-color="#3b1361"/></linearGradient></defs><rect width="600" height="340" fill="url(#g)"/><rect x="70" y="40" width="460" height="290" rx="12" fill="#0f0a24" stroke="#4c2a85"/><rect x="70" y="40" width="460" height="32" rx="12" fill="#1c1240"/><circle cx="92" cy="56" r="5" fill="#f87171"/><circle cx="110" cy="56" r="5" fill="#fbbf24"/><circle cx="128" cy="56" r="5" fill="#34d399"/><rect x="200" y="49" width="200" height="14" rx="7" fill="#2a1d55"/>${code}<rect x="350" y="290" width="9" height="16" fill="#e2e8f0" opacity=".8"/></svg>`;
  },
  /* AI Engineer: a layered neural network with glowing nodes */
  ai() {
    const layers = [[4, 70], [6, 210], [6, 370], [3, 520]];
    const pos = layers.map(([n, x]) => Array.from({ length: n }, (_, i) => [x, 170 + (i - (n - 1) / 2) * 46]));
    let edges = "";
    for (let l = 0; l < pos.length - 1; l++) pos[l].forEach(([x1, y1], i) => pos[l + 1].forEach(([x2, y2], j) => { edges += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-opacity="${0.12 + ((i + j) % 4) * 0.08}"/>`; }));
    const nodes = pos.flat().map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="13" fill="#e879f9" opacity=".18"/><circle cx="${x}" cy="${y}" r="7" fill="${i % 3 === 0 ? "#f0abfc" : "#a5b4fc"}"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="g" cx=".5" cy=".45" r=".8"><stop offset="0" stop-color="#2a1250"/><stop offset="1" stop-color="#080b1f"/></radialGradient><linearGradient id="e" x1="0" x2="1"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#e879f9"/></linearGradient></defs><rect width="600" height="340" fill="url(#g)"/><g stroke="url(#e)" stroke-width="1.4">${edges}</g>${nodes}</svg>`;
  },
  /* Diecast collection: an orange toy race track with a loop and a speeding car (generic, no brand marks) */
  track() {
    const speed = Array.from({ length: 9 }, (_, i) => `<line x1="${40 + (i * 53) % 260}" y1="${70 + i * 26}" x2="${130 + (i * 53) % 260}" y2="${70 + i * 26}" stroke="#ffffff" stroke-opacity="${0.08 + (i % 3) * 0.05}" stroke-width="3" stroke-linecap="round"/>`).join("");
    const checker = Array.from({ length: 24 }, (_, i) => { const x = i % 6, y = Math.floor(i / 6); return (x + y) % 2 ? `<rect x="${528 + x * 12}" y="${y * 12}" width="12" height="12" fill="#ffffff" opacity=".85"/>` : ""; }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="g" cx=".75" cy=".3" r=".9"><stop offset="0" stop-color="#1d5bd8"/><stop offset=".55" stop-color="#0b2f86"/><stop offset="1" stop-color="#06173f"/></radialGradient><linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#ff7a1a"/><stop offset="1" stop-color="#ff9a3d"/></linearGradient></defs><rect width="600" height="340" fill="url(#g)"/>${speed}${checker}<circle cx="430" cy="160" r="96" fill="none" stroke="#c24a00" stroke-width="30"/><circle cx="430" cy="160" r="96" fill="none" stroke="url(#t)" stroke-width="22"/><circle cx="430" cy="160" r="96" fill="none" stroke="#ffd2a8" stroke-width="2" stroke-dasharray="10 14" opacity=".8"/><path d="M-20 300 C 140 300 260 300 360 252" fill="none" stroke="#c24a00" stroke-width="30"/><path d="M-20 300 C 140 300 260 300 360 252" fill="none" stroke="url(#t)" stroke-width="22"/><path d="M-20 300 C 140 300 260 300 360 252" fill="none" stroke="#ffd2a8" stroke-width="2" stroke-dasharray="10 14" opacity=".8"/><g transform="translate(150 262) rotate(-4)"><path d="M0 22 L8 10 L40 4 L62 -8 L104 -8 L128 6 L150 10 L156 22 Z" fill="#e11d48"/><path d="M48 3 L64 -4 L100 -4 L118 6 Z" fill="#0f172a" opacity=".85"/><path d="M8 14 L150 14" stroke="#fde047" stroke-width="3"/><circle cx="32" cy="24" r="10" fill="#111827"/><circle cx="32" cy="24" r="4.5" fill="#cbd5e1"/><circle cx="126" cy="24" r="10" fill="#111827"/><circle cx="126" cy="24" r="4.5" fill="#cbd5e1"/></g><g stroke="#ffffff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"><line x1="80" y1="262" x2="130" y2="262"/><line x1="96" y1="276" x2="138" y2="276"/><line x1="70" y1="248" x2="118" y2="250"/></g></svg>`;
  },
  /* KostBills: a modern multi-storey boarding house at dusk */
  kost() {
    let win = "";
    for (let f = 0; f < 5; f++) for (let c = 0; c < 9; c++) {
      const x = 330 + c * 42, y = 92 + f * 46, lit = (f * 7 + c * 3) % 5 < 3;
      win += `<rect x="${x}" y="${y}" width="30" height="30" rx="2" fill="${lit ? "#ffd58a" : "#2b3a55"}" opacity="${lit ? 0.92 : 1}"/>`;
      if (c % 3 === 0) win += `<rect x="${x - 4}" y="${y + 30}" width="38" height="4" fill="#9aa7bd"/>`;
    }
    let win2 = "";
    for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) { const lit = (f + c * 2) % 3 !== 0; win2 += `<rect x="${104 + c * 40}" y="${150 + f * 42}" width="26" height="26" rx="2" fill="${lit ? "#ffcf7a" : "#26324a"}"/>`; }
    const slats = Array.from({ length: 12 }, (_, i) => `<rect x="${704 + i * 6}" y="92" width="3" height="226" fill="#b7793f" opacity=".8"/>`).join("");
    const trees = [[60, 300], [300, 306], [800, 304]].map(([x, y]) => `<rect x="${x - 3}" y="${y - 4}" width="6" height="26" fill="#3b2a1e"/><circle cx="${x}" cy="${y - 18}" r="22" fill="#1f5135"/><circle cx="${x + 12}" cy="${y - 8}" r="16" fill="#2a6b45"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 340" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a4e"/><stop offset=".6" stop-color="#5b4a7a"/><stop offset="1" stop-color="#e59a6b"/></linearGradient></defs><rect width="900" height="340" fill="url(#s)"/><circle cx="160" cy="70" r="26" fill="#ffe2b0" opacity=".55"/><rect x="310" y="70" width="410" height="270" fill="#e9edf3"/><rect x="310" y="62" width="410" height="12" fill="#cfd6e0"/>${win}<rect x="700" y="86" width="80" height="254" fill="#4a5568"/>${slats}<rect x="80" y="130" width="190" height="210" fill="#d9dfe8"/><rect x="80" y="122" width="190" height="10" fill="#b9c2cf"/>${win2}<rect x="150" y="300" width="50" height="40" fill="#7c5a3a"/><rect x="480" y="306" width="70" height="34" fill="#6b4a2f"/><rect x="474" y="300" width="82" height="6" fill="#2d3748"/><rect x="0" y="330" width="900" height="10" fill="#2d3748"/>${trees}</svg>`;
  },
  /* Default home background: a faint blueprint grid with contour lines (replaceable from admin) */
  homeDefault() {
    const contours = Array.from({ length: 7 }, (_, i) => `<path d="M-50 ${120 + i * 40} C 200 ${60 + i * 44}, 420 ${200 + i * 30}, 700 ${110 + i * 42} S 1100 ${160 + i * 36}, 1300 ${100 + i * 40}" fill="none" stroke="#5b7bd5" stroke-opacity="${0.10 + (i % 3) * 0.03}" stroke-width="1.5"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice"><defs><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#5b7bd5" stroke-opacity=".10"/></pattern></defs><rect width="1200" height="600" fill="url(#p)"/>${contours}</svg>`;
  },
};
const CONTACT_ICON = {
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/></svg>',
  location: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
};
const contactKind = (label) => { const l = String(label || "").toLowerCase(); return l.includes("mail") ? "email" : l.includes("insta") ? "instagram" : l.includes("git") ? "github" : l.includes("loc") || l.includes("city") ? "location" : "link"; };
const focusArt = (title) => { const t = String(title || "").toLowerCase(); return t.includes("noc") || t.includes("network") ? "noc" : t.includes("web") ? "web" : t.includes("ai") || t.includes("machine") ? "ai" : "data"; };
