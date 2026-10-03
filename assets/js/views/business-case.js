/* 7. Business Case */
(function () {
  "use strict";
  const OT = window.OT;
  const { h, card, kpi, pageHead, strategyChip, waveChip, appLink, colors, table, legend, filterBar, setQuery, clear } = OT.ui;
  const C = OT.charts;
  const M = OT.model;
  const fmt = OT.fmt;
  const money = (v) => fmt.money(v);

  function yearTable(years, totalsRow) {
    const rows = years.map((Y) => ({ ...Y }));
    const cols = [
      { key: "year", label: "Year", sortable: false },
      { key: "baseline", label: "Current (status quo) run cost", align: "right", sortable: false, render: (r) => money(r.baseline) },
      { key: "run", label: "Projected run cost", align: "right", sortable: false, render: (r) => money(r.run) },
      { key: "migration", label: "Migration cost", align: "right", sortable: false, render: (r) => money(r.migration) },
      { key: "savings", label: "Run-cost savings", align: "right", sortable: false, render: (r) => money(r.savings) },
      { key: "avoided", label: "Avoided cost", align: "right", sortable: false, render: (r) => money(r.avoided) },
      { key: "net", label: "Net benefit", align: "right", sortable: false, render: (r) => h("b", { class: r.net >= 0 ? "pos" : "neg" }, money(r.net)) },
    ];
    if (rows[0] && rows[0].cumulative !== undefined) cols.push({ key: "cumulative", label: "Cumulative", align: "right", sortable: false, render: (r) => h("b", { class: r.cumulative >= 0 ? "pos" : "neg" }, money(r.cumulative)) });
    return table({
      columns: cols,
      rows,
      class: "tbl-compact tbl-fin",
      footer: totalsRow
        ? (rs) =>
            h(
              "tfoot",
              {},
              h(
                "tr",
                {},
                cols.map((c) => {
                  if (c.key === "year") return h("td", {}, "Total");
                  if (c.key === "cumulative") return h("td", {});
                  return h("td", { class: "num" }, money(M.sum(rs, (r) => r[c.key])));
                })
              )
            )
        : null,
    });
  }

  function render(host, m, params) {
    const bc = m.businessCase;
    const t = bc.totals;
    const f = { wave: params.wave || "", strategy: params.strategy || "", app: params.app || "" };
    host.appendChild(pageHead("Business Case", `${bc.horizon}-year view (${bc.years[0]}–${bc.years[bc.years.length - 1]}) built bottom-up from application-level costs. ${bc.notes || ""}`));

    host.appendChild(
      h(
        "div",
        { class: "kpis kpis-fin" },
        kpi("Current annual cost", money(t.currentAnnual), { sub: "on-premises run cost / yr" }),
        kpi("Migration cost", money(t.migration), { sub: "one-time investment" }),
        kpi("Target AWS run cost", money(t.targetAnnual), { sub: "steady state / yr" }),
        kpi("Avoided cost", money(t.avoidedAnnual), { sub: "refresh, DC & licences / yr" }),
        kpi("Annual savings", money(t.annualSavings), { sub: `${fmt.pct(t.currentAnnual ? t.annualSavings / t.currentAnnual : null)} run-rate · ${money(t.annualBenefit)} incl. avoided` }),
        kpi("Cumulative savings", money(t.cumulativeNet), { sub: `net of migration · ${bc.horizon} yrs`, class: t.cumulativeNet >= 0 ? "kpi-pos" : "kpi-neg" }),
        kpi(`TCO (${bc.horizon} yrs)`, money(t.tcoTarget), { sub: `vs ${money(t.tcoStatusQuo)} status quo` }),
        kpi("ROI", fmt.pct(t.roi), { sub: `over ${bc.horizon} years` }),
        kpi("Payback period", t.payback ? `${t.payback.months} months` : "Beyond horizon", { sub: t.payback ? `break-even ${M.quarterLabel(t.payback.quarter)}` : "" })
      )
    );

    // yearly charts
    const yrs = bc.years.map(String);
    const costHost = h("div", { class: "chart-host" });
    const benHost = h("div", { class: "chart-host" });
    const S = { run: "var(--c1)", mig: "var(--c2)", base: "var(--ink-2)", sav: "var(--c3)", avd: "var(--c6)", cum: "var(--c7)" };
    host.appendChild(
      h(
        "div",
        { class: "grid g-2" },
        card("Costs by year", { sub: "Projected run cost + migration cost vs. current (status quo) run cost" }, costHost, legend([{ label: "Projected run cost", color: S.run }, { label: "Migration cost", color: S.mig }, { label: "Status quo run cost", color: S.base, line: true }])),
        card("Benefits by year", { sub: "Run-cost savings and avoided cost, net of migration cost; line = cumulative net benefit" }, benHost, legend([{ label: "Run-cost savings", color: S.sav }, { label: "Avoided cost", color: S.avd }, { label: "Migration cost", color: S.mig }, { label: "Cumulative net", color: S.cum, line: true }]))
      )
    );
    requestAnimationFrame(() => {
      costHost.appendChild(
        C.columns(costHost, yrs, [{ name: "Projected run cost", color: S.run, values: bc.yearly.map((Y) => Y.run) }, { name: "Migration cost", color: S.mig, values: bc.yearly.map((Y) => Y.migration) }], { lines: [{ name: "Status quo run cost", color: S.base, values: bc.yearly.map((Y) => Y.baseline), dash: "5 4" }], format: money, ariaLabel: "Costs by year" })
      );
      benHost.appendChild(
        C.columns(benHost, yrs, [{ name: "Run-cost savings", color: S.sav, values: bc.yearly.map((Y) => Y.savings) }, { name: "Avoided cost", color: S.avd, values: bc.yearly.map((Y) => Y.avoided) }, { name: "Migration cost", color: S.mig, values: bc.yearly.map((Y) => -Y.migration) }], { lines: [{ name: "Cumulative net", color: S.cum, values: bc.yearly.map((Y) => Y.cumulative) }], format: money, ariaLabel: "Benefits by year" })
      );
    });
    host.appendChild(card("Costs and benefits by year", {}, yearTable(bc.yearly, true)));

    // by wave
    const waveHost = h("div", { class: "chart-host" });
    const bw = bc.byWave.filter((x) => x.wave.apps.length);
    host.appendChild(
      h(
        "div",
        { class: "grid g-2" },
        card("Costs and benefits by migration wave", { sub: "One-time migration cost vs. annual benefit (savings + avoided) · click a wave to drill down" }, waveHost, legend([{ label: "Migration cost", color: S.mig }, { label: "Annual run-cost savings", color: S.sav }, { label: "Annual avoided cost", color: S.avd }])),
        card(
          "Wave economics",
          {},
          table({
            columns: [
              { key: "wave", label: "Wave", value: (r) => r.wave.index, render: (r) => waveChip(m, r.wave) },
              { key: "current", label: "Current / yr", align: "right", render: (r) => money(r.current) },
              { key: "target", label: "Target / yr", align: "right", render: (r) => money(r.target) },
              { key: "migration", label: "Migration", align: "right", render: (r) => money(r.migration) },
              { key: "annualSavings", label: "Savings / yr", align: "right", render: (r) => money(r.annualSavings) },
              { key: "horizonNet", label: `Net (${bc.horizon} yrs)`, align: "right", render: (r) => h("b", { class: r.horizonNet >= 0 ? "pos" : "neg" }, money(r.horizonNet)) },
            ],
            rows: bw,
            sort: "wave",
            dir: "asc",
            onRowClick: (r) => {
              setQuery({ ...f, wave: r.wave.id });
              OT.rerender();
            },
            class: "tbl-compact",
          })
        )
      )
    );
    requestAnimationFrame(() =>
      waveHost.appendChild(
        C.columns(
          waveHost,
          bw.map((x) => x.wave.id),
          [{ name: "Migration cost", color: S.mig, values: bw.map((x) => x.migration) }, { name: "Annual run-cost savings", color: S.sav, values: bw.map((x) => x.annualSavings) }, { name: "Annual avoided cost", color: S.avd, values: bw.map((x) => x.avoided) }],
          { stacked: false, format: money, tipTitle: (i) => bw[i].wave.name, onClick: (i) => (setQuery({ ...f, wave: bw[i].wave.id }), OT.rerender()), ariaLabel: "Costs and benefits by wave" }
        )
      )
    );

    // application drill-down
    const focus = m.appById.get(f.app);
    if (focus) {
      const e = focus.econ;
      const fh = h("div", { class: "chart-host" });
      let cum = 0;
      const yrows = e.yearly.map((Y) => ((cum += Y.net), { ...Y, cumulative: cum }));
      host.appendChild(
        card(
          `${focus.name} — application economics`,
          { sub: `${focus.strategy} · ${focus.wave ? focus.wave.name : "no wave"} · cutover ${M.quarterLabel(e.cutoverQ)}`, class: "card-focus", actions: h("span", { class: "row-gap" }, h("a", { class: "btn btn-ghost", href: `#/app/${focus.id}` }, "Application detail →"), h("a", { class: "btn btn-ghost", href: "#/business-case" }, "✕ Close")) },
          h(
            "div",
            { class: "stat-tiles" },
            [["Current / yr", money(focus.currentCost)], ["Target / yr", money(focus.targetCost)], ["Migration", money(focus.migrationCost)], ["Avoided / yr", money(focus.avoidedCost)], ["Payback", e.paybackYears !== null ? `${fmt.score(e.paybackYears)} yrs` : "n/a"], ["ROI", fmt.pct(e.roi)]].map(([k, v]) => h("div", { class: "stat" }, h("span", {}, k), h("b", {}, v)))
          ),
          fh,
          yearTable(yrows, true)
        )
      );
      requestAnimationFrame(() => fh.appendChild(C.columns(fh, yrs, [{ name: "Run-cost savings", color: S.sav, values: e.yearly.map((Y) => Y.savings) }, { name: "Avoided cost", color: S.avd, values: e.yearly.map((Y) => Y.avoided) }, { name: "Migration cost", color: S.mig, values: e.yearly.map((Y) => -Y.migration) }], { lines: [{ name: "Cumulative net", color: S.cum, values: yrows.map((Y) => Y.cumulative) }], format: money, height: 220 })));
    }

    // application-level table
    host.appendChild(h("div", { class: "section-head", id: "app-econ" }, h("h2", {}, "Application-level economics")));
    host.appendChild(
      filterBar(
        [
          { key: "wave", label: "Wave", options: m.waves.map((w) => ({ value: w.id, label: w.shortName })) },
          { key: "strategy", label: "7R", options: m.strategies.filter((s) => m.catalog.some((a) => a.strategy === s.id)).map((s) => ({ value: s.id, label: s.label })) },
        ],
        f,
        () => {
          setQuery(f);
          OT.rerender();
        }
      )
    );
    const rows = bc.apps.filter((e) => (!f.wave || e.app.waveId === f.wave) && (!f.strategy || e.app.strategy === f.strategy));
    const sumRow = (k) => M.sum(rows, k);
    host.appendChild(
      card(
        null,
        { class: "card-flush" },
        h("div", { class: "sel-summary" }, h("span", { class: "count" }, `${rows.length} applications`), h("span", { class: "sel-sep" }), h("span", { class: "sel-item" }, `Current ${money(sumRow((e) => e.app.currentCost))}/yr`), h("span", { class: "sel-item" }, `Target ${money(sumRow((e) => e.app.targetCost))}/yr`), h("span", { class: "sel-item" }, `Migration ${money(sumRow((e) => e.app.migrationCost))}`), h("span", { class: "sel-item" }, `Net ${bc.horizon} yrs ${money(sumRow((e) => e.horizonNet))}`)),
        table({
          columns: [
            { key: "name", label: "Application", value: (e) => e.app.name, render: (e) => h("div", { class: "cell-app" }, appLink(e.app), h("small", { class: "mono" }, e.app.id)) },
            { key: "wave", label: "Wave", value: (e) => e.app.waveIndex, render: (e) => waveChip(m, e.app.wave) },
            { key: "strategy", label: "7R", value: (e) => e.app.strategy, render: (e) => strategyChip(m, e.app.strategy) },
            { key: "current", label: "Current / yr", align: "right", value: (e) => e.app.currentCost, render: (e) => money(e.app.currentCost) },
            { key: "target", label: "Target / yr", align: "right", value: (e) => e.app.targetCost, render: (e) => money(e.app.targetCost) },
            { key: "annualSavings", label: "Savings / yr", align: "right", render: (e) => h("span", { class: e.annualSavings >= 0 ? "pos" : "neg" }, money(e.annualSavings)) },
            { key: "avoided", label: "Avoided / yr", align: "right", value: (e) => e.app.avoidedCost, render: (e) => money(e.app.avoidedCost) },
            { key: "migration", label: "Migration", align: "right", value: (e) => e.app.migrationCost, render: (e) => money(e.app.migrationCost) },
            { key: "paybackYears", label: "Payback", align: "right", render: (e) => (e.paybackYears !== null ? `${fmt.score(e.paybackYears)} yrs` : "n/a") },
            { key: "horizonNet", label: `Net (${bc.horizon} yrs)`, align: "right", render: (e) => h("b", { class: e.horizonNet >= 0 ? "pos" : "neg" }, money(e.horizonNet)) },
            { key: "roi", label: "ROI", align: "right", render: (e) => fmt.pct(e.roi) },
          ],
          rows,
          sort: "horizonNet",
          onRowClick: (e) => {
            setQuery({ ...f, app: e.app.id });
            OT.rerender();
          },
          class: "tbl-fin",
        })
      )
    );
    if (focus) requestAnimationFrame(() => document.querySelector(".card-focus") && document.querySelector(".card-focus").scrollIntoView({ block: "start" }));
  }

  OT.views["business-case"] = { render };
})();
