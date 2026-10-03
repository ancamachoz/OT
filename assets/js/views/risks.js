/* 9. Risks & Constraints */
(function () {
  "use strict";
  const OT = window.OT;
  const { h, card, kpi, pageHead, statusPill, levelPill, colors, table, filterBar, setQuery } = OT.ui;
  const C = OT.charts;
  const M = OT.model;
  const fmt = OT.fmt;

  function render(host, m, params) {
    const f = { app: params.app || "", domain: params.domain || "", wave: params.wave || "", severity: params.severity || "", category: params.category || "", status: params.status || "", l: params.l || "", i: params.i || "", q: params.q || "" };
    host.appendChild(pageHead("Risks & Constraints", "Portfolio risk register across technical, regulatory, security, operational, dependency, migration and business categories."));
    if (!m.risks.length) {
      host.appendChild(OT.ui.empty("The data file has no risks (risks array)."));
      return;
    }
    const sevOrder = M.uniq(m.severityOrder.concat(m.risks.map((r) => r.severity)));
    const match = (r, skip) =>
      (skip === "app" || !f.app || r.apps.some((a) => a.id === f.app)) &&
      (!f.domain || r.domains.includes(f.domain)) &&
      (!f.wave || r.waveIds.includes(f.wave)) &&
      (skip === "sev" || !f.severity || r.severity === f.severity) &&
      (skip === "cat" || !f.category || r.category === f.category) &&
      (!f.status || r.status === f.status) &&
      (skip === "cell" || ((!f.l || String(r.likelihood) === f.l) && (!f.i || String(r.impact) === f.i))) &&
      (!f.q || [r.id, r.title, r.mitigation, r.owner, r.category].join(" ").toLowerCase().includes(f.q.toLowerCase()));
    const rows = m.risks.filter((r) => match(r));

    host.appendChild(
      filterBar(
        [
          { key: "q", type: "search", placeholder: "Search risks…" },
          { key: "app", label: "Application", options: m.catalog.filter((a) => a.risks.length).map((a) => ({ value: a.id, label: a.name })) },
          { key: "domain", label: "Domain", values: m.portfolio.domains },
          { key: "wave", label: "Wave", options: m.waves.map((w) => ({ value: w.id, label: w.shortName })) },
          { key: "severity", label: "Severity", values: sevOrder.filter((s) => m.risks.some((r) => r.severity === s)) },
          { key: "category", label: "Category", values: M.uniq(m.risks.map((r) => r.category)).sort() },
          { key: "status", label: "Status", values: M.uniq(m.risks.map((r) => r.status)).sort() },
        ],
        f,
        (st, key) => {
          if (key !== "q") {
            f.l = "";
            f.i = "";
          }
          setQuery(f);
          OT.rerender();
          if (key === "q") requestAnimationFrame(() => {
            const s = document.querySelector(".f-search");
            if (s) {
              s.focus();
              s.setSelectionRange(s.value.length, s.value.length);
            }
          });
        }
      )
    );

    const sevCount = M.countBy(rows, (r) => r.severity);
    host.appendChild(
      h(
        "div",
        { class: "kpis" },
        kpi("Risks in view", fmt.num(rows.length), { sub: `of ${m.risks.length} in the register` }),
        ...sevOrder.filter((s) => m.risks.some((r) => r.severity === s)).map((s) => kpi(s, fmt.num(sevCount.get(s) || 0), { class: `kpi-sev kpi-${s.toLowerCase()}`, sub: "severity" })),
        kpi("Open", fmt.num(rows.filter((r) => /open/i.test(r.status || "")).length), { sub: `${rows.filter((r) => /mitigat/i.test(r.status || "")).length} being mitigated` }),
        kpi("Applications affected", fmt.num(M.uniq(rows.flatMap((r) => r.apps.map((a) => a.id))).length))
      )
    );

    // heatmap likelihood × impact
    const lvls = [5, 4, 3, 2, 1];
    const base = m.risks.filter((r) => match(r, "cell"));
    const heat = C.heatmap(
      lvls.map((v) => ({ key: v, label: `L${v}` })),
      lvls.slice().reverse().map((v) => ({ key: v, label: `I${v}` })),
      (r, c) => {
        const rs = base.filter((x) => x.likelihood === r.key && x.impact === c.key);
        const score = r.key * c.key;
        const active = f.l === String(r.key) && f.i === String(c.key);
        return {
          value: rs.length,
          text: rs.length || "",
          label: rs.length ? rs.map((x) => x.id).join(", ") : "No risks",
          color: `color-mix(in oklab, ${score >= 15 ? "var(--st-critical)" : score >= 10 ? "var(--st-serious)" : score >= 5 ? "var(--st-warning)" : "var(--st-good)"} ${rs.length ? 70 : 16}%, var(--surface))`,
          active,
          onClick: rs.length || active
            ? () => {
                f.l = active ? "" : String(r.key);
                f.i = active ? "" : String(c.key);
                setQuery(f);
                OT.rerender();
              }
            : null,
        };
      },
      { yTitle: "Likelihood ↑", xTitle: "Impact →", minCol: 52, unit: "risks" }
    );
    const catBase = m.risks.filter((r) => match(r, "cat"));
    const cats = M.uniq(m.risks.map((r) => r.category));
    const catRows = cats
      .map((c) => ({ label: c, segments: sevOrder.map((s) => ({ value: catBase.filter((r) => r.category === c && r.severity === s).length, color: colors.level(s), label: s })), onClick: () => (setQuery({ ...f, category: f.category === c ? "" : c }), OT.rerender()) }))
      .sort((a, b) => M.sum(b.segments, (s) => s.value) - M.sum(a.segments, (s) => s.value));
    const appRisk = M.countBy(rows, (r) => r.apps.map((a) => a.id));
    const topApps = [...appRisk.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    host.appendChild(
      h(
        "div",
        { class: "grid g-3" },
        card("Likelihood × impact", { sub: "Click a cell to filter the register" }, heat),
        card("Risks by category", { sub: "Stacked by severity · click to filter" }, C.stackedHBars(catRows, { format: (v) => v }), OT.ui.legend(sevOrder.filter((s) => m.risks.some((r) => r.severity === s)).map((s) => ({ label: s, color: colors.level(s) })))),
        card("Most exposed applications", { sub: "Number of linked risks in view" }, topApps.length ? C.hbars(topApps.map(([id, n]) => ({ label: m.appById.get(id).shortName, value: n, color: "var(--c2)", onClick: () => (setQuery({ ...f, app: id }), OT.rerender()) })), { unit: "risks" }) : OT.ui.empty())
      )
    );

    host.appendChild(
      card(
        "Risk register",
        { sub: `${rows.length} risks` },
        table({
          columns: [
            { key: "id", label: "ID", render: (r) => h("span", { class: "mono" }, r.id) },
            { key: "title", label: "Risk / constraint", render: (r) => h("b", {}, r.title) },
            { key: "category", label: "Category" },
            { key: "severity", label: "Severity", value: (r) => sevOrder.length - sevOrder.indexOf(r.severity), render: (r) => levelPill(r.severity) },
            { key: "score", label: "L × I", align: "right", value: (r) => (r.likelihood || 0) * (r.impact || 0), render: (r) => (r.likelihood && r.impact ? `${r.likelihood}×${r.impact} = ${r.likelihood * r.impact}` : "—") },
            { key: "apps", label: "Applications", value: (r) => r.apps.length, render: (r) => h("div", { class: "dep-chips" }, r.apps.map((a) => h("a", { class: "dep-chip", href: `#/app/${a.id}`, title: a.name, style: { "--chip": colors.wave(m, a.waveId) } }, a.shortName))) },
            { key: "waves", label: "Waves", value: (r) => r.waveIds.join(","), render: (r) => r.waveIds.join(", ") },
            { key: "mitigation", label: "Mitigation", sortable: false, render: (r) => h("small", {}, r.mitigation || "—") },
            { key: "owner", label: "Owner" },
            { key: "status", label: "Status", render: (r) => statusPill(r.status) },
          ],
          rows,
          sort: "severity",
          class: "tbl-compact tbl-risk",
        })
      )
    );
  }

  OT.views.risks = { render };
})();
