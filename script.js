/* ============================================
   EDIT YOUR CONTENT HERE
   ============================================ */
const CONTENT = {
  skills: [
    { name: "JavaScript / TypeScript", level: 5, tag: "LANG" },
    { name: "Node.js", level: 5, tag: "RT" },
    { name: "Python", level: 4, tag: "LANG" },
    { name: "PostgreSQL", level: 4, tag: "DB" },
    { name: "Docker", level: 4, tag: "OPS" },
    { name: "AWS", level: 3, tag: "OPS" },
  ],

  projects: [
    {
      num: "Project 1",
      title: "YourMajor Recommedation",
      year: "2026",
      desc: "YourMajor is a Machine Learning project designed to recommend suitable major categories for students based on their academic performance and relevant student data.The project aims to explore how machine learning can be used to help identify potential academic major categories and provide data-driven insights with KNN algorithm machine learning.",
      stack: ["Python", "Pandas", "PostgreSQL", "Streamlit", "Machine Learning", "Docker"],
      image: "images/yourmajor_home.png",
      imagePosition: "75% 15%",
      link: "#",
      linkLabel: "View case study",
    },
    {
      num: "Project 2",
      title: "🚗 Car Logo Classificaton",
      year: "2026",
      desc: "Computer vision project that classifies car logos using a deep learning model and deploys the prediction model through a Streamlit application.",
      stack: ["Python", "TensorFlow", "Keras", "CNN", "Streamlit"],
      link: "#",
      linkLabel: "View repository",
    },
    {
      num: "Project 3",
      title: "✈️ Flight Price Prediction",
      year: "2026",
      desc: "Machine learning project for predicting flight ticket prices based on airline, cities, departure and arrival time, number of stops, flight duration, class, and days before departure",
      stack: ["Python", "Pandas", "Scikit-learn", "Random Forest", "Streamlit"],
      link: "#",
      linkLabel: "View Repository",
    },
    {
      num: "Project 4",
      title: "📱 Google Play Store Data Analysis",
      year: "2026",
      desc: "Data analysis project exploring Google Play Store applications to identify patterns in app categories, installations, pricing, content ratings, and genres.",
      stack: ["Python", "Pandas", "PostgreSQL", "Elasticsearch", "Kibana", "Apache Airflow"],
      link: "#",
      linkLabel: "View Repository",
    },
  ],

  contact: [
    { label: "Email", value: "Ridhanmuhammad25@gmail.com", href: "mailto:ridhanmuhammad25@gmail.com" },
    { label: "GitHub", value: "github.com/RidhanFirdaus", href: "https://github.com/ridhanmf" },
    { label: "LinkedIn", value: "linkedin.com/in/RidhanFirdaus", href: "https://linkedin.com" },
  ],
};

/* ============================================
   RENDERING
   ============================================ */
function renderSkills() {
  const container = document.getElementById("skills-table");
  container.innerHTML = CONTENT.skills.map(skill => {
    const dots = Array.from({ length: 5 }, (_, i) =>
      `<span class="${i < skill.level ? "filled" : ""}"></span>`
    ).join("");
    return `
      <div class="skill-row">
        <span class="skill-name">${skill.name}</span>
        <span>
          <span class="skill-tag">${skill.tag}</span>
          <span class="skill-meter">${dots}</span>
        </span>
      </div>`;
  }).join("");
}

function renderProjects() {
  const container = document.getElementById("project-sheets");
  container.innerHTML = CONTENT.projects.map(p => `
    <article class="sheet" data-sheet-num="${p.num}">
      ${p.image ? `<div class="sheet-image"><img src="${p.image}" alt="${p.title}" style="object-position: ${p.imagePosition || 'center top'};"></div>` : ""}
      <div class="sheet-header">
        <h3 class="sheet-title">${p.title}</h3>
        <span class="sheet-year">${p.year}</span>
      </div>
      <p class="sheet-desc">${p.desc}</p>
      <div class="sheet-stack">
        ${p.stack.map(s => `<span class="stack-chip">${s}</span>`).join("")}
      </div>
      <a class="sheet-link" href="${p.link}">${p.linkLabel}</a>
    </article>
  `).join("");
}

function renderContact() {
  const container = document.getElementById("contact-links");
  container.innerHTML = CONTENT.contact.map(c => `
    <a href="${c.href}" target="_blank" rel="noopener">
      <span>${c.label}</span>
      <span>${c.value}</span>
    </a>
  `).join("");
}

/* ============================================
   HERO CROSSHAIR (follows cursor)
   ============================================ */
function initCrosshair() {
  const hero = document.getElementById("hero");
  const crosshair = hero.querySelector(".hero-crosshair");
  const coord = crosshair.querySelector(".ch-coord");

  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    crosshair.style.setProperty("--cx", `${x}px`);
    crosshair.style.setProperty("--cy", `${y}px`);
    coord.textContent = `X:${String(Math.round(x)).padStart(4, "0")} Y:${String(Math.round(y)).padStart(4, "0")}`;
  });
}

/* ============================================
   NAV: smooth scroll + active link highlight
   ============================================ */
function initNav() {
  const links = document.querySelectorAll(".site-nav a");
  const sections = Array.from(links)
    .map(link => document.getElementById(link.dataset.nav))
    .filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(link => link.classList.remove("active"));
        const active = document.querySelector(`.site-nav a[data-nav="${entry.target.id}"]`);
        if (active) active.classList.add("active");
      }
    });
  }, { rootMargin: "-40% 0px -50% 0px" });

  sections.forEach(section => observer.observe(section));
}

/* ============================================
   MISC: current year
   ============================================ */
function setYear() {
  const year = new Date().getFullYear();
  const revEl = document.getElementById("year-rev");
  const sigEl = document.getElementById("sig-year");
  if (revEl) revEl.textContent = year;
  if (sigEl) sigEl.textContent = year;
}

/* ============================================
   INIT
   ============================================ */
document.addEventListener("DOMContentLoaded", () => {
  renderSkills();
  renderProjects();
  renderContact();
  initCrosshair();
  initNav();
  setYear();
});