/* 4. Portfolio Prioritization */
(function () {
  "use strict";
  const OT = window.OT;
  const { h, card, pageHead, strategyChip, waveChip, appLink, colors, table, filterBar, setQuery, legend } = OT.ui;
  const C = OT.charts;
  const M = OT.model;
  const fmt = OT.fmt;

  function render(host, m, params) {
    const q = m.config.quadrants;
    const defs = M.arr(q.definitions);
    const f = { domain: params.domain || "", wave: params.wave || "", strategy: params.strategy || "", quadrant: params.quadrant || "", focus: params.focus || "" };
    const xm = q.xMetric || "migrationComplexity";
    const ym = q.yMetric || "businessValue";
    const xs = M.get(m.config, `scales.${xm}`, { min: 1, max: 5 });
    const ys = M.get(m.config, `scales.${ym}`, { min: 1, max: 5 });
    const label = (k) => ({ migrationComplexity: "Migration complexity", businessValue: "Business value", cloudBenefit: "Cloud benefit", cloudReadiness: "Cloud readiness", migrationRisk: "Migration risk" }[k] || k);

    host.appendChild(pageHead("Portfolio Prioritization", `${label(ym)} vs. ${label(xm)} decision matrix and weighted priority score. Select an application in the chart to open its assessment.`));

    // quadrant tiles
    const pos = (d) => (d.value === "high" ? "t" : "b") + (d.complexity === "high" ? "r" : "l");
    const ordered = defs.slice().sort((a, b) => ["tl", "tr", "bl", "br"].indexOf(pos(a)) - ["tl", "tr", "bl", "br"].indexOf(pos(b)));
    const QCOL = { tl: "var(--q-good)", tr: "var(--q-mid)", bl: "var(--q-low)", br: "var(--q-warn)" };
    host.appendChild(
      h(
        "div",
        { class: "quad-tiles" },
        ordered.map((d) => {
          const apps = m.catalog.filter((a) => a.quadrant && a.quadrant.id === d.id);
          const t = h(
            "button",
            { class: `quad-tile ${f.quadrant === d.id ? "active" : ""}`, type: "button", style: { "--qc": QCOL[pos(d)] } },
            h("div", { class: "quad-tile-head" }, h("strong", {}, d.name), h("span", { class: "quad-n" }, apps.length)),
            h("div", { class: "muted small" }, `${d.value === "high" ? "Higher" : "Lower"} value · ${d.complexity === "high" ? "higher" : "lower"} complexity${d.typicalStrategies ? " · " + d.typicalStrategies : ""}`),
            d.guidance ? h("p", {}, d.guidance) : null
          );
          t.addEventListener("click", () => {
            f.quadrant = f.quadrant === d.id ? "" : d.id;
            setQuery(f);
            OT.rerender();
          });
          return t;
        })
      )
    );

    host.appendChild(
      filterBar(
        [
          { key: "domain", label: "Domain", values: M.uniq(m.catalog.map((a) => a.domain)).sort() },
          { key: "wave", label: "Wave", options: m.waves.map((w) => ({ value: w.id, label: w.shortName })) },
          { key: "strategy", label: "7R", options: m.strategies.filter((s) => m.catalog.some((a) => a.strategy === s.id)).map((s) => ({ value: s.id, label: s.label })) },
          { key: "quadrant", label: "Quadrant", options: defs.map((d) => ({ value: d.id, label: d.name })) },
        ],
        f,
        () => {
          setQuery(f);
          OT.rerender();
        }
      )
    );
    const match = (a) => (!f.domain || a.domain === f.domain) && (!f.wave || a.waveId === f.wave) && (!f.strategy || a.strategy === f.strategy) && (!f.quadrant || (a.quadrant && a.quadrant.id === f.quadrant));

    // scatter
    const chartHost = h("div", { class: "chart-host" });
    const labels = {};
    const fills = {};
    defs.forEach((d) => {
      labels[pos(d)] = d.name;
      fills[pos(d)] = `color-mix(in oklab, ${QCOL[pos(d)]} 9%, transparent)`;
    });
    const focusApp = m.appById.get(f.focus);
    host.appendChild(
      h(
        "div",
        { class: "grid g-main-side" },
        card(`${label(ym)} vs. ${label(xm)}`, { sub: "Dot colour = migration wave · dot size = priority score · click a dot to open the application" }, chartHost),
        card(
          "Priority scoring model",
          { sub: M.get(m.config, "priorityScoring.description", "Weighted scoring model (0–100)") },
          h(
            "ul",
            { class: "weights" },
            m.priorityFactors.map((pf) =>
              h("li", {}, h("span", { class: `w-val ${pf.weight < 0 ? "neg" : ""}` }, `${pf.weight > 0 ? "+" : "−"}${Math.round(Math.abs(pf.weight) * 100)}%`), h("div", {}, h("b", {}, pf.label), pf.description ? h("small", {}, pf.description) : null))
            )
          ),
          h("p", { class: "formula" }, "Score = ", m.priorityFactors.map((pf, i) => `${i ? (pf.weight < 0 ? " − " : " + ") : ""}${Math.abs(pf.weight).toFixed(2)}·${pf.label.split(" ")[0]}`).join(""), m.config.priorityScoring.normalize !== false ? " (normalised to 0–100)" : ""),
          h("p", { class: "muted small" }, "Each factor is scored 0–100 per application in the JSON; missing factors are derived from the data (dependency graph, effort, complexity). A higher score means an earlier wave."),
          focusApp ? h("div", { class: "focus-box" }, h("span", { class: "muted small" }, "Selected"), appLink(focusApp), h("b", {}, `Score ${fmt.score(focusApp.priorityScore)} · rank #${focusApp.priorityRank}`)) : null
        )
      )
    );
    requestAnimationFrame(() => {
      chartHost.appendChild(
        C.scatter(
          chartHost,
          m.catalog.map((a) => ({
            x: a[xm],
            y: a[ym],
            r: 5 + (Math.max(0, a.priorityScore) / 100) * 9,
            label: a.shortName,
            color: colors.wave(m, a.waveId),
            dim: !match(a),
            highlight: a.id === f.focus,
            onClick: () => OT.navigate(`#/app/${a.id}`),
            tipTitle: `${a.name} (${a.id})`,
            tipRows: [
              { value: fmt.score(a[ym]), label: label(ym) },
              { value: fmt.score(a[xm]), label: label(xm) },
              { value: fmt.score(a.priorityScore), label: `Priority score (rank #${a.priorityRank})` },
              { value: a.strategy, label: "Recommended 7R", color: colors.strategy(m, a.strategy) },
              { value: a.wave ? a.wave.shortName : "—", label: "Wave", color: colors.wave(m, a.waveId) },
              { value: a.quadrant ? a.quadrant.name : "—", label: "Quadrant" },
            ],
          })),
          { x: { min: xs.min, max: xs.max, label: `${label(xm)} →` }, y: { min: ys.min, max: ys.max, label: `${label(ym)} →` }, quadrants: { x: q.xThreshold, y: q.yThreshold, labels, fills }, height: Math.min(560, Math.max(380, chartHost.clientWidth * 0.6)) }
        )
      );
      chartHost.appendChild(legend(m.waves.filter((w) => w.apps.length).map((w) => ({ label: w.shortName, color: colors.wave(m, w.id) }))));
    });

    // ranking table
    const rows = m.ranked.filter(match);
    const factorCols = m.priorityFactors.map((pf) => ({
      key: "pf_" + pf.key,
      label: pf.label,
      align: "right",
      class: "col-factor",
      value: (a) => (a.priorityBreakdown.find((b) => b.key === pf.key) || {}).value,
      render: (a) => {
        const b = a.priorityBreakdown.find((x) => x.key === pf.key) || { value: 0 };
        return h("span", { class: `fcell ${pf.weight < 0 ? "neg" : ""}`, style: { "--t": b.value / 100 }, title: `${b.value}/100 × ${pf.weight} = ${b.contribution.toFixed(1)}${b.derived ? " (derived)" : ""}` }, fmt.num(b.value));
      },
    }));
    host.appendChild(
      card(
        "Priority ranking",
        { sub: `${rows.length} applications · factor scores 0–100 (inverse factors in orange reduce the score)` },
        table({
          columns: [
            { key: "priorityRank", label: "#", align: "right", defaultDir: "asc" },
            { key: "name", label: "Application", render: (a) => appLink(a) },
            { key: "quadrant", label: "Quadrant", value: (a) => (a.quadrant ? a.quadrant.name : ""), render: (a) => (a.quadrant ? a.quadrant.name : "—") },
            { key: "strategy", label: "7R", render: (a) => strategyChip(m, a.strategy) },
            { key: "wave", label: "Wave", value: (a) => a.waveIndex, render: (a) => waveChip(m, a.wave) },
            ...factorCols,
            { key: "priorityScore", label: "Priority score", align: "right", render: (a) => h("span", { class: "score-bar" }, h("span", { class: "score-fill", style: { width: Math.max(0, a.priorityScore) + "%" } }), h("b", {}, fmt.score(a.priorityScore))) },
          ],
          rows,
          sort: "priorityRank",
          dir: "asc",
          onRowClick: (a) => OT.navigate(`#/app/${a.id}`),
          class: "tbl-rank",
        })
      )
    );
  }

  OT.views.prioritization = { render };
})();
