/* Lightweight, dependency-free chart components (SVG + HTML). */
(function () {
  "use strict";
  const OT = (window.OT = window.OT || {});
  const { h, hover, clear } = OT.ui;

  const width = (el, d = 600) => Math.max(260, Math.floor(el.clientWidth || el.getBoundingClientRect().width || d));

  // ---------------------------------------------------------------- donut
  // data: [{label, value, color, onClick}]  opts: {center, centerSub, format, size}
  function donut(data, opts = {}) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const size = opts.size || 168;
    const r = size / 2;
    const thick = opts.thickness || 24;
    const ri = r - thick;
    const fmtV = opts.format || ((v) => v);
    const svg = h("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: "donut-svg", role: "img", "aria-label": opts.ariaLabel || "Donut chart" });
    let a0 = -Math.PI / 2;
    const gap = data.filter((d) => d.value > 0).length > 1 ? 0.022 : 0;
    data.forEach((d) => {
      if (!d.value) return;
      const frac = d.value / total;
      const a1 = a0 + frac * Math.PI * 2;
      const s = a0 + gap / 2;
      const e = Math.max(s + 0.001, a1 - gap / 2);
      const large = e - s > Math.PI ? 1 : 0;
      const p = (rad, ang) => `${r + rad * Math.cos(ang)},${r + rad * Math.sin(ang)}`;
      const path =
        frac >= 0.9999
          ? `M${r},0 A${r},${r} 0 1 1 ${r},${size} A${r},${r} 0 1 1 ${r},0 Z M${r},${thick} A${ri},${ri} 0 1 0 ${r},${size - thick} A${ri},${ri} 0 1 0 ${r},${thick} Z`
          : `M${p(r, s)} A${r},${r} 0 ${large} 1 ${p(r, e)} L${p(ri, e)} A${ri},${ri} 0 ${large} 0 ${p(ri, s)} Z`;
      const seg = h("path", { d: path, fill: d.color, "fill-rule": "evenodd", class: `seg ${d.onClick ? "clickable" : ""}`, tabindex: "0" });
      hover(seg, d.label, [{ value: fmtV(d.value), label: `${Math.round(frac * 100)}% of total`, color: d.color }]);
      if (d.onClick) {
        seg.addEventListener("click", d.onClick);
        seg.addEventListener("keydown", (e) => e.key === "Enter" && d.onClick());
      }
      svg.appendChild(seg);
      a0 = a1;
    });
    const center = h("div", { class: "donut-center" }, h("div", { class: "donut-c-val" }, opts.center !== undefined ? opts.center : fmtV(total)), h("div", { class: "donut-c-sub" }, opts.centerSub || "Total"));
    const legend = h(
      "ul",
      { class: "donut-legend" },
      data.map((d) => {
        const li = h(
          "li",
          { class: d.onClick ? "clickable" : "" },
          h("span", { class: "legend-key", style: { background: d.color } }),
          h("span", { class: "dl-label" }, d.label),
          h("span", { class: "dl-val" }, fmtV(d.value)),
          h("span", { class: "dl-pct" }, total ? Math.round((d.value / total) * 100) + "%" : "")
        );
        if (d.onClick) li.addEventListener("click", d.onClick);
        return li;
      })
    );
    return h("div", { class: "donut" }, h("div", { class: "donut-fig", style: { width: size + "px", height: size + "px" } }, svg, center), legend);
  }

  // ---------------------------------------------------------------- horizontal bars (HTML)
  // data: [{label, value, color, onClick, sub, valueLabel}]  opts: {max, format}
  function hbars(data, opts = {}) {
    const max = opts.max || Math.max(1, ...data.map((d) => Math.abs(d.value)));
    const fmtV = opts.format || ((v) => v);
    return h(
      "div",
      { class: "hbars" },
      data.map((d) => {
        const row = h(
          d.href ? "a" : "div",
          { class: `hbar ${d.onClick || d.href ? "clickable" : ""}`, href: d.href || null, tabindex: d.onClick ? "0" : null },
          h("span", { class: "hbar-label", title: d.label }, d.label, d.sub ? h("small", {}, d.sub) : null),
          h("span", { class: "hbar-track" }, h("span", { class: "hbar-fill", style: { width: (Math.abs(d.value) / max) * 100 + "%", background: d.color || "var(--c1)" } })),
          h("span", { class: "hbar-val" }, d.valueLabel !== undefined ? d.valueLabel : fmtV(d.value))
        );
        hover(row, d.label, [{ value: d.valueLabel !== undefined ? d.valueLabel : fmtV(d.value), label: opts.unit || "", color: d.color }].concat(d.extra || []));
        if (d.onClick) {
          row.addEventListener("click", d.onClick);
          row.addEventListener("keydown", (e) => e.key === "Enter" && d.onClick());
        }
        return row;
      })
    );
  }

  // stacked horizontal bars: rows: [{label, segments:[{value,color,label}], onClick}]
  function stackedHBars(rows, opts = {}) {
    const max = opts.max || Math.max(1, ...rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0)));
    return h(
      "div",
      { class: "hbars" },
      rows.map((r) => {
        const tot = r.segments.reduce((s, x) => s + x.value, 0);
        const row = h(
          "div",
          { class: `hbar ${r.onClick ? "clickable" : ""}` },
          h("span", { class: "hbar-label", title: r.label }, r.label),
          h(
            "span",
            { class: "hbar-track stacked" },
            r.segments.filter((s) => s.value > 0).map((s) => {
              const seg = h("span", { class: "hbar-seg", style: { width: (s.value / max) * 100 + "%", background: s.color } });
              hover(seg, r.label, [{ value: (opts.format || String)(s.value), label: s.label, color: s.color }]);
              return seg;
            })
          ),
          h("span", { class: "hbar-val" }, (opts.format || String)(tot))
        );
        if (r.onClick) row.addEventListener("click", r.onClick);
        return row;
      })
    );
  }

  // ---------------------------------------------------------------- column chart (SVG)
  // categories: [label]; series: [{name, color, values:[], stack?:bool}]; lines: [{name,color,values,dash}]
  // opts: {height, format, onClick(i), zero}
  function columns(host, categories, series, opts = {}) {
    const W = width(host);
    const H = opts.height || 280;
    const m = { t: 16, r: 16, b: 34, l: 64 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const lines = opts.lines || [];
    const stacked = opts.stacked !== false;
    const fmtV = opts.format || ((v) => v);
    // extents
    let lo = 0;
    let hi = 0;
    categories.forEach((_, i) => {
      if (stacked) {
        let pos = 0;
        let neg = 0;
        series.forEach((s) => (s.values[i] >= 0 ? (pos += s.values[i]) : (neg += s.values[i])));
        hi = Math.max(hi, pos);
        lo = Math.min(lo, neg);
      } else series.forEach((s) => ((hi = Math.max(hi, s.values[i])), (lo = Math.min(lo, s.values[i]))));
      lines.forEach((l) => ((hi = Math.max(hi, l.values[i])), (lo = Math.min(lo, l.values[i]))));
    });
    const ticks = niceTicks(lo, hi, 5);
    lo = ticks[0];
    hi = ticks[ticks.length - 1];
    const y = (v) => m.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
    const band = iw / categories.length;
    const groups = stacked ? 1 : series.length;
    const bw = Math.min(56, band * 0.62);
    const sub = bw / groups;
    const svg = h("svg", { width: W, height: H, class: "chart-svg", role: "img", "aria-label": opts.ariaLabel || "Column chart" });
    ticks.forEach((t) => {
      svg.appendChild(h("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? "axis-zero" : "grid" }));
      svg.appendChild(h("text", { x: m.l - 8, y: y(t) + 4, class: "tick", "text-anchor": "end" }, fmtV(t)));
    });
    categories.forEach((c, i) => {
      const cx = m.l + band * i + band / 2;
      svg.appendChild(h("text", { x: cx, y: H - 12, class: "tick", "text-anchor": "middle" }, c));
      let pos = 0;
      let neg = 0;
      series.forEach((s, si) => {
        const v = s.values[i] || 0;
        if (!v) return;
        let y0, y1, x;
        if (stacked) {
          x = cx - bw / 2;
          if (v >= 0) {
            y0 = y(pos + v);
            y1 = y(pos);
            pos += v;
          } else {
            y0 = y(neg);
            y1 = y(neg + v);
            neg += v;
          }
        } else {
          x = cx - bw / 2 + sub * si;
          y0 = y(Math.max(0, v));
          y1 = y(Math.min(0, v));
        }
        const hgt = Math.max(1, y1 - y0 - (stacked ? 2 : 0));
        svg.appendChild(h("rect", { x: x + (stacked ? 0 : 1), y: y0 + (stacked && v >= 0 ? 0 : 0), width: Math.max(2, (stacked ? bw : sub) - (stacked ? 0 : 2)), height: hgt, rx: 3, fill: s.color, class: "col" }));
      });
    });
    lines.forEach((l) => {
      const pts = categories.map((_, i) => `${m.l + band * i + band / 2},${y(l.values[i])}`).join(" ");
      svg.appendChild(h("polyline", { points: pts, fill: "none", stroke: l.color, "stroke-width": 2, "stroke-dasharray": l.dash || null, class: "series-line" }));
      categories.forEach((_, i) => svg.appendChild(h("circle", { cx: m.l + band * i + band / 2, cy: y(l.values[i]), r: 4, fill: l.color, stroke: "var(--surface)", "stroke-width": 2 })));
    });
    // hover bands (one tooltip listing every series at that category)
    categories.forEach((c, i) => {
      const hit = h("rect", { x: m.l + band * i, y: m.t, width: band, height: ih, class: `hit ${opts.onClick ? "clickable" : ""}`, fill: "transparent", tabindex: "0" });
      hover(hit, opts.tipTitle ? opts.tipTitle(i) : c, () => series.map((s) => ({ value: fmtV(s.values[i]), label: s.name, color: s.color })).concat(lines.map((l) => ({ value: fmtV(l.values[i]), label: l.name, color: l.color }))));
      if (opts.onClick) hit.addEventListener("click", () => opts.onClick(i));
      svg.appendChild(hit);
    });
    return svg;
  }

  function niceTicks(lo, hi, n) {
    if (lo === hi) hi = lo + 1;
    const span = hi - lo;
    const step0 = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const start = Math.floor(lo / step) * step;
    const end = Math.ceil(hi / step) * step;
    const out = [];
    for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }

  // ---------------------------------------------------------------- heatmap (HTML grid)
  // rows: [{key,label}], cols: [{key,label}], cell(r,c) → {value, label, color?, onClick}
  function heatmap(rows, cols, cell, opts = {}) {
    const max = opts.max || Math.max(1, ...rows.flatMap((r) => cols.map((c) => (cell(r, c) || {}).value || 0)));
    const grid = h("div", { class: "heat", style: { gridTemplateColumns: `minmax(90px, max-content) repeat(${cols.length}, minmax(${opts.minCol || 44}px, 1fr))` } });
    grid.appendChild(h("div", { class: "heat-corner" }, opts.corner || ""));
    cols.forEach((c) => grid.appendChild(h("div", { class: "heat-col" }, c.label)));
    rows.forEach((r) => {
      grid.appendChild(h("div", { class: "heat-row" }, r.label));
      cols.forEach((c) => {
        const d = cell(r, c) || { value: 0 };
        const t = d.value ? Math.min(1, d.value / max) : 0;
        const bg = d.color || (d.value ? `color-mix(in oklab, var(--seq-hi) ${Math.round(18 + t * 82)}%, var(--seq-lo))` : "var(--heat-empty)");
        const el = h("div", { class: `heat-cell ${d.onClick ? "clickable" : ""} ${t > 0.55 && !d.color ? "dark" : ""} ${d.active ? "active" : ""}`, style: { background: bg }, tabindex: d.onClick ? "0" : null }, d.text !== undefined ? d.text : d.value || "");
        hover(el, `${r.label} · ${c.label}`, [{ value: d.label || d.value || 0, label: opts.unit || "" }]);
        if (d.onClick) {
          el.addEventListener("click", d.onClick);
          el.addEventListener("keydown", (e) => e.key === "Enter" && d.onClick());
        }
        grid.appendChild(el);
      });
    });
    return h("div", { class: "heat-wrap" }, opts.yTitle ? h("div", { class: "heat-ytitle" }, opts.yTitle) : null, grid, opts.xTitle ? h("div", { class: "heat-xtitle" }, opts.xTitle) : null);
  }

  // ---------------------------------------------------------------- gauge (semi-circle score)
  function gauge(value, max, opts = {}) {
    const W = 120;
    const H = 70;
    const r = 50;
    const cx = W / 2;
    const cy = 60;
    const t = value === null || value === undefined ? 0 : Math.max(0, Math.min(1, (value - (opts.min || 0)) / (max - (opts.min || 0))));
    const arc = (a0, a1) => {
      const p = (a) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      return `M${p(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
    };
    const svg = h(
      "svg",
      { viewBox: `0 0 ${W} ${H}`, class: "gauge-svg", role: "img", "aria-label": `${opts.label}: ${value}` },
      h("path", { d: arc(Math.PI, 2 * Math.PI), class: "gauge-track", fill: "none", "stroke-width": 10, "stroke-linecap": "round" }),
      t > 0 ? h("path", { d: arc(Math.PI, Math.PI + Math.max(0.02, t) * Math.PI), fill: "none", stroke: opts.color || "var(--accent)", "stroke-width": 10, "stroke-linecap": "round" }) : null
    );
    return h(
      "div",
      { class: "gauge" },
      svg,
      h("div", { class: "gauge-val" }, value === null || value === undefined ? "—" : opts.format ? opts.format(value) : value, h("small", {}, opts.unit || "")),
      h("div", { class: "gauge-label" }, opts.label || ""),
      opts.sub ? h("div", { class: "gauge-sub" }, opts.sub) : null
    );
  }

  // ---------------------------------------------------------------- scatter (SVG)
  // points: [{x, y, label, color, r, onClick, tipTitle, tipRows, highlight}]
  // opts: {x:{min,max,label,ticks}, y:{...}, height, quadrants:{x, y, labels:{tl,tr,bl,br}, fills}, labels:bool}
  function scatter(host, points, opts = {}) {
    const W = width(host);
    const H = opts.height || Math.min(520, Math.max(300, W * 0.62));
    const m = { t: 18, r: 22, b: 46, l: 54 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const xs = opts.x;
    const ys = opts.y;
    const X = (v) => m.l + ((v - xs.min) / (xs.max - xs.min)) * iw;
    const Y = (v) => m.t + ih - ((v - ys.min) / (ys.max - ys.min)) * ih;
    const svg = h("svg", { width: W, height: H, class: "chart-svg scatter", role: "img", "aria-label": opts.ariaLabel || "Scatter plot" });
    const q = opts.quadrants;
    if (q) {
      const qx = X(q.x);
      const qy = Y(q.y);
      const cells = [
        { k: "tl", x: m.l, y: m.t, w: qx - m.l, h: qy - m.t },
        { k: "tr", x: qx, y: m.t, w: m.l + iw - qx, h: qy - m.t },
        { k: "bl", x: m.l, y: qy, w: qx - m.l, h: m.t + ih - qy },
        { k: "br", x: qx, y: qy, w: m.l + iw - qx, h: m.t + ih - qy },
      ];
      cells.forEach((c) => {
        svg.appendChild(h("rect", { x: c.x, y: c.y, width: Math.max(0, c.w), height: Math.max(0, c.h), fill: (q.fills && q.fills[c.k]) || "transparent", class: "quad-fill" }));
        const lbl = q.labels && q.labels[c.k];
        if (lbl) {
          const right = c.k.endsWith("r");
          const bottom = c.k.startsWith("b");
          svg.appendChild(h("text", { x: right ? c.x + c.w - 10 : c.x + 10, y: bottom ? c.y + c.h - 10 : c.y + 18, class: "quad-label", "text-anchor": right ? "end" : "start" }, lbl));
        }
      });
      svg.appendChild(h("line", { x1: qx, x2: qx, y1: m.t, y2: m.t + ih, class: "quad-line" }));
      svg.appendChild(h("line", { x1: m.l, x2: m.l + iw, y1: qy, y2: qy, class: "quad-line" }));
    }
    const tx = xs.ticks || niceTicks(xs.min, xs.max, 5).filter((t) => t >= xs.min && t <= xs.max);
    const ty = ys.ticks || niceTicks(ys.min, ys.max, 5).filter((t) => t >= ys.min && t <= ys.max);
    tx.forEach((t) => {
      if (!q) svg.appendChild(h("line", { x1: X(t), x2: X(t), y1: m.t, y2: m.t + ih, class: "grid" }));
      svg.appendChild(h("text", { x: X(t), y: m.t + ih + 18, class: "tick", "text-anchor": "middle" }, t));
    });
    ty.forEach((t) => {
      if (!q) svg.appendChild(h("line", { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: "grid" }));
      svg.appendChild(h("text", { x: m.l - 8, y: Y(t) + 4, class: "tick", "text-anchor": "end" }, t));
    });
    svg.appendChild(h("rect", { x: m.l, y: m.t, width: iw, height: ih, class: "plot-frame", fill: "none" }));
    svg.appendChild(h("text", { x: m.l + iw / 2, y: H - 8, class: "axis-title", "text-anchor": "middle" }, xs.label || ""));
    svg.appendChild(h("text", { x: 14, y: m.t + ih / 2, class: "axis-title", "text-anchor": "middle", transform: `rotate(-90 14 ${m.t + ih / 2})` }, ys.label || ""));

    // dots (sorted so highlighted render last), then labels with greedy collision avoidance
    const placed = [];
    const dots = h("g");
    const labels = h("g", { class: "pt-labels" });
    points
      .slice()
      .sort((a, b) => (a.highlight ? 1 : 0) - (b.highlight ? 1 : 0))
      .forEach((p) => {
        if (p.x === null || p.y === null || p.x === undefined || p.y === undefined) return;
        const cx = X(p.x);
        const cy = Y(p.y);
        const r = p.r || 7;
        const g = h("g", { class: `pt ${p.onClick ? "clickable" : ""} ${p.dim ? "dim" : ""} ${p.highlight ? "hl" : ""}`, tabindex: "0", role: p.onClick ? "link" : null, "aria-label": p.label });
        g.appendChild(h("circle", { cx, cy, r: Math.max(12, r + 6), fill: "transparent" }));
        g.appendChild(h("circle", { cx, cy, r, fill: p.color || "var(--c1)", stroke: "var(--surface)", "stroke-width": 2, class: "pt-dot" }));
        hover(g, p.tipTitle || p.label, p.tipRows || []);
        if (p.onClick) {
          g.addEventListener("click", p.onClick);
          g.addEventListener("keydown", (e) => e.key === "Enter" && p.onClick());
        }
        dots.appendChild(g);
        if (opts.labels !== false && p.label && !p.dim) {
          const tw = p.label.length * 6.1 + 4;
          let lx = cx + r + 4;
          let anchor = "start";
          if (lx + tw > m.l + iw) {
            lx = cx - r - 4;
            anchor = "end";
          }
          let ly = cy + 4;
          const box = () => (anchor === "start" ? { x0: lx, x1: lx + tw } : { x0: lx - tw, x1: lx });
          const hits = (yy) => placed.some((b) => Math.abs(b.y - yy) < 12 && !(box().x1 < b.x0 || box().x0 > b.x1));
          const tries = [0, -12, 12, -24, 24, -36, 36];
          const ok = tries.find((d) => !hits(cy + 4 + d));
          if (ok === undefined) return; // no free slot: name stays available on hover / focus
          ly = cy + 4 + ok;
          placed.push({ y: ly, ...box() });
          labels.appendChild(h("text", { x: lx, y: ly, class: "pt-label", "text-anchor": anchor }, p.label));
        }
      });
    svg.appendChild(dots);
    svg.appendChild(labels);
    return svg;
  }

  OT.charts = { donut, hbars, stackedHBars, columns, heatmap, gauge, scatter, niceTicks, width };
})();
