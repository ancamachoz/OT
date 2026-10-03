/* 8. Landing Zone Readiness */
(function () {
  "use strict";
  const OT = window.OT;
  const { h, card, kpi, pageHead, statusPill, levelPill, appLink, waveChip, colors, table, filterBar, setQuery, hover, legend } = OT.ui;
  const C = OT.charts;
  const M = OT.model;
  const fmt = OT.fmt;

  const STATUSES = ["Ready", "Gap", "Blocker"];
  const RANK = { blocker: 3, gap: 2, ready: 1 };
  const worst = (sts) => sts.reduce((w, s) => ((RANK[String(s).toLowerCase()] || 0) > (RANK[String(w).toLowerCase()] || 0) ? s : w), "Ready");

  function render(host, m, params) {
    const lz = m.landingZone;
    const f = { app: params.app || "", dimension: params.dimension || "", severity: params.severity || "", status: params.status || "" };
    host.appendChild(pageHead("Landing Zone Readiness", "Readiness of the AWS landing zone for the pilot applications, by dimension, with identified gaps and the remediation backlog."));
    if (!lz.assessments.length) {
      host.appendChild(OT.ui.empty("The data file has no landing-zone assessments (landingZone.assessments)."));
      return;
    }
    const cells = lz.assessments.flatMap((a) => lz.dimensions.map((d) => ({ a, d, v: (a.dimensions || {})[d.id] || null })));
    const cnt = M.countBy(cells.filter((c) => c.v), (c) => c.v.status);
    const openBacklog = lz.backlog.filter((b) => !/done|closed/i.test(b.status || ""));
    host.appendChild(
      h(
        "div",
        { class: "kpis" },
        kpi("Pilot applications", fmt.num(lz.assessments.length), { sub: `${lz.dimensions.length} dimensions assessed` }),
        kpi("Ready", fmt.num(cnt.get("Ready") || 0), { sub: "dimension assessments", class: "kpi-good" }),
        kpi("Gaps", fmt.num(cnt.get("Gap") || 0), { sub: "remediation needed", class: "kpi-warn" }),
        kpi("Blockers", fmt.num(cnt.get("Blocker") || 0), { sub: "must clear before migration", class: "kpi-bad" }),
        kpi("Pilots ready to migrate", fmt.num(lz.assessments.filter((a) => worst(Object.values(a.dimensions || {}).map((v) => v.status)) === "Ready").length), { sub: `of ${lz.assessments.length}` }),
        kpi("Open backlog items", fmt.num(openBacklog.length), { sub: `${fmt.num(M.sum(openBacklog, (b) => b.effortWeeks))} weeks of effort` })
      )
    );

    // readiness matrix
    const matrix = h("div", { class: "lz-matrix", style: { gridTemplateColumns: `minmax(170px, 1.2fr) repeat(${lz.dimensions.length}, minmax(120px, 1fr)) minmax(96px, .6fr)` } });
    matrix.appendChild(h("div", { class: "lzm-h" }, "Pilot application"));
    lz.dimensions.forEach((d) => matrix.appendChild(h("div", { class: "lzm-h", title: d.description || "" }, d.name)));
    matrix.appendChild(h("div", { class: "lzm-h" }, "Overall"));
    lz.assessments.forEach((a) => {
      const sts = lz.dimensions.map((d) => ((a.dimensions || {})[d.id] || {}).status).filter(Boolean);
      matrix.appendChild(h("div", { class: `lzm-app ${f.app === a.appId ? "active" : ""}` }, appLink(a.app), h("small", {}, [a.app.strategy, a.app.wave ? a.app.wave.shortName : ""].filter(Boolean).join(" · "))));
      lz.dimensions.forEach((d) => {
        const v = (a.dimensions || {})[d.id];
        const st = v ? v.status : "n/a";
        const el = h("button", { type: "button", class: `lzm-cell lz-${String(st).toLowerCase()} ${f.app === a.appId && f.dimension === d.id ? "active" : ""}` }, statusPill(st), v && v.findings ? h("span", { class: "lzm-find" }, v.findings) : null);
        hover(el, `${a.app.name} · ${d.name}`, [{ value: st, label: v && v.findings ? v.findings : "" }]);
        el.addEventListener("click", () => {
          const same = f.app === a.appId && f.dimension === d.id;
          f.app = same ? "" : a.appId;
          f.dimension = same ? "" : d.id;
          setQuery(f);
          OT.rerender();
          requestAnimationFrame(() => document.getElementById("lz-backlog").scrollIntoView({ block: "start", behavior: "smooth" }));
        });
        matrix.appendChild(el);
      });
      const w = sts.length ? worst(sts) : "n/a";
      matrix.appendChild(h("div", { class: `lzm-overall lz-${w.toLowerCase()}` }, statusPill(w)));
    });
    host.appendChild(card("Readiness matrix", { sub: "Pilot applications × landing-zone dimensions · click a cell to filter the remediation backlog" }, h("div", { class: "table-wrap" }, matrix)));

    // per-dimension summary
    const SC = { Ready: "var(--st-good)", Gap: "var(--st-warning)", Blocker: "var(--st-critical)" };
    host.appendChild(
      h(
        "div",
        { class: "grid g-2" },
        card(
          "Readiness by dimension",
          { sub: "Number of pilot applications per status" },
          C.stackedHBars(
            lz.dimensions.map((d) => ({ label: d.name, segments: STATUSES.map((s) => ({ value: lz.assessments.filter((a) => ((a.dimensions || {})[d.id] || {}).status === s).length, color: SC[s], label: s })), onClick: () => (setQuery({ ...f, dimension: d.id, app: "" }), OT.rerender()) })),
            { format: (v) => v }
          ),
          legend(STATUSES.map((s) => ({ label: s, color: SC[s] })))
        ),
        card(
          "Dimensions & controls assessed",
          {},
          h(
            "div",
            { class: "lz-dimlist" },
            lz.dimensions.map((d) =>
              h("div", { class: "lz-dimitem" }, h("b", {}, d.name), d.description ? h("p", { class: "small muted" }, d.description) : null, M.arr(d.controls).length ? h("div", { class: "svc-list" }, M.arr(d.controls).map((c) => h("span", { class: "svc" }, c))) : null)
            )
          )
        )
      )
    );

    // gaps & blockers
    const gaps = cells.filter((c) => c.v && /gap|blocker/i.test(c.v.status)).sort((x, y) => (RANK[y.v.status.toLowerCase()] || 0) - (RANK[x.v.status.toLowerCase()] || 0));
    host.appendChild(
      card(
        "Identified gaps & blockers",
        { sub: `${gaps.length} findings across ${M.uniq(gaps.map((g) => g.a.appId)).length} pilot applications` },
        h(
          "div",
          { class: "gap-list" },
          gaps.map((g) => h("div", { class: `gap-item lz-${g.v.status.toLowerCase()}` }, statusPill(g.v.status), h("div", {}, h("div", { class: "gap-meta" }, appLink(g.a.app), h("span", { class: "muted small" }, g.d.name)), h("p", {}, g.v.findings || ""))))
        )
      )
    );

    // backlog
    host.appendChild(h("div", { class: "section-head", id: "lz-backlog" }, h("h2", {}, "Remediation backlog")));
    host.appendChild(
      filterBar(
        [
          { key: "app", label: "Application", options: lz.assessments.map((a) => ({ value: a.appId, label: a.app.name })) },
          { key: "dimension", label: "Dimension", options: lz.dimensions.map((d) => ({ value: d.id, label: d.name })) },
          { key: "severity", label: "Severity", values: M.uniq(lz.backlog.map((b) => b.severity)) },
          { key: "status", label: "Status", values: M.uniq(lz.backlog.map((b) => b.status)) },
        ],
        f,
        () => {
          setQuery(f);
          OT.rerender();
        }
      )
    );
    const rows = lz.backlog.filter((b) => (!f.app || M.arr(b.appIds).includes(f.app)) && (!f.dimension || b.dimension === f.dimension) && (!f.severity || b.severity === f.severity) && (!f.status || b.status === f.status));
    const dimName = (id) => (lz.dimensions.find((d) => d.id === id) || {}).name || id;
    host.appendChild(
      card(
        null,
        { class: "card-flush" },
        table({
          columns: [
            { key: "id", label: "ID", render: (b) => h("span", { class: "mono" }, b.id) },
            { key: "title", label: "Remediation item", render: (b) => h("div", { class: "cell-2" }, h("b", {}, b.title), b.description ? h("small", {}, b.description) : null) },
            { key: "dimension", label: "Dimension", value: (b) => dimName(b.dimension) },
            { key: "severity", label: "Severity", value: (b) => RANK[String(b.severity).toLowerCase()] || 0, render: (b) => statusPill(b.severity) },
            { key: "priority", label: "Priority" },
            { key: "owner", label: "Owner" },
            { key: "effortWeeks", label: "Effort (wks)", align: "right" },
            { key: "targetDate", label: "Target date", render: (b) => fmt.date(b.targetDate) },
            { key: "status", label: "Status", render: (b) => statusPill(b.status) },
            { key: "apps", label: "Applications", sortable: false, render: (b) => h("div", { class: "dep-chips" }, b.apps.map((a) => h("a", { class: "dep-chip", href: `#/app/${a.id}`, style: { "--chip": colors.wave(m, a.waveId) } }, a.shortName))) },
          ],
          rows,
          sort: "severity",
          class: "tbl-compact",
          emptyText: "No backlog items match the current filters.",
        })
      )
    );
  }

  OT.views["landing-zone"] = { render };
})();
