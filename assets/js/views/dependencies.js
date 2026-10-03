/* 5. Dependency Analysis */
(function () {
  "use strict";
  const OT = window.OT;
  const { h, card, pageHead, appLink, waveChip, strategyChip, colors, table, legend, hover, clear, statusPill } = OT.ui;
  const C = OT.charts;
  const M = OT.model;
  const fmt = OT.fmt;

  // deterministic force layout
  function layout(nodes, links, W, H, groupKey) {
    const groups = M.uniq(nodes.map(groupKey));
    const R = Math.min(W, H) * 0.38;
    const centers = new Map(groups.map((g, i) => [g, { x: W / 2 + R * Math.cos((i / groups.length) * 2 * Math.PI - Math.PI / 2), y: H / 2 + R * Math.sin((i / groups.length) * 2 * Math.PI - Math.PI / 2) }]));
    nodes.forEach((n, i) => {
      const c = centers.get(groupKey(n));
      const a = i * 2.399;
      n.x = c.x + 30 * Math.cos(a);
      n.y = c.y + 30 * Math.sin(a);
      n.vx = 0;
      n.vy = 0;
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const L = links.map((l) => ({ s: byId.get(l.from), t: byId.get(l.to), infra: l.infra })).filter((l) => l.s && l.t);
    const k = Math.sqrt((W * H) / Math.max(1, nodes.length)) * 0.85;
    for (let it = 0; it < 360; it++) {
      const temp = 1 - it / 360;
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy || 0.01;
          const f = (k * k) / d2;
          const d = Math.sqrt(d2);
          dx /= d;
          dy /= d;
          a.vx += dx * f;
          a.vy += dy * f;
          b.vx -= dx * f;
          b.vy -= dy * f;
        }
      L.forEach((l) => {
        const dx = l.t.x - l.s.x;
        const dy = l.t.y - l.s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = ((d - k * (l.infra ? 0.9 : 1.2)) / d) * 0.06;
        l.s.vx += dx * f;
        l.s.vy += dy * f;
        l.t.vx -= dx * f;
        l.t.vy -= dy * f;
      });
      nodes.forEach((n) => {
        const c = centers.get(groupKey(n));
        n.vx += (c.x - n.x) * 0.012;
        n.vy += (c.y - n.y) * 0.012;
        const v = Math.sqrt(n.vx * n.vx + n.vy * n.vy) || 1;
        const cap = 18 * temp + 0.5;
        n.x += (n.vx / v) * Math.min(v, cap);
        n.y += (n.vy / v) * Math.min(v, cap);
        n.x = Math.max(40, Math.min(W - 40, n.x));
        n.y = Math.max(30, Math.min(H - 30, n.y));
        n.vx *= 0.5;
        n.vy *= 0.5;
      });
    }
  }

  function render(host, m, params) {
    const st = {
      focus: params.focus || "",
      color: params.color || "group",
      ext: params.ext !== "0",
      infra: params.infra === "1",
      group: params.group || "",
      chain: params.chain !== undefined ? +params.chain : null,
    };
    const save = () => OT.ui.setQuery({ focus: st.focus, color: st.color === "group" ? "" : st.color, ext: st.ext ? "" : "0", infra: st.infra ? "1" : "", group: st.group, chain: st.chain === null ? "" : st.chain });

    const appEdges = m.edges.filter((e) => e.toApp);
    host.appendChild(pageHead("Dependency Analysis", `${m.catalog.length} applications · ${appEdges.length} application-to-application dependencies · ${m.externalNodes.length} external systems · ${m.infrastructure.length} shared infrastructure components`));

    // controls
    const sel = (opts, val, onCh, lbl) => {
      const s = h("select", { "aria-label": lbl }, opts.map(([v, l]) => h("option", { value: v, selected: v === val ? true : null }, l)));
      s.addEventListener("change", () => onCh(s.value));
      return h("label", { class: "f-field" }, s);
    };
    const chk = (label, val, onCh) => {
      const c = h("input", { type: "checkbox", checked: val ? true : null });
      c.addEventListener("change", () => onCh(c.checked));
      return h("label", { class: "f-check" }, c, label);
    };
    const appSel = sel([["", "Focus application: none"], ...m.catalog.map((a) => [a.id, `Focus: ${a.name}`])], st.focus, (v) => {
      st.focus = v;
      st.chain = null;
      st.group = "";
      save();
      draw();
    }, "Focus application");
    host.appendChild(
      h(
        "div",
        { class: "filters" },
        appSel,
        sel([["group", "Colour: affinity group"], ["wave", "Colour: migration wave"], ["domain", "Colour: business domain"], ["strategy", "Colour: 7R strategy"]], st.color, (v) => {
          st.color = v;
          save();
          draw();
        }, "Colour by"),
        chk("External systems", st.ext, (v) => {
          st.ext = v;
          save();
          draw();
        }),
        chk("Shared infrastructure", st.infra, (v) => {
          st.infra = v;
          save();
          draw();
        })
      )
    );

    const graphHost = h("div", { class: "graph-host" });
    const side = h("div", { class: "graph-side" });
    const legendHost = h("div");
    host.appendChild(h("div", { class: "grid g-main-side" }, card("Dependency map", { sub: "Arrow A → B means A depends on B · click a node to trace its upstream and downstream chain" }, graphHost, legendHost), card("Selection", { class: "card-side" }, side)));

    // chains & affinity groups
    const chainsList = h(
      "ol",
      { class: "chains" },
      m.chains.map((c, i) => {
        const li = h("li", { class: `chain ${st.chain === i ? "active" : ""}`, tabindex: "0" }, c.map((id, j) => [j ? h("span", { class: "chain-arrow" }, "→") : null, h("span", { class: "chain-node", style: { "--chip": colors.wave(m, m.appById.get(id).waveId) } }, m.appById.get(id).shortName)]));
        const pick = () => {
          st.chain = st.chain === i ? null : i;
          st.focus = "";
          st.group = "";
          save();
          draw();
          chainsList.querySelectorAll(".chain").forEach((el, k) => el.classList.toggle("active", k === st.chain));
          graphHost.scrollIntoView({ behavior: "smooth", block: "center" });
        };
        li.addEventListener("click", pick);
        li.addEventListener("keydown", (e) => e.key === "Enter" && pick());
        return li;
      })
    );
    const groupCards = h(
      "div",
      { class: "ag-grid" },
      m.affinity.filter((g) => g.apps.length).map((g) => {
        const el = h(
          "div",
          { class: `ag ${g.split ? "ag-split" : ""} ${st.group === g.id ? "active" : ""}`, tabindex: "0" },
          h("div", { class: "ag-head" }, h("strong", {}, g.name), g.migrateTogether ? h("span", { class: "tag" }, "Migrate together") : h("span", { class: "tag tag-muted" }, "Independent")),
          g.description ? h("p", { class: "small" }, g.description) : null,
          h("div", { class: "ag-apps" }, g.apps.map((a) => h("span", { class: "chain-node", style: { "--chip": colors.wave(m, a.waveId) }, title: a.wave ? a.wave.name : "" }, a.shortName))),
          h("div", { class: "small muted" }, `Waves: ${g.waveIds.join(", ") || "—"} · ${g.internalEdges.length} internal dependencies`),
          g.split ? h("div", { class: "ag-warn" }, "⚠ Members are scheduled in different waves") : g.rationale ? h("div", { class: "small muted" }, g.rationale) : null
        );
        const pick = () => {
          st.group = st.group === g.id ? "" : g.id;
          st.focus = "";
          st.chain = null;
          save();
          draw();
          groupCards.querySelectorAll(".ag").forEach((x) => x.classList.remove("active"));
          if (st.group) el.classList.add("active");
          graphHost.scrollIntoView({ behavior: "smooth", block: "center" });
        };
        el.addEventListener("click", pick);
        el.addEventListener("keydown", (e) => e.key === "Enter" && pick());
        return el;
      })
    );
    host.appendChild(
      h(
        "div",
        { class: "grid g-2" },
        card("Critical dependency chains", { sub: "Paths along high-criticality dependencies (provider → consumer). Providers must be ready before consumers move. Click to highlight." }, m.chains.length ? chainsList : OT.ui.empty("No chains of three or more high-criticality dependencies.")),
        card("Affinity groups", { sub: "Applications that share data, interfaces or a cutover window. Click to highlight." }, groupCards)
      )
    );

    // centrality + cross-wave
    const central = m.catalog.slice().sort((a, b) => b.allDownstream.size - a.allDownstream.size || b.downstream.length - a.downstream.length).slice(0, 10);
    host.appendChild(
      h(
        "div",
        { class: "grid g-2" },
        card("Dependency centrality", { sub: "Applications with the most (transitive) downstream dependents" }, C.hbars(central.map((a) => ({ label: a.shortName, value: a.allDownstream.size, color: colors.wave(m, a.waveId), href: `#/dependencies?focus=${a.id}`, extra: [{ value: a.downstream.length, label: "direct dependents" }, { value: a.wave ? a.wave.shortName : "—", label: "wave" }] })), { unit: "transitive dependents" }), legend(m.waves.filter((w) => w.apps.length).map((w) => ({ label: w.shortName, color: colors.wave(m, w.id) })))),
        card(
          "Cross-wave dependencies",
          { sub: "A migrating application depends on a provider that migrates in a later wave → hybrid connectivity needed in between" },
          m.crossWave.length
            ? table({
                columns: [
                  { key: "consumer", label: "Consumer", value: (r) => r.consumer.name, render: (r) => h("div", { class: "cell-2" }, appLink(r.consumer), waveChip(m, r.consumer.wave)) },
                  { key: "provider", label: "Depends on", value: (r) => r.provider.name, render: (r) => h("div", { class: "cell-2" }, appLink(r.provider), waveChip(m, r.provider.wave)) },
                  { key: "crit", label: "Criticality", value: (r) => r.edge.criticality, render: (r) => OT.ui.levelPill(r.edge.criticality) },
                  { key: "type", label: "Interface", value: (r) => r.edge.type, render: (r) => h("small", {}, [r.edge.type, r.edge.protocol].filter(Boolean).join(" · ")) },
                ],
                rows: m.crossWave,
                class: "tbl-compact",
              })
            : OT.ui.empty("No cross-wave dependency conflicts — every provider migrates in the same or an earlier wave.")
        )
      )
    );

    // ------------------------------------------------ graph drawing
    function colorOf(n) {
      if (n.kind === "ext") return "var(--neutral)";
      if (n.kind === "infra") return "var(--neutral-2)";
      const a = n.app;
      if (st.color === "wave") return colors.wave(m, a.waveId);
      if (st.color === "domain") return colors.domain(m, a.domain);
      if (st.color === "strategy") return colors.strategy(m, a.strategy);
      const i = m.affinity.findIndex((g) => g.id === a.affinityGroupId);
      return i < 0 || i > 7 ? "var(--neutral)" : `var(--c${i + 1})`;
    }
    function legendItems() {
      if (st.color === "wave") return m.waves.filter((w) => w.apps.length).map((w) => ({ label: w.shortName, color: colors.wave(m, w.id) }));
      if (st.color === "domain") return m.portfolio.domains.map((d) => ({ label: d, color: colors.domain(m, d) }));
      if (st.color === "strategy") return m.strategies.filter((s) => m.catalog.some((a) => a.strategy === s.id)).map((s) => ({ label: s.label, color: colors.strategy(m, s.id) }));
      return m.affinity.filter((g) => g.apps.length).map((g) => ({ label: g.name, color: m.affinity.indexOf(g) > 7 ? "var(--neutral)" : `var(--c${m.affinity.indexOf(g) + 1})` }));
    }

    let positions = null;
    function draw() {
      const W = C.width(graphHost, 800);
      const H = Math.max(440, Math.min(640, W * 0.62));
      const nodes = m.catalog.map((a) => ({ id: a.id, kind: "app", app: a, label: a.shortName }));
      if (st.ext) m.externalNodes.forEach((e) => nodes.push({ id: e.id, kind: "ext", label: e.name }));
      if (st.infra) m.infrastructure.forEach((i) => nodes.push({ id: i.id, kind: "infra", label: i.name, infraObj: i }));
      const ids = new Set(nodes.map((n) => n.id));
      const links = m.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ ...e }));
      if (st.infra) m.catalog.forEach((a) => a.infrastructureDependencies.forEach((iid) => links.push({ from: a.id, to: iid, infra: true, criticality: "Low", type: "Infrastructure" })));
      const gk = (n) => (n.kind === "app" ? n.app.affinityGroupId || n.app.domain : n.kind === "ext" ? "__ext" : "__infra");
      const key = `${W}|${H}|${st.ext}|${st.infra}`;
      if (!positions || positions.key !== key) {
        layout(nodes, links, W, H, gk);
        positions = { key, map: new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }])) };
      } else nodes.forEach((n) => Object.assign(n, positions.map.get(n.id)));
      const byId = new Map(nodes.map((n) => [n.id, n]));

      // highlight sets
      let hl = null;
      const focusApp = m.appById.get(st.focus);
      if (focusApp) {
        hl = { self: new Set([focusApp.id]), up: new Set(focusApp.allUpstream), down: new Set(focusApp.allDownstream) };
        if (st.infra) focusApp.infrastructureDependencies.forEach((i) => hl.up.add(i));
      } else if (st.chain !== null && m.chains[st.chain]) {
        hl = { self: new Set(m.chains[st.chain]), up: new Set(), down: new Set(), path: m.chains[st.chain] };
      } else if (st.group) {
        const g = m.affinity.find((x) => x.id === st.group);
        if (g) hl = { self: new Set(g.apps.map((a) => a.id)), up: new Set(), down: new Set() };
      }
      const nodeState = (id) => (!hl ? "" : hl.self.has(id) ? "sel" : hl.up.has(id) ? "up" : hl.down.has(id) ? "down" : "dim");
      const edgeOn = (l) => {
        if (!hl) return "";
        if (hl.path) {
          const i = hl.path.indexOf(l.to);
          return i >= 0 && hl.path[i + 1] === l.from ? "on-path" : "dim";
        }
        const a = nodeState(l.from);
        const b = nodeState(l.to);
        if (focusApp) {
          // edges point consumer → provider
          if ((a === "sel" || a === "up") && b === "up") return "on-up";
          if ((b === "sel" || b === "down") && a === "down") return "on-down";
          return "dim";
        }
        return a === "sel" && b === "sel" ? "on-path" : "dim";
      };

      const svg = h("svg", { width: W, height: H, class: "graph", role: "img", "aria-label": "Application dependency map" });
      const defs = h("defs");
      [["arrow", "var(--edge)"], ["arrow-up", "var(--hl-up)"], ["arrow-down", "var(--hl-down)"], ["arrow-path", "var(--ink)"]].forEach(([id, col]) =>
        defs.appendChild(h("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, h("path", { d: "M0,1 L9,5 L0,9 z", fill: col })))
      );
      svg.appendChild(defs);
      const rOf = (n) => (n.kind === "app" ? 9 + Math.min(10, n.app.allDownstream.size * 1.2) : n.kind === "ext" ? 7 : 6);
      const gEdges = h("g");
      links.forEach((l) => {
        const s = byId.get(l.from);
        const t = byId.get(l.to);
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const rs = rOf(s) + 2;
        const rt = rOf(t) + 4;
        const x1 = s.x + (dx / d) * rs;
        const y1 = s.y + (dy / d) * rs;
        const x2 = t.x - (dx / d) * rt;
        const y2 = t.y - (dy / d) * rt;
        const stt = edgeOn(l);
        const marker = stt === "on-up" ? "arrow-up" : stt === "on-down" ? "arrow-down" : stt === "on-path" ? "arrow-path" : "arrow";
        const crit = String(l.criticality).toLowerCase();
        const line = h("line", { x1, y1, x2, y2, class: `edge ${stt} ${l.infra ? "infra" : ""} crit-${crit}`, "marker-end": `url(#${marker})` });
        const hit = h("line", { x1, y1, x2, y2, class: "edge-hit" });
        const sn = s.kind === "app" ? s.app.name : s.label;
        const tn = t.kind === "app" ? t.app.name : t.label;
        hover(hit, `${sn} → ${tn}`, [{ value: l.criticality || "—", label: "criticality" }, { value: l.type || "—", label: l.protocol || "" }].concat(l.description ? [{ value: "", label: l.description }] : []));
        gEdges.append(line, hit);
      });
      svg.appendChild(gEdges);
      const gNodes = h("g");
      nodes.forEach((n) => {
        const s = nodeState(n.id);
        const r = rOf(n);
        const g = h("g", { class: `node node-${n.kind} ${s}`, transform: `translate(${n.x},${n.y})`, tabindex: "0", role: "button", "aria-label": n.label });
        if (n.kind === "app") g.appendChild(h("circle", { r, fill: colorOf(n), class: "node-shape" }));
        else if (n.kind === "ext") g.appendChild(h("rect", { x: -r, y: -r, width: r * 2, height: r * 2, transform: "rotate(45)", fill: colorOf(n), class: "node-shape" }));
        else g.appendChild(h("rect", { x: -r, y: -r, width: r * 2, height: r * 2, rx: 2, fill: colorOf(n), class: "node-shape" }));
        if (n.kind === "app" && n.app.strategy && ["Retain", "Retire"].includes(n.app.strategy)) g.appendChild(h("circle", { r: r + 3.5, fill: "none", class: "node-ring" }));
        g.appendChild(h("text", { y: r + 13, class: "node-label", "text-anchor": "middle" }, n.label));
        const tipRows = n.kind === "app" ? [{ value: n.app.strategy, label: "7R" }, { value: n.app.wave ? n.app.wave.shortName : "—", label: "wave" }, { value: `${n.app.upstream.length} / ${n.app.downstream.length}`, label: "direct upstream / downstream" }] : [{ value: n.kind === "ext" ? "External system" : (n.infraObj && n.infraObj.type) || "Infrastructure", label: "" }];
        hover(g, n.kind === "app" ? `${n.app.name} (${n.id})` : n.label, tipRows);
        const pick = () => {
          if (n.kind !== "app") return;
          st.focus = st.focus === n.id ? "" : n.id;
          st.chain = null;
          st.group = "";
          appSel.querySelector("select").value = st.focus;
          save();
          draw();
        };
        g.addEventListener("click", pick);
        g.addEventListener("dblclick", () => n.kind === "app" && OT.navigate(`#/app/${n.id}`));
        g.addEventListener("keydown", (e) => e.key === "Enter" && pick());
        gNodes.appendChild(g);
      });
      svg.appendChild(gNodes);
      clear(graphHost).appendChild(svg);
      clear(legendHost).append(
        legend(legendItems()),
        h(
          "div",
          { class: "legend legend-sub" },
          h("span", { class: "legend-item" }, h("span", { class: "lg-shape circle" }), "Application (size = dependents)"),
          h("span", { class: "legend-item" }, h("span", { class: "lg-shape ring" }), "Retained / retired"),
          st.ext ? h("span", { class: "legend-item" }, h("span", { class: "lg-shape diamond" }), "External system") : null,
          st.infra ? h("span", { class: "legend-item" }, h("span", { class: "lg-shape square" }), "Shared infrastructure") : null,
          h("span", { class: "legend-item" }, h("span", { class: "legend-key line", style: { background: "var(--hl-up)" } }), "Upstream"),
          h("span", { class: "legend-item" }, h("span", { class: "legend-key line", style: { background: "var(--hl-down)" } }), "Downstream"),
          h("span", { class: "legend-item" }, h("span", { class: "legend-key line thick", style: { background: "var(--edge)" } }), "High criticality")
        )
      );
      drawSide(focusApp);
    }

    function drawSide(a) {
      clear(side);
      if (!a) {
        const g = st.group && m.affinity.find((x) => x.id === st.group);
        const c = st.chain !== null && m.chains[st.chain];
        if (g) {
          side.append(h("h4", {}, g.name), h("p", { class: "small" }, g.description || ""), g.rationale ? h("p", { class: "small muted" }, g.rationale) : null, h("ul", { class: "dep-list" }, g.apps.map((x) => h("li", {}, appLink(x), waveChip(m, x.wave)))), g.split ? h("div", { class: "ag-warn" }, "⚠ This group should migrate together but spans several waves.") : null);
          return;
        }
        if (c) {
          side.append(h("h4", {}, "Critical chain"), h("p", { class: "small muted" }, "Provider first; each application depends on the previous one through a high-criticality interface."), h("ol", { class: "dep-list" }, c.map((id) => h("li", {}, appLink(m.appById.get(id)), waveChip(m, m.appById.get(id).wave)))));
          return;
        }
        side.append(
          h("p", { class: "muted" }, "Select an application in the map (or from the focus list) to trace its upstream and downstream dependencies."),
          h("div", { class: "stat-tiles one" }, h("div", { class: "stat" }, h("span", {}, "Dependencies"), h("b", {}, m.edges.length)), h("div", { class: "stat" }, h("span", {}, "High criticality"), h("b", {}, m.edges.filter((e) => /high/i.test(e.criticality)).length)), h("div", { class: "stat" }, h("span", {}, "Critical chains"), h("b", {}, m.chains.length)), h("div", { class: "stat" }, h("span", {}, "Affinity groups"), h("b", {}, m.affinity.filter((g) => g.apps.length).length)))
        );
        return;
      }
      const list = (ids) =>
        ids.size
          ? h(
              "ul",
              { class: "dep-list" },
              [...ids].map((id) => {
                const x = m.appById.get(id);
                return h("li", {}, x ? appLink(x) : h("span", { class: "ext" }, (m.infraById.get(id) || {}).name || id), x ? waveChip(m, x.wave) : h("small", { class: "muted" }, m.infraById.has(id) ? "infrastructure" : "external"));
              })
            )
          : h("p", { class: "muted small" }, "None");
      side.append(
        h("div", { class: "side-head" }, h("h4", {}, a.name), h("div", { class: "row-gap" }, strategyChip(m, a.strategy), waveChip(m, a.wave))),
        h("p", { class: "small muted" }, a.affinityGroup ? `Affinity group: ${a.affinityGroup.name}` : ""),
        h("h5", { class: "up-t" }, `Upstream — depends on (${a.allUpstream.size})`),
        list(a.allUpstream),
        h("h5", { class: "down-t" }, `Downstream — depended on by (${a.allDownstream.size})`),
        list(a.allDownstream),
        h("h5", {}, `Infrastructure (${a.infra.length})`),
        a.infra.length ? h("div", { class: "svc-list" }, a.infra.map((i) => h("span", { class: "svc" }, i.name))) : h("p", { class: "muted small" }, "None"),
        h("a", { class: "btn btn-primary mt", href: `#/app/${a.id}` }, "Open application detail →")
      );
    }

    requestAnimationFrame(draw);
  }

  OT.views.dependencies = { render };
})();
