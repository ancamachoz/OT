/* 3. Application Detail */
(function () {
  "use strict";
  const OT = window.OT;
  const { h, card, statusPill, levelPill, strategyChip, waveChip, appLink, colors, table, empty } = OT.ui;
  const C = OT.charts;
  const M = OT.model;
  const fmt = OT.fmt;

  const dl = (pairs) =>
    h(
      "dl",
      { class: "dl" },
      pairs.filter((p) => p && p[1] !== undefined && p[1] !== null && p[1] !== "").map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])
    );

  function depList(m, edges, side) {
    if (!edges.length) return h("p", { class: "muted small" }, "None recorded");
    return h(
      "ul",
      { class: "dep-list" },
      edges.map((e) => {
        const id = side === "up" ? e.to : e.from;
        const app = m.appById.get(id);
        return h(
          "li",
          {},
          h("span", { class: `dep-crit ${String(e.criticality).toLowerCase()}`, title: `${e.criticality} criticality` }),
          app ? appLink(app) : h("span", { class: "ext" }, id, h("small", {}, " external")),
          h("small", {}, [e.type, e.protocol].filter(Boolean).join(" · ")),
          app && app.wave ? h("span", { class: "dep-wave" }, waveChip(m, app.wave)) : null
        );
      })
    );
  }

  function render(host, m, params, rest) {
    const id = rest[0];
    const a = m.appById.get(id);
    if (!a) {
      host.appendChild(empty(`Application "${id}" was not found in the data file.`));
      host.appendChild(h("p", {}, h("a", { href: "#/applications" }, "← Back to the portfolio")));
      return;
    }
    const ranked = m.ranked;
    const i = ranked.indexOf(a);
    const prev = ranked[i - 1];
    const next = ranked[i + 1];
    const sc = (k, d) => M.get(m.config, `scales.${k}`, d);

    // header
    host.appendChild(
      h(
        "div",
        { class: "crumbs" },
        h("a", { href: "#/applications" }, "Applications"),
        h("span", {}, "/"),
        h("span", {}, a.id),
        h("span", { class: "crumbs-nav" }, prev ? h("a", { class: "btn btn-ghost", href: `#/app/${prev.id}`, title: prev.name }, "← Prev") : null, h("span", { class: "muted small" }, `Priority rank ${a.priorityRank} of ${ranked.length}`), next ? h("a", { class: "btn btn-ghost", href: `#/app/${next.id}`, title: next.name }, "Next →") : null)
      )
    );
    host.appendChild(
      h(
        "section",
        { class: "app-hero" },
        h(
          "div",
          { class: "app-hero-main" },
          h("div", { class: "app-hero-id" }, h("span", { class: "mono" }, a.id), h("span", {}, a.domain), a.appType ? h("span", {}, a.appType) : null, a.tier ? h("span", {}, a.tier) : null),
          h("h1", {}, a.name),
          h("p", { class: "lead" }, a.description || "No functional description provided."),
          h(
            "div",
            { class: "app-hero-tags" },
            strategyChip(m, a.strategy),
            waveChip(m, a.wave),
            statusPill(a.decisionStatus),
            h("span", { class: "tag-l" }, "Criticality ", levelPill(a.criticality)),
            a.quadrant ? h("a", { class: "tag-l", href: `#/prioritization?focus=${a.id}` }, "Quadrant: ", h("b", {}, a.quadrant.name)) : null,
            a.pilot ? h("span", { class: "tag" }, "Landing-zone pilot") : null
          )
        ),
        h("div", { class: "app-hero-side" }, dl([["Business owner", a.businessOwner], ["Technical owner", a.technicalOwner], ["Business function", a.businessFunction], ["Users (max / typical)", a.users ? `${fmt.num(a.users.max)} / ${fmt.num(a.users.typical)}` : null], ["Affinity group", a.affinityGroup ? h("a", { href: `#/dependencies?group=${a.affinityGroup.id}` }, a.affinityGroup.name) : null]]))
      )
    );

    // score gauges
    host.appendChild(
      h(
        "div",
        { class: "gauges" },
        C.gauge(a.businessValue, sc("businessValue", {}).max || 5, { label: "Business value", min: sc("businessValue", {}).min || 0, format: (v) => fmt.score(v), unit: `/${sc("businessValue", {}).max || 5}`, color: "var(--c3)" }),
        C.gauge(a.cloudBenefit, sc("cloudBenefit", {}).max || 5, { label: "Cloud benefit", min: sc("cloudBenefit", {}).min || 0, format: (v) => fmt.score(v), unit: `/${sc("cloudBenefit", {}).max || 5}`, color: "var(--c3)" }),
        C.gauge(a.cloudReadiness, 100, { label: "Cloud readiness", unit: "/100", sub: a.readinessLevel, color: "var(--c1)" }),
        C.gauge(a.migrationComplexity, sc("migrationComplexity", {}).max || 5, { label: "Migration complexity", min: sc("migrationComplexity", {}).min || 0, format: (v) => fmt.score(v), unit: `/${sc("migrationComplexity", {}).max || 5}`, sub: a.complexityLevel, color: colors.level(a.complexityLevel) }),
        C.gauge(a.migrationRisk, 100, { label: "Migration risk", unit: "/100", sub: a.riskLevel, color: colors.level(a.riskLevel) }),
        C.gauge(a.priorityScore, 100, { label: "Priority score", unit: "/100", sub: `Rank #${a.priorityRank}`, color: "var(--c7)", format: (v) => fmt.score(v) }),
        h("div", { class: "gauge gauge-num" }, h("div", { class: "gauge-big" }, fmt.num(a.effort)), h("div", { class: "gauge-label" }, "Migration effort"), h("div", { class: "gauge-sub" }, "person-weeks"))
      )
    );

    // Recommendation
    host.appendChild(
      card(
        "Recommended AWS 7R strategy",
        { class: "card-reco", sub: "Decision, rationale and target state" },
        h(
          "div",
          { class: "reco" },
          h("div", { class: "reco-strategy", style: { "--chip": colors.strategy(m, a.strategy) } }, h("span", { class: "reco-7r" }, a.strategy), h("span", { class: "muted small" }, (m.strategies.find((s) => s.id === a.strategy) || {}).description || ""), statusPill(a.decisionStatus)),
          h("div", { class: "reco-body" }, h("h4", {}, "Rationale"), h("p", {}, a.rationale || "—"), h("h4", {}, "Target architecture"), h("p", {}, a.targetArchitecture || "—"), a.targetServices.length ? h("div", { class: "svc-list" }, a.targetServices.map((s) => h("span", { class: "svc" }, s))) : null),
          h("div", { class: "reco-prereq" }, h("h4", {}, "Migration prerequisites"), a.prerequisites.length ? h("ul", { class: "checklist" }, a.prerequisites.map((p) => h("li", {}, p))) : h("p", { class: "muted" }, "None recorded"))
        )
      )
    );

    // Plan & economics
    const e = a.econ;
    const maxCost = Math.max(a.currentCost, a.targetCost, 1);
    const costCmp = h(
      "div",
      { class: "cost-cmp" },
      [["Current run cost", a.currentCost, "var(--c2)"], ["Target run cost", a.targetCost, "var(--c1)"]].map(([l, v, c]) => h("div", { class: "cost-row" }, h("span", {}, l), h("span", { class: "hbar-track" }, h("span", { class: "hbar-fill", style: { width: (v / maxCost) * 100 + "%", background: c } })), h("b", {}, fmt.money(v), h("small", {}, " /yr"))))
    );
    host.appendChild(
      h(
        "div",
        { class: "grid g-2" },
        card(
          "Migration plan",
          { sub: "Wave placement, timing and effort" },
          h(
            "div",
            { class: "stat-tiles" },
            h("div", { class: "stat" }, h("span", {}, "Recommended wave"), h("b", {}, a.wave ? a.wave.name : "—")),
            h("div", { class: "stat" }, h("span", {}, "Target window"), h("b", {}, `${M.quarterLabel(a.startQ)} → ${M.quarterLabel(a.endQ)}`)),
            h("div", { class: "stat" }, h("span", {}, "Estimated duration"), h("b", {}, a.durationWeeks ? `${a.durationWeeks} weeks` : "—")),
            h("div", { class: "stat" }, h("span", {}, "Estimated effort"), h("b", {}, a.effort !== null ? `${fmt.num(a.effort)} person-weeks` : "—"))
          ),
          a.wave && a.wave.theme ? h("p", { class: "muted small" }, a.wave.theme) : null
        ),
        card(
          "Economics",
          { sub: "Current vs. target run cost and migration investment", actions: h("a", { class: "btn btn-ghost", href: `#/business-case?app=${a.id}` }, "Business case →") },
          costCmp,
          h(
            "div",
            { class: "stat-tiles" },
            h("div", { class: "stat" }, h("span", {}, "Estimated migration cost"), h("b", {}, fmt.money(a.migrationCost))),
            h("div", { class: "stat" }, h("span", {}, "Annual run-cost savings"), h("b", { class: e.annualSavings >= 0 ? "pos" : "neg" }, fmt.money(e.annualSavings))),
            h("div", { class: "stat" }, h("span", {}, "Annual avoided cost"), h("b", {}, fmt.money(a.avoidedCost))),
            h("div", { class: "stat" }, h("span", {}, "Simple payback"), h("b", {}, e.paybackYears !== null ? `${fmt.score(e.paybackYears)} yrs` : "n/a")),
            h("div", { class: "stat" }, h("span", {}, `Net benefit (${m.businessCase.horizon} yrs)`), h("b", { class: e.horizonNet >= 0 ? "pos" : "neg" }, fmt.money(e.horizonNet)))
          )
        )
      )
    );

    // Current state
    const techTable = table({
      columns: [
        { key: "name", label: "Technology" },
        { key: "category", label: "Category" },
        { key: "version", label: "Version" },
        { key: "lifecycle", label: "Lifecycle", render: (t) => (t.lifecycle ? h("span", { class: `life ${String(t.lifecycle).toLowerCase().replace(/\s+/g, "-")}` }, t.lifecycle) : null) },
      ],
      rows: a.technologies,
      class: "tbl-compact",
    });
    host.appendChild(
      h(
        "div",
        { class: "grid g-2" },
        card("Current architecture", { sub: a.architecture.pattern || "" }, h("p", {}, a.architecture.current || a.architecture.description || "—")),
        card("Technologies", { sub: `${a.technologies.length} components` }, a.technologies.length ? techTable : empty())
      )
    );

    // Infrastructure
    const envs = M.arr(a.hosting.environments);
    const srvTable = table({
      columns: [
        { key: "hostname", label: "Server", render: (s) => h("span", { class: "mono" }, s.hostname) },
        { key: "role", label: "Role" },
        { key: "environment", label: "Env." },
        { key: "os", label: "OS", render: (s) => h("span", { class: /2008|2012/.test(s.os || "") ? "eol-text" : "" }, s.os || "—") },
        { key: "platform", label: "Platform" },
        { key: "vcpu", label: "vCPU", align: "right" },
        { key: "ramGB", label: "RAM GB", align: "right" },
        { key: "storageGB", label: "Storage GB", align: "right" },
        { key: "cpuUtilPct", label: "CPU %", align: "right" },
      ],
      rows: a.servers,
      sort: "environment",
      dir: "asc",
      class: "tbl-compact",
    });
    host.appendChild(
      card(
        "Associated infrastructure",
        { sub: `${a.servers.length} servers · ${a.hosting.platform || a.hosting.model || ""}` },
        h(
          "div",
          { class: "stat-tiles" },
          h("div", { class: "stat" }, h("span", {}, "Hosting model"), h("b", {}, a.hosting.model || "—")),
          h("div", { class: "stat" }, h("span", {}, "Platform"), h("b", {}, a.hosting.platform || "—")),
          h("div", { class: "stat" }, h("span", {}, "Data center"), h("b", {}, [a.hosting.datacenter, a.hosting.location].filter(Boolean).join(", ") || "—")),
          h("div", { class: "stat" }, h("span", {}, "Environments"), h("b", {}, envs.join(", ") || "—")),
          h("div", { class: "stat" }, h("span", {}, "Compute"), h("b", {}, `${fmt.num(M.sum(a.servers, (s) => s.vcpu))} vCPU · ${fmt.num(M.sum(a.servers, (s) => s.ramGB))} GB RAM`)),
          h("div", { class: "stat" }, h("span", {}, "Storage"), h("b", {}, `${fmt.num(M.sum(a.servers, (s) => s.storageGB) / 1000, 1)} TB`))
        ),
        a.servers.length ? h("details", { class: "details" }, h("summary", {}, `Server inventory (${a.servers.length})`), srvTable) : null
      )
    );

    // Integrations & dependencies
    host.appendChild(
      card(
        "Integrations & dependencies",
        { sub: "Upstream = systems this application depends on · Downstream = systems that depend on it", actions: h("a", { class: "btn btn-ghost", href: `#/dependencies?focus=${a.id}` }, "Open in dependency map →") },
        h(
          "div",
          { class: "grid g-3 inner" },
          h("div", {}, h("h4", {}, `Upstream (${a.upstream.length})`), depList(m, a.upstream, "up")),
          h("div", {}, h("h4", {}, `Downstream (${a.downstream.length})`), depList(m, a.downstream, "down")),
          h(
            "div",
            {},
            h("h4", {}, `Infrastructure (${a.infra.length})`),
            a.infra.length ? h("ul", { class: "dep-list" }, a.infra.map((i) => h("li", {}, h("span", { class: "dep-crit infra" }), h("span", {}, i.name), h("small", {}, i.type || "")))) : h("p", { class: "muted small" }, "None recorded"),
            h("p", { class: "muted small" }, `Transitive: ${a.allUpstream.size} upstream · ${a.allDownstream.size} downstream`)
          )
        )
      )
    );

    // SLA / regulatory / complexity / priority
    const reg = a.regulatory;
    const drivers = m.driverDefs.map((d) => ({ label: d.label, value: M.num(a.complexityDrivers[d.key], 0), color: colors.level(a.complexityDrivers[d.key] >= 4 ? "High" : a.complexityDrivers[d.key] >= 3 ? "Medium" : "Low"), extra: d.description ? [{ value: "", label: d.description }] : [] }));
    host.appendChild(
      h(
        "div",
        { class: "grid g-2" },
        card(
          "Service levels",
          { sub: "SLA, RTO and RPO" },
          h(
            "div",
            { class: "sla" },
            [["Availability SLA", a.sla.availability], ["RTO", a.sla.rto], ["RPO", a.sla.rpo], ["Support window", a.sla.supportWindow]].map(([k, v]) => h("div", { class: "sla-item" }, h("span", {}, k), h("b", {}, v || "—")))
          ),
          h("h4", { class: "mt" }, "Regulatory / NERC CIP"),
          dl([
            ["NERC CIP", reg.nercCip ? h("span", { class: `cip ${/high/i.test(reg.nercCip) ? "hi" : /medium/i.test(reg.nercCip) ? "med" : /low/i.test(reg.nercCip) ? "lo" : ""}` }, reg.nercCip) : null],
            ["Frameworks", M.arr(reg.frameworks).length ? h("div", { class: "svc-list" }, M.arr(reg.frameworks).map((f) => h("span", { class: "svc" }, f))) : null],
            ["Data residency", reg.dataResidency],
            ["Considerations", reg.notes],
          ])
        ),
        card(
          "Migration complexity drivers",
          { sub: `Scored 1–5 · overall ${fmt.score(a.migrationComplexity)} (${a.complexityLevel || "—"})` },
          drivers.length ? C.hbars(drivers, { max: 5, format: (v) => v, unit: "score (1–5)" }) : empty(),
          a.complexityNotes.length ? h("ul", { class: "notes" }, a.complexityNotes.map((n) => h("li", {}, n))) : null
        )
      )
    );

    // Priority breakdown
    const pb = a.priorityBreakdown;
    host.appendChild(
      card(
        "Priority score breakdown",
        { sub: `Weighted model · score ${fmt.score(a.priorityScore)} / 100 · rank #${a.priorityRank}`, actions: h("a", { class: "btn btn-ghost", href: `#/prioritization?focus=${a.id}` }, "Prioritization matrix →") },
        h(
          "div",
          { class: "factor-grid" },
          pb.map((f) =>
            h(
              "div",
              { class: "factor" },
              h("div", { class: "factor-head" }, h("span", {}, f.label), h("span", { class: "muted small" }, `weight ${f.weight > 0 ? "+" : ""}${Math.round(f.weight * 100)}%`)),
              h("div", { class: "hbar-track" }, h("span", { class: "hbar-fill", style: { width: f.value + "%", background: f.weight < 0 ? "var(--c2)" : "var(--c1)" } })),
              h("div", { class: "factor-foot" }, h("b", {}, fmt.num(f.value)), h("span", { class: "muted small" }, `/100 → ${f.contribution >= 0 ? "+" : "−"}${fmt.score(Math.abs(f.contribution))} pts${f.derived ? " · derived" : ""}`))
            )
          )
        )
      )
    );

    // Risks & landing zone
    const riskTbl = a.risks.length
      ? table({
          columns: [
            { key: "id", label: "ID", render: (r) => h("span", { class: "mono" }, r.id) },
            { key: "title", label: "Risk" },
            { key: "category", label: "Category" },
            { key: "severity", label: "Severity", value: (r) => 4 - m.severityOrder.indexOf(r.severity), render: (r) => levelPill(r.severity) },
            { key: "mitigation", label: "Mitigation", sortable: false },
            { key: "status", label: "Status", render: (r) => statusPill(r.status) },
          ],
          rows: a.risks,
          sort: "severity",
          class: "tbl-compact",
        })
      : empty("No risks linked to this application.");
    host.appendChild(card("Risks & constraints", { sub: `${a.risks.length} linked risks`, actions: h("a", { class: "btn btn-ghost", href: `#/risks?app=${a.id}` }, "Risk register →") }, riskTbl));

    if (a.landingZone) {
      const lz = a.landingZone;
      host.appendChild(
        card(
          "Landing zone readiness",
          { sub: "Pilot application readiness by dimension", actions: h("a", { class: "btn btn-ghost", href: `#/landing-zone?app=${a.id}` }, "Landing zone →") },
          h(
            "div",
            { class: "lz-dims" },
            m.landingZone.dimensions.map((d) => {
              const v = (lz.dimensions || {})[d.id] || {};
              return h("div", { class: `lz-dim lz-${String(v.status || "na").toLowerCase()}` }, h("div", { class: "lz-dim-head" }, h("span", {}, d.name), statusPill(v.status || "n/a")), h("p", {}, v.findings || ""));
            })
          )
        )
      );
    }
  }

  OT.views["app-detail"] = { render };
})();
