/* 6. Migration Strategy & Waves */
(function () {
  "use strict";
  const OT = window.OT;
  const { h, card, kpi, pageHead, statusPill, levelPill, strategyChip, waveChip, appLink, colors, table, hover, legend, setQuery } = OT.ui;
  const C = OT.charts;
  const M = OT.model;
  const fmt = OT.fmt;

  function gantt(m, waves) {
    const qs = m.catalog.flatMap((a) => [a.startQ, a.endQ]).concat(waves.flatMap((w) => [w.startQ, w.endQ])).filter((v) => v !== null);
    if (!qs.length) return OT.ui.empty("No quarters defined for waves or applications.");
    const q0 = Math.min(...qs);
    const q1 = Math.max(...qs);
    const n = q1 - q0 + 1;
    const pct = (q) => ((q - q0) / n) * 100;
    const years = M.uniq(Array.from({ length: n }, (_, i) => Math.floor((q0 + i) / 4)));
    const head = h(
      "div",
      { class: "gantt-head" },
      h("div", { class: "gantt-lbl" }),
      h(
        "div",
        { class: "gantt-axis" },
        h("div", { class: "gantt-years" }, years.map((y) => {
          const s = Math.max(q0, y * 4);
          const e = Math.min(q1, y * 4 + 3);
          return h("span", { style: { left: pct(s) + "%", width: ((e - s + 1) / n) * 100 + "%" } }, y);
        })),
        h("div", { class: "gantt-qs" }, Array.from({ length: n }, (_, i) => h("span", { style: { left: pct(q0 + i) + "%", width: 100 / n + "%" } }, `Q${((q0 + i) % 4) + 1}`)))
      )
    );
    const grid = h("div", { class: "gantt-gridlines" }, Array.from({ length: n }, (_, i) => h("span", { class: (q0 + i) % 4 === 0 ? "yr" : "", style: { left: pct(q0 + i) + "%" } })));
    const rows = [];
    waves.forEach((w) => {
      const col = colors.wave(m, w.id);
      const wrow = h(
        "div",
        { class: "gantt-row gantt-wave" },
        h("div", { class: "gantt-lbl" }, h("a", { href: `#/waves?wave=${w.id}` }, w.name), h("small", {}, `${w.apps.length} apps · ${fmt.num(w.effort)} p-wks`)),
        h("div", { class: "gantt-track" }, w.startQ !== null ? h("span", { class: "gantt-bar wave", style: { left: pct(w.startQ) + "%", width: ((w.endQ - w.startQ + 1) / n) * 100 + "%", "--bar": col } }, `${M.quarterLabel(w.startQ)} – ${M.quarterLabel(w.endQ)}`) : null)
      );
      rows.push(wrow);
      w.apps
        .slice()
        .sort((a, b) => (a.startQ ?? 0) - (b.startQ ?? 0) || b.priorityScore - a.priorityScore)
        .forEach((a) => {
          const bar = a.startQ !== null ? h("a", { class: "gantt-bar", href: `#/app/${a.id}`, style: { left: pct(a.startQ) + "%", width: (((a.endQ ?? a.startQ) - a.startQ + 1) / n) * 100 + "%", "--bar": col } }, h("span", {}, a.strategy)) : null;
          if (bar)
            hover(bar, `${a.name} (${a.id})`, [
              { value: `${M.quarterLabel(a.startQ)} → ${M.quarterLabel(a.endQ)}`, label: "window" },
              { value: a.durationWeeks ? `${a.durationWeeks} wks` : "—", label: "duration" },
              { value: a.strategy, label: "7R", color: colors.strategy(m, a.strategy) },
              { value: fmt.score(a.priorityScore), label: "priority score" },
              { value: fmt.num(a.migrationRisk), label: "risk score" },
            ]);
          rows.push(h("div", { class: "gantt-row" }, h("div", { class: "gantt-lbl app" }, appLink(a, a.shortName), h("small", { class: "mono" }, a.id)), h("div", { class: "gantt-track" }, bar)));
        });
    });
    return h("div", { class: "gantt" }, head, h("div", { class: "gantt-body" }, h("div", { class: "gantt-grid-wrap" }, grid), rows));
  }

  function waveTable(m, apps) {
    return table({
      columns: [
        { key: "name", label: "Application", render: (a) => h("div", { class: "cell-app" }, appLink(a), h("small", { class: "mono" }, a.id)) },
        { key: "strategy", label: "7R strategy", render: (a) => strategyChip(m, a.strategy) },
        { key: "priorityScore", label: "Priority", align: "right", render: (a) => h("span", { class: "score-badge" }, fmt.score(a.priorityScore)) },
        { key: "migrationRisk", label: "Risk score", align: "right", render: (a) => h("span", { class: "cell-2 r" }, levelPill(a.riskLevel), h("small", {}, fmt.num(a.migrationRisk))) },
        { key: "effort", label: "Effort (p-wks)", align: "right", render: (a) => fmt.num(a.effort) },
        { key: "durationWeeks", label: "Duration", align: "right", render: (a) => (a.durationWeeks ? `${a.durationWeeks} wks` : "—") },
        {
          key: "deps",
          label: "Dependencies",
          sortable: false,
          render: (a) => {
            const ups = a.upstream.filter((e) => e.toApp);
            if (!ups.length) return h("span", { class: "muted small" }, "Standalone");
            return h(
              "div",
              { class: "dep-chips" },
              ups.map((e) => {
                const p = m.appById.get(e.to);
                const later = p.wave && a.wave && p.wave.index > a.wave.index && !["Retain", "Retire"].includes(p.strategy);
                return h("a", { class: `dep-chip ${later ? "warn" : ""}`, href: `#/app/${p.id}`, title: `${p.name} · ${p.wave ? p.wave.name : "no wave"}${later ? " · migrates later (hybrid period)" : ""}`, style: { "--chip": colors.wave(m, p.waveId) } }, later ? "⚠ " : "", p.shortName);
              })
            );
          },
        },
        { key: "prereq", label: "Prerequisites", sortable: false, render: (a) => (a.prerequisites.length ? h("ul", { class: "mini-list" }, a.prerequisites.map((p) => h("li", {}, p))) : h("span", { class: "muted small" }, "—")) },
        { key: "endQ", label: "Target quarter", value: (a) => a.endQ, render: (a) => h("div", { class: "cell-2" }, h("b", {}, M.quarterLabel(a.endQ)), h("small", {}, `start ${M.quarterLabel(a.startQ)}`)) },
        { key: "decisionStatus", label: "Decision", render: (a) => statusPill(a.decisionStatus) },
      ],
      rows: apps,
      sort: "priorityScore",
      onRowClick: (a) => OT.navigate(`#/app/${a.id}`),
      class: "tbl-wave",
    });
  }

  function render(host, m, params) {
    const sel = params.wave || "";
    const waves = m.waves.filter((w) => w.apps.length || !w.synthetic);
    const scheduled = m.catalog.filter((a) => a.wave);
    const allQ = waves.flatMap((w) => [w.startQ, w.endQ]).filter((v) => v !== null);
    const nQ = allQ.length ? Math.max(...allQ) - Math.min(...allQ) + 1 : 0;
    const statuses = M.countBy(m.catalog, (a) => a.decisionStatus);

    host.appendChild(pageHead("Migration Strategy & Waves", "Roadmap grouped into migration waves, sequenced by priority score, dependencies and readiness gates."));
    host.appendChild(
      h(
        "div",
        { class: "kpis" },
        kpi("Migration waves", fmt.num(waves.length)),
        kpi("Applications scheduled", fmt.num(scheduled.length), { sub: `${m.catalog.length - scheduled.length} unscheduled` }),
        kpi("Target quarters", fmt.num(nQ), { sub: allQ.length ? `${M.quarterLabel(Math.min(...allQ))} → ${M.quarterLabel(Math.max(...allQ))}` : "" }),
        kpi("Total effort", `${fmt.num(m.portfolio.totalEffort)}`, { sub: "person-weeks" }),
        kpi("Decisions confirmed", fmt.num(m.catalog.filter((a) => /approved|proceed/i.test(a.decisionStatus)).length), { sub: [...statuses.entries()].map(([k, v]) => `${v} ${k}`).join(" · ") }),
        kpi("Avg risk score", fmt.num(m.portfolio.avgRisk), { sub: M.levelFor(m.portfolio.avgRisk, m.config.levels.risk) || "" })
      )
    );

    // wave cards
    host.appendChild(
      h(
        "div",
        { class: "wave-cards" },
        waves.map((w) => {
          const col = colors.wave(m, w.id);
          const segs = m.strategies.filter((s) => w.strategies.get(s.id)).map((s) => ({ s, n: w.strategies.get(s.id) }));
          const el = h(
            "a",
            { class: `wave-card ${sel === w.id ? "active" : ""}`, href: sel === w.id ? "#/waves" : `#/waves?wave=${w.id}`, style: { "--chip": col } },
            h("div", { class: "wave-card-head" }, h("span", { class: "chip-dot" }), h("strong", {}, w.name), w.status ? statusPill(w.status) : null),
            w.theme ? h("p", { class: "small" }, w.theme) : null,
            h(
              "div",
              { class: "wave-card-kpis" },
              [["Apps", w.apps.length], ["Effort", `${fmt.num(w.effort)} p-wks`], ["Longest", w.durationWeeks ? `${w.durationWeeks} wks` : "—"], ["Avg priority", fmt.score(w.avgPriority)], ["Avg risk", fmt.num(w.avgRisk)], ["Migration cost", fmt.money(w.migrationCost)]].map(([k, v]) => h("div", {}, h("span", {}, k), h("b", {}, v)))
            ),
            h("div", { class: "mix-bar" }, segs.map(({ s, n }) => {
              const seg = h("span", { style: { flex: n, background: colors.strategy(m, s.id) } });
              hover(seg, w.name, [{ value: n, label: s.label, color: colors.strategy(m, s.id) }]);
              return seg;
            })),
            h("div", { class: "small muted" }, segs.map(({ s, n }) => `${s.label} ${n}`).join(" · ")),
            h("div", { class: "wave-card-q" }, `${M.quarterLabel(w.startQ)} → ${M.quarterLabel(w.endQ)}`)
          );
          return el;
        })
      )
    );

    // timeline
    host.appendChild(card("Roadmap timeline", { sub: "By quarter and wave · bars show each application's migration window (label = 7R) · click for details" }, gantt(m, waves)));

    // strategy by wave + objectives
    const stratRows = waves.map((w) => ({ label: w.shortName, segments: m.strategies.map((s) => ({ value: w.strategies.get(s.id) || 0, color: colors.strategy(m, s.id), label: s.label })), onClick: () => OT.navigate(`#/waves?wave=${w.id}`) }));
    host.appendChild(
      h(
        "div",
        { class: "grid g-2" },
        card("7R strategy by wave", { sub: "Number of applications" }, C.stackedHBars(stratRows, { format: (v) => v }), legend(m.strategies.filter((s) => m.catalog.some((a) => a.strategy === s.id)).map((s) => ({ label: s.label, color: colors.strategy(m, s.id) })))),
        card(
          "Wave objectives & exit criteria",
          {},
          h(
            "div",
            { class: "obj-list" },
            waves.map((w) =>
              h(
                "div",
                { class: "obj", style: { "--chip": colors.wave(m, w.id) } },
                h("div", { class: "obj-head" }, h("span", { class: "chip-dot" }), h("b", {}, w.name)),
                M.arr(w.objectives).length ? h("ul", { class: "mini-list" }, M.arr(w.objectives).map((o) => h("li", {}, o))) : null,
                w.exitCriteria ? h("p", { class: "small muted" }, h("b", {}, "Exit: "), w.exitCriteria) : null
              )
            )
          )
        )
      )
    );

    // wave detail tables
    const shown = sel ? waves.filter((w) => w.id === sel) : waves;
    const pick = h("select", { "aria-label": "Wave" }, h("option", { value: "" }, "All waves"), waves.map((w) => h("option", { value: w.id, selected: w.id === sel ? true : null }, w.name)));
    pick.addEventListener("change", () => {
      setQuery({ wave: pick.value });
      OT.rerender();
    });
    host.appendChild(h("div", { class: "section-head", id: "wave-detail" }, h("h2", {}, "Wave detail"), h("label", { class: "f-field" }, pick)));
    shown.forEach((w) =>
      host.appendChild(
        card(
          w.name,
          { sub: `${w.apps.length} applications · ${M.quarterLabel(w.startQ)} → ${M.quarterLabel(w.endQ)} · ${fmt.num(w.effort)} person-weeks · ${fmt.money(w.migrationCost)}`, class: "card-wave", actions: h("a", { class: "btn btn-ghost", href: `#/business-case?wave=${w.id}` }, "Wave economics →") },
          w.apps.length ? waveTable(m, w.apps) : OT.ui.empty("No applications in this wave.")
        )
      )
    );
    if (sel) requestAnimationFrame(() => document.getElementById("wave-detail") && document.getElementById("wave-detail").scrollIntoView({ block: "start" }));
  }

  OT.views.waves = { render };
})();
