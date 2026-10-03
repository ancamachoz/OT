/* 1. Executive Dashboard */
(function () {
  "use strict";
  const OT = window.OT;
  const { h, card, kpi, pageHead, colors, legend } = OT.ui;
  const C = OT.charts;
  const M = OT.model;
  const fmt = OT.fmt;

  const go = (q) => () => OT.navigate("#/applications?" + new URLSearchParams(q).toString());

  function render(host, m) {
    const p = m.portfolio;
    const bc = m.businessCase;
    const moving = m.catalog.filter(m.isMoving).length;

    host.appendChild(
      pageHead("Executive Overview", `${m.meta.client ? m.meta.client + " · " : ""}${p.appCount} applications assessed · ${M.uniq(m.catalog.map((a) => a.domain)).length} business domains · ${m.waves.length} migration waves`)
    );

    // KPI row
    host.appendChild(
      h(
        "div",
        { class: "kpis" },
        kpi("Applications assessed", fmt.num(p.appCount), { sub: `${moving} moving to AWS · ${p.pilots.length} pilots`, href: "#/applications" }),
        kpi("Servers in scope", fmt.num(p.serverCount), { sub: `${p.datacenters.length} data centers` }),
        kpi("Locations", fmt.num(p.locations.length), { sub: p.locations.slice(0, 4).join(" · ") }),
        kpi("Technologies", fmt.num(p.techCounts.size), { sub: `${p.eolTech.length} end-of-life` }),
        kpi("Avg cloud readiness", fmt.num(p.avgReadiness), { sub: "out of 100" }),
        kpi("Avg cloud benefit", fmt.score(p.avgBenefit), { sub: `out of ${M.get(m.config, "scales.cloudBenefit.max", 5)}` }),
        kpi("Annual run-rate savings", fmt.money(bc.totals.annualSavings), { sub: `${fmt.pct(bc.totals.currentAnnual ? bc.totals.annualSavings / bc.totals.currentAnnual : null)} of current run cost`, href: "#/business-case" }),
        kpi("Payback", bc.totals.payback ? `${bc.totals.payback.months} mo` : "Beyond horizon", { sub: `ROI ${fmt.pct(bc.totals.roi)} over ${bc.horizon} yrs`, href: "#/business-case" })
      )
    );

    // Row 1: 7R, criticality, domains
    const sCounts = M.countBy(m.catalog, (a) => a.strategy);
    const r7 = C.donut(
      m.strategies.filter((s) => sCounts.get(s.id)).map((s) => ({ label: s.label, value: sCounts.get(s.id), color: colors.strategy(m, s.id), onClick: go({ strategy: s.id }) })),
      { centerSub: "applications", ariaLabel: "Applications by AWS 7R strategy" }
    );
    const crit = M.countBy(m.catalog, (a) => a.criticality);
    const critOrder = ["High", "Medium", "Low"].filter((k) => crit.has(k)).concat([...crit.keys()].filter((k) => !["High", "Medium", "Low"].includes(k)));
    const critDonut = C.donut(
      critOrder.map((k) => ({ label: k, value: crit.get(k), color: colors.level(k), onClick: go({ criticality: k }) })),
      { centerSub: "applications", ariaLabel: "Applications by business criticality" }
    );
    const dom = M.countBy(m.catalog, (a) => a.domain);
    const domBars = C.hbars(
      [...dom.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: "var(--c1)", onClick: go({ domain: k }) })),
      { unit: "applications" }
    );
    host.appendChild(
      h(
        "div",
        { class: "grid g-3" },
        card("Recommended AWS 7R strategy", { sub: "Click a segment to see the applications" }, r7),
        card("Business criticality", { sub: "Applications by criticality rating" }, critDonut),
        card("Applications by business domain", {}, domBars)
      )
    );

    // Row 2: complexity × risk heatmap, readiness vs benefit
    const cxLevels = m.config.levels.complexity.map((l) => l.label);
    const rkLevels = m.config.levels.risk.map((l) => l.label);
    const heat = C.heatmap(
      cxLevels.slice().reverse().map((k) => ({ key: k, label: k })),
      rkLevels.map((k) => ({ key: k, label: k })),
      (r, c) => {
        const apps = m.catalog.filter((a) => a.complexityLevel === r.key && a.riskLevel === c.key);
        return { value: apps.length, label: apps.length ? apps.map((a) => a.shortName).join(", ") : "No applications", onClick: apps.length ? go({ complexity: r.key, risk: c.key }) : null };
      },
      { yTitle: "Migration complexity ↑", xTitle: "Migration risk →", unit: "" }
    );
    const cxDist = M.countBy(m.catalog, (a) => a.complexityLevel);
    const rkDist = M.countBy(m.catalog, (a) => a.riskLevel);
    const distRows = h(
      "div",
      { class: "mini-dists" },
      h("div", {}, h("h4", {}, "Complexity"), C.hbars(cxLevels.map((k) => ({ label: k, value: cxDist.get(k) || 0, color: colors.level(k), onClick: go({ complexity: k }) })), { unit: "applications" })),
      h("div", {}, h("h4", {}, "Risk"), C.hbars(rkLevels.map((k) => ({ label: k, value: rkDist.get(k) || 0, color: colors.level(k), onClick: go({ risk: k }) })), { unit: "applications" }))
    );
    const rbHost = h("div", { class: "chart-host" });
    const rbCard = card("Cloud readiness vs. cloud benefit", { sub: "Each dot is an application · upper-right = ready and worth moving" }, rbHost);
    host.appendChild(h("div", { class: "grid g-2" }, card("Migration complexity × migration risk", { sub: "Number of applications per cell · click to drill down" }, h("div", { class: "split" }, heat, distRows)), rbCard));
    requestAnimationFrame(() => {
      const bMax = M.get(m.config, "scales.cloudBenefit.max", 5);
      const bMin = M.get(m.config, "scales.cloudBenefit.min", 1);
      rbHost.appendChild(
        C.scatter(
          rbHost,
          m.catalog.map((a) => ({
            x: a.cloudReadiness,
            y: a.cloudBenefit,
            label: a.shortName,
            color: colors.strategy(m, a.strategy),
            onClick: () => OT.navigate(`#/app/${a.id}`),
            tipTitle: a.name,
            tipRows: [
              { value: fmt.num(a.cloudReadiness), label: "Cloud readiness" },
              { value: fmt.score(a.cloudBenefit), label: "Cloud benefit" },
              { value: a.strategy, label: "7R", color: colors.strategy(m, a.strategy) },
            ],
          })),
          { x: { min: 0, max: 100, label: "Cloud readiness (0–100)" }, y: { min: bMin, max: bMax, label: "Cloud benefit" }, height: 300, quadrants: { x: 50, y: (bMin + bMax) / 2, labels: { tr: "Move now", tl: "Fix readiness first", br: "Easy, low benefit", bl: "Low priority" } } }
        )
      );
      rbHost.appendChild(legend(m.strategies.filter((s) => sCounts.get(s.id)).map((s) => ({ label: s.label, color: colors.strategy(m, s.id) }))));
    });

    // Row 3: infrastructure
    const locBars = C.hbars(
      [...p.serverLocations.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: "var(--c1)", onClick: go({ location: k }), extra: [{ value: fmt.num((p.appLocations.get(k) || 0)), label: "applications hosted" }] })),
      { unit: "servers" }
    );
    const topTech = [...p.techCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
    const techBars = C.hbars(topTech.map(([k, v]) => ({ label: k, value: v, color: "var(--c3)", onClick: go({ q: k }) })), { unit: "applications using it" });
    const os = [...p.osCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const osBars = C.hbars(os.map(([k, v]) => ({ label: k, value: v, color: /2008|2012/.test(k) ? "var(--st-serious)" : "var(--c7)" })), { unit: "servers" });
    host.appendChild(
      h(
        "div",
        { class: "grid g-3" },
        card("Servers by location", { sub: `${fmt.num(p.serverCount)} servers · ${p.datacenters.length} data centers` }, locBars),
        card("Main technologies", { sub: "Number of applications using each technology" }, techBars),
        card("Server operating systems", { sub: "End-of-life versions highlighted" }, osBars)
      )
    );

    // Row 4: waves strip
    host.appendChild(
      card(
        "Migration roadmap at a glance",
        { sub: "Click a wave for its applications, dependencies and timeline", actions: h("a", { class: "btn btn-ghost", href: "#/waves" }, "Open roadmap →") },
        h(
          "div",
          { class: "wave-strip" },
          m.waves.map((w) =>
            h(
              "a",
              { class: "wave-tile", href: `#/waves?wave=${encodeURIComponent(w.id)}`, style: { "--chip": colors.wave(m, w.id) } },
              h("div", { class: "wave-tile-head" }, h("span", { class: "chip-dot" }), h("strong", {}, w.name)),
              h("div", { class: "wave-tile-kpis" }, h("span", {}, h("b", {}, w.apps.length), " apps"), h("span", {}, h("b", {}, fmt.num(w.effort)), " p-wks"), h("span", {}, h("b", {}, fmt.money(w.migrationCost)))),
              h("div", { class: "wave-tile-q" }, `${M.quarterLabel(w.startQ)} → ${M.quarterLabel(w.endQ)}`),
              w.theme ? h("p", {}, w.theme) : null
            )
          )
        )
      )
    );

    // Row 5: insights
    const ins = m.insights.concat(m.computedInsights);
    const typeLabel = { finding: "Finding", risk: "Risk", recommendation: "Recommendation", conclusion: "Conclusion", computed: "From the data" };
    host.appendChild(
      card(
        "Key assessment insights & conclusions",
        { sub: "Narrative insights from the assessment file, plus figures computed live from the data" },
        h(
          "div",
          { class: "insights" },
          ins.map((i) => h("article", { class: `insight insight-${i.type || "finding"}` }, h("span", { class: "insight-type" }, typeLabel[i.type] || i.type || "Insight"), h("h4", {}, i.title || ""), h("p", {}, i.text || "")))
        )
      )
    );

    if (m.warnings.length) host.appendChild(card("Data notes", { sub: "Issues found while reading the JSON" }, h("ul", { class: "plain-list" }, m.warnings.map((w) => h("li", {}, w)))));
  }

  OT.views.overview = { render };
})();
