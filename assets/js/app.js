/* Application shell: data loading, routing, header / navigation, theme. */
(function () {
  "use strict";
  const OT = (window.OT = window.OT || {});
  const { h, clear } = OT.ui;

  OT.views = OT.views || {};
  const NAV = [
    { id: "overview", label: "Overview" },
    { id: "applications", label: "Applications" },
    { id: "prioritization", label: "Prioritization" },
    { id: "dependencies", label: "Dependencies" },
    { id: "waves", label: "Migration Waves" },
    { id: "business-case", label: "Business Case" },
    { id: "landing-zone", label: "Landing Zone" },
    { id: "risks", label: "Risks" },
  ];

  const state = { model: null, source: null };
  const DEFAULT_SRC = "data/assessment.json";

  // ---------------------------------------------------------------- theme
  function getTheme() {
    try {
      return localStorage.getItem("ot-theme");
    } catch (e) {
      return null;
    }
  }
  function setTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    try {
      t ? localStorage.setItem("ot-theme", t) : localStorage.removeItem("ot-theme");
    } catch (e) {
      /* storage unavailable */
    }
  }
  setTheme(getTheme());
  const isDark = () => {
    const t = document.documentElement.getAttribute("data-theme");
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  };

  // ---------------------------------------------------------------- data loading
  function dataUrl() {
    const p = new URLSearchParams(location.search);
    return p.get("data") || DEFAULT_SRC;
  }
  async function loadFromUrl(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${url}`);
    const json = await res.json();
    useData(json, url);
  }
  function loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          useData(JSON.parse(reader.result), file.name);
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
  function useData(json, source) {
    OT.fmt.setCurrency((json.meta && json.meta.currency) || "USD");
    state.model = OT.model.build(json);
    state.source = source;
    OT.state = state;
    renderShell();
    route();
  }
  function pickFile() {
    const inp = h("input", { type: "file", accept: ".json,application/json", style: { display: "none" } });
    inp.addEventListener("change", () => {
      if (inp.files[0]) loadFromFile(inp.files[0]).catch((e) => showError(e, true));
    });
    document.body.appendChild(inp);
    inp.click();
    setTimeout(() => inp.remove(), 1000);
  }

  // ---------------------------------------------------------------- shell
  const root = () => document.getElementById("app");
  function renderShell() {
    const m = state.model;
    const meta = m.meta;
    const r = clear(root());
    const themeBtn = h("button", { class: "icon-btn", type: "button", title: "Toggle light / dark theme", "aria-label": "Toggle theme" }, isDark() ? "☀" : "☾");
    themeBtn.addEventListener("click", () => {
      setTheme(isDark() ? "light" : "dark");
      themeBtn.textContent = isDark() ? "☀" : "☾";
      route();
    });
    const loadBtn = h("button", { class: "btn btn-on-dark", type: "button", title: "Load a different assessment JSON file" }, "Load JSON");
    loadBtn.addEventListener("click", pickFile);
    const warn = m.warnings.length
      ? h("span", { class: "data-warn", title: m.warnings.join("\n") }, `${m.warnings.length} data note${m.warnings.length > 1 ? "s" : ""}`)
      : null;
    const navToggle = h("button", { class: "icon-btn nav-toggle", type: "button", "aria-label": "Menu" }, "☰");
    const nav = h(
      "nav",
      { class: "nav", "aria-label": "Main" },
      h(
        "div",
        { class: "nav-inner" },
        NAV.map((n) => h("a", { href: `#/${n.id}`, class: "nav-link", dataset: { nav: n.id } }, n.label))
      )
    );
    navToggle.addEventListener("click", () => nav.classList.toggle("open"));
    nav.addEventListener("click", (e) => e.target.closest("a") && nav.classList.remove("open"));
    r.append(
      h(
        "header",
        { class: "topbar" },
        h(
          "div",
          { class: "topbar-inner" },
          h(
            "a",
            { class: "brand", href: "#/overview" },
            h("span", { class: "brand-mark", "aria-hidden": "true" }, h("span"), h("span"), h("span")),
            h("span", { class: "brand-text" }, h("strong", {}, meta.title), h("small", {}, [meta.client, meta.programme].filter(Boolean).join(" · ")))
          ),
          h(
            "div",
            { class: "topbar-meta" },
            h("span", { class: "meta-item", title: `Data source: ${state.source}` }, h("span", { class: "meta-dot" }), ["Data", meta.dataVersion && `v${meta.dataVersion}`, meta.assessmentDate && `· ${OT.fmt.date(meta.assessmentDate)}`].filter(Boolean).join(" ")),
            meta.status ? h("span", { class: "meta-item meta-status" }, meta.status) : null,
            warn,
            loadBtn,
            themeBtn,
            navToggle
          )
        )
      ),
      nav,
      h("main", { id: "view", class: "view", tabindex: "-1" }),
      h("footer", { class: "foot" }, h("span", {}, `Source: ${state.source}`), h("span", {}, [meta.preparedBy && `Prepared by ${meta.preparedBy}`, `${m.portfolio.appCount} applications`].filter(Boolean).join(" · ")))
    );
  }

  // ---------------------------------------------------------------- routing
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, query] = raw.split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    const params = Object.fromEntries(new URLSearchParams(query || ""));
    return { parts, params };
  }
  let lastKey = null;
  function route() {
    if (!state.model) return;
    const { parts, params } = parseHash();
    let name = parts[0] || "overview";
    if (name === "app") name = "app-detail";
    const view = OT.views[name] || OT.views.overview;
    const navId = name === "app-detail" ? "applications" : name;
    document.querySelectorAll(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.nav === navId));
    const host = document.getElementById("view");
    const key = parts.join("/");
    const keepScroll = key === lastKey;
    const sy = window.scrollY;
    clear(host);
    OT.ui.hideTip();
    try {
      view.render(host, state.model, params, parts.slice(1));
    } catch (e) {
      console.error(e);
      host.appendChild(h("div", { class: "error-box" }, h("h2", {}, "This view could not be rendered"), h("p", {}, String(e.message || e)), h("p", { class: "muted" }, "Check that the JSON matches the documented structure (see README).")));
    }
    const nav = NAV.find((n) => n.id === navId);
    document.title = `${nav ? nav.label : "Application"} · ${state.model.meta.title}`;
    if (!keepScroll) window.scrollTo(0, 0);
    else window.scrollTo(0, sy);
    lastKey = key;
  }
  OT.navigate = (hash) => {
    if (location.hash === hash) route();
    else location.hash = hash;
  };
  OT.rerender = route;

  // ---------------------------------------------------------------- errors / landing
  function showError(e, keepShell) {
    console.error(e);
    const r = keepShell && state.model ? document.getElementById("view") : clear(root());
    if (keepShell && state.model) clear(r);
    const pick = h("button", { class: "btn btn-primary", type: "button" }, "Choose JSON file…");
    pick.addEventListener("click", pickFile);
    const drop = h(
      "div",
      { class: "landing" },
      h("div", { class: "landing-card" }, h("span", { class: "brand-mark lg", "aria-hidden": "true" }, h("span"), h("span"), h("span")), h("h1", {}, "Cloud Migration Readiness Assessment"), h("p", {}, "The portal reads all of its content from a single assessment JSON file."), h("p", { class: "error-text" }, String(e && e.message ? e.message : e)), h("p", { class: "muted" }, `Expected file: ${dataUrl()}. When opening index.html directly from disk, browsers block file loading — serve the folder (e.g. "python3 -m http.server") or drop the JSON file here.`), pick, h("div", { class: "drop-hint" }, "…or drag & drop the JSON file anywhere on this page"))
    );
    r.appendChild(drop);
  }
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    document.body.classList.add("dragging");
  });
  document.addEventListener("dragleave", (e) => {
    if (e.target === document.documentElement || e.clientX === 0) document.body.classList.remove("dragging");
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    document.body.classList.remove("dragging");
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFromFile(f).catch((err) => showError(err, true));
  });

  // ---------------------------------------------------------------- boot
  window.addEventListener("hashchange", route);
  let rt;
  let lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (Math.abs(window.innerWidth - lastW) > 40) {
        lastW = window.innerWidth;
        route();
      }
    }, 200);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => !getTheme() && route());

  document.addEventListener("DOMContentLoaded", () => {
    if (!location.hash) history.replaceState(null, "", "#/overview");
    loadFromUrl(dataUrl()).catch((e) => showError(e));
  });
})();
