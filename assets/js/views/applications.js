/* 2. Application Portfolio */
(function () {
  "use strict";
  const OT = window.OT;
  const { h, card, pageHead, statusPill, levelPill, strategyChip, waveChip, meter, table, filterBar, setQuery, colors, downloadCSV } = OT.ui;
  const M = OT.model;
  const fmt = OT.fmt;

  // filters understood by this view (also used by drill-down links from other views)
  const KEYS = ["q", "domain", "criticality", "strategy", "wave", "status", "quadrant", "complexity", "risk", "readiness", "location", "pilot"];

  function matches(a, f) {
    if (f.q) {
      const q = f.q.toLowerCase();
      const hay = [a.id, a.name, a.shortName, a.domain, a.businessOwner, a.technicalOwner, a.strategy, a.description, a.hosting.platform, a.hosting.location, a.hosting.datacenter, ...a.technologies.map((t) => t.name)].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.domain && a.domain !== f.domain) return false;
    if (f.criticality && a.criticality !== f.criticality) return false;
    if (f.strategy && a.strategy !== f.strategy) return false;
    if (f.wave && a.waveId !== f.wave) return false;
    if (f.status && a.decisionStatus !== f.status) return false;
    if (f.quadrant && (!a.quadrant || a.quadrant.id !== f.quadrant)) return false;
    if (f.complexity && a.complexityLevel !== f.complexity) return false;
    if (f.risk && a.riskLevel !== f.risk) return false;
    if (f.readiness && a.readinessLevel !== f.readiness) return false;
    if (f.location && a.hosting.location !== f.location && !a.servers.some((s) => s.location === f.location)) return false;
    if (f.pilot && String(a.pilot) !== f.pilot) return false;
    return true;
  }

  function columns(m) {
    const vMax = M.get(m.config, "scales.businessValue.max", 5);
    return [
      { key: "id", label: "ID", render: (a) => h("span", { class: "mono" }, a.id) },
      { key: "name", label: "Application", render: (a) => h("div", { class: "cell-app" }, OT.ui.appLink(a), a.pilot ? h("span", { class: "tag" }, "Pilot") : null, h("small", {}, a.businessFunction)) },
      { key: "domain", label: "Business domain" },
      { key: "owners", label: "Business / Technical owner", value: (a) => a.businessOwner, render: (a) => h("div", { class: "cell-2" }, h("span", {}, a.businessOwner || "—"), h("small", {}, a.technicalOwner || "—")) },
      { key: "criticality", label: "Criticality", value: (a) => ({ High: 3, Medium: 2, Low: 1 }[a.criticality] || 0), csv: (a) => a.criticality, render: (a) => levelPill(a.criticality) },
      { key: "tech", label: "Technology stack", sortable: false, csv: (a) => a.technologies.map((t) => t.name).join("; "), render: (a) => h("div", { class: "tech-list" }, a.technologies.slice(0, 3).map((t) => h("span", { class: `tech ${/end of life/i.test(t.lifecycle || "") ? "eol" : ""}` }, t.name)), a.technologies.length > 3 ? h("span", { class: "tech more" }, `+${a.technologies.length - 3}`) : null) },
      { key: "hosting", label: "Hosting / infrastructure", value: (a) => a.hosting.platform || a.hosting.model, render: (a) => h("div", { class: "cell-2" }, h("span", {}, a.hosting.platform || a.hosting.model || "—"), h("small", {}, `${a.servers.length} servers · ${a.hosting.datacenter || a.hosting.location || ""}`)) },
      { key: "strategy", label: "AWS 7R", render: (a) => strategyChip(m, a.strategy) },
      { key: "cloudReadiness", label: "Cloud readiness", align: "right", render: (a) => meter(a.cloudReadiness, 100, "var(--c1)") },
      { key: "businessValue", label: "Business value", align: "right", render: (a) => meter(a.businessValue, vMax, "var(--c3)") },
      { key: "migrationComplexity", label: "Complexity", value: (a) => a.migrationComplexity, render: (a) => h("span", { class: "cell-2 r" }, levelPill(a.complexityLevel), h("small", {}, fmt.score(a.migrationComplexity))) },
      { key: "migrationRisk", label: "Risk", value: (a) => a.migrationRisk, render: (a) => h("span", { class: "cell-2 r" }, levelPill(a.riskLevel), h("small", {}, fmt.num(a.migrationRisk))) },
      { key: "priorityScore", label: "Priority", align: "right", render: (a) => h("span", { class: "score-badge" }, fmt.score(a.priorityScore)) },
      { key: "wave", label: "Wave", value: (a) => a.waveIndex, csv: (a) => (a.wave ? a.wave.name : ""), render: (a) => waveChip(m, a.wave) },
      { key: "decisionStatus", label: "Decision status", render: (a) => statusPill(a.decisionStatus) },
    ];
  }

  function render(host, m, params) {
    const f = {};
    KEYS.forEach((k) => (f[k] = params[k] || ""));
    const opts = (fn) => M.uniq(m.catalog.map(fn)).sort();
    const fields = [
      { key: "q", type: "search", placeholder: "Search by name, ID, owner, technology…" },
      { key: "domain", label: "Domain", values: opts((a) => a.domain) },
      { key: "criticality", label: "Criticality", values: opts((a) => a.criticality) },
      { key: "strategy", label: "7R", options: m.strategies.filter((s) => m.catalog.some((a) => a.strategy === s.id)).map((s) => ({ value: s.id, label: s.label })) },
      { key: "wave", label: "Wave", options: m.waves.map((w) => ({ value: w.id, label: w.shortName })) },
      { key: "status", label: "Decision", values: opts((a) => a.decisionStatus) },
      { key: "quadrant", label: "Quadrant", options: M.arr(m.config.quadrants.definitions).map((q) => ({ value: q.id, label: q.name })) },
      { key: "complexity", label: "Complexity", values: m.config.levels.complexity.map((l) => l.label) },
      { key: "risk", label: "Risk", values: m.config.levels.risk.map((l) => l.label) },
      { key: "readiness", label: "Readiness", values: m.config.levels.readiness.map((l) => l.label) },
      { key: "location", label: "Location", values: m.portfolio.locations },
      { key: "pilot", label: "Pilot", options: [{ value: "true", label: "Pilot only" }, { value: "false", label: "Non-pilot" }] },
    ];
    const cols = columns(m);
    const count = h("span", { class: "count" });
    const exportBtn = h("button", { class: "btn btn-ghost", type: "button" }, "Export CSV");
    host.appendChild(pageHead("Application Portfolio", "The baselined application catalog with assessment results and migration decisions. Select an application for its detailed assessment.", exportBtn));
    let tbl;
    const filtered = () => m.catalog.filter((a) => matches(a, f));
    const bar = filterBar(fields, f, (state, key, reset) => {
      setQuery(f);
      if (reset) return OT.rerender();
      const rows = filtered();
      tbl.redraw(rows);
      count.textContent = `${rows.length} of ${m.catalog.length} applications`;
      if (key && key !== "q") bar.querySelectorAll(".f-field").forEach((el) => el.classList.toggle("active", !!el.querySelector("select") && !!el.querySelector("select").value));
    });
    host.appendChild(bar);
    const rows = filtered();
    count.textContent = `${rows.length} of ${m.catalog.length} applications`;

    // summary strip for the current selection
    const summary = h("div", { class: "sel-summary" });
    const drawSummary = (rs) => {
      OT.ui.clear(summary);
      const sc = M.countBy(rs, (a) => a.strategy);
      summary.append(
        count,
        h("span", { class: "sel-sep" }),
        ...m.strategies.filter((s) => sc.get(s.id)).map((s) => h("span", { class: "sel-item" }, h("span", { class: "chip-dot", style: { background: colors.strategy(m, s.id) } }), `${s.label} ${sc.get(s.id)}`)),
        h("span", { class: "sel-sep" }),
        h("span", { class: "sel-item" }, `Effort ${fmt.num(M.sum(rs, (a) => a.effort))} p-wks`),
        h("span", { class: "sel-item" }, `Migration ${fmt.money(M.sum(rs, (a) => a.migrationCost))}`)
      );
    };
    drawSummary(rows);
    tbl = table({ columns: cols, rows, sort: "priorityScore", dir: "desc", onRowClick: (a) => OT.navigate(`#/app/${encodeURIComponent(a.id)}`), class: "tbl-apps" });
    const origRedraw = tbl.redraw;
    tbl.redraw = (rs) => {
      drawSummary(rs);
      origRedraw(rs);
    };
    host.appendChild(card(null, { class: "card-flush" }, summary, tbl));
    exportBtn.addEventListener("click", () =>
      downloadCSV(
        "application-portfolio.csv",
        cols.concat([{ key: "currentCost", label: "Current annual run cost" }, { key: "targetCost", label: "Target annual run cost" }, { key: "migrationCost", label: "Migration cost" }, { key: "effort", label: "Effort (person-weeks)" }]).map((c) => (c.key === "owners" ? { ...c, csv: (a) => `${a.businessOwner} / ${a.technicalOwner}` } : c)),
        filtered()
      )
    );
  }

  OT.views.applications = { render };
})();
