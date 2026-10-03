/* UI helpers: DOM builder, formatting, colour roles, tooltip, sortable table, filters. */
(function () {
  "use strict";
  const OT = (window.OT = window.OT || {});
  OT.views = OT.views || {};

  // ---------------------------------------------------------------- DOM
  // h("div", {class: "x", onclick: fn}, child, "text", [children...])
  function h(tag, attrs, ...children) {
    const svg = ["svg", "g", "rect", "circle", "path", "line", "text", "polyline", "polygon", "defs", "marker", "title", "tspan", "clipPath", "pattern"].includes(tag);
    const el = svg ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
    if (attrs)
      Object.entries(attrs).forEach(([k, v]) => {
        if (v === null || v === undefined || v === false) return;
        if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "class") el.setAttribute("class", v);
        else if (k === "style" && typeof v === "object")
          Object.entries(v).forEach(([p, val]) => {
            if (val === null || val === undefined) return;
            if (p.startsWith("--") || p.includes("-")) el.style.setProperty(p, val);
            else el.style[p] = val;
          });
        else if (k === "dataset") Object.assign(el.dataset, v);
        else if (k === "text") el.textContent = v;
        else el.setAttribute(k, v === true ? "" : v);
      });
    append(el, children);
    return el;
  }
  function append(el, children) {
    children.flat(Infinity).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  }
  const clear = (el) => {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  };

  // ---------------------------------------------------------------- formatting
  let currency = "USD";
  const fmt = {
    setCurrency(c) {
      currency = c || "USD";
    },
    money(v, opts = {}) {
      if (v === null || v === undefined || isNaN(v)) return "—";
      const neg = v < 0;
      const a = Math.abs(v);
      let s;
      if (opts.full) s = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(a);
      else if (a >= 1e9) s = sym() + (a / 1e9).toFixed(2) + "B";
      else if (a >= 1e6) s = sym() + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "M";
      else if (a >= 1e3) s = sym() + Math.round(a / 1e3) + "K";
      else s = sym() + Math.round(a);
      return neg ? "−" + s : s;
    },
    num(v, d = 0) {
      if (v === null || v === undefined || isNaN(v)) return "—";
      return Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    },
    pct(v, d = 0) {
      if (v === null || v === undefined || isNaN(v)) return "—";
      return (v * 100).toFixed(d) + "%";
    },
    score(v, d = 1) {
      return v === null || v === undefined || isNaN(v) ? "—" : Number(v).toFixed(d);
    },
    date(s) {
      if (!s) return "—";
      const d = new Date(s);
      return isNaN(d) ? String(s) : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    },
  };
  function sym() {
    try {
      return (0).toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).replace(/[\d.,\s]/g, "") || "$";
    } catch (e) {
      return "$";
    }
  }

  // ---------------------------------------------------------------- colour roles
  // Categorical slots are CSS variables (--c1..--c8), assigned to entities in a
  // fixed order taken from the data (strategy order in config, wave order, ...),
  // so a colour always follows its entity, never its rank.
  const SLOT = (i) => `var(--c${(i % 8) + 1})`;
  const colors = {
    strategy(model, id) {
      const i = model.strategies.findIndex((s) => s.id === id);
      // never cycle hues: anything past the 8 slots (or undecided) is neutral
      return i < 0 || i > 7 || /^undecided$/i.test(id) ? "var(--neutral)" : SLOT(i);
    },
    wave(model, id) {
      const i = model.waves.findIndex((w) => w.id === id);
      return i < 0 || i > 7 ? "var(--neutral)" : SLOT(i);
    },
    domain(model, d) {
      const i = model.portfolio.domains.indexOf(d);
      return i < 0 || i > 7 ? "var(--neutral)" : SLOT(i);
    },
    level(label) {
      const l = String(label || "").toLowerCase();
      if (["critical", "blocker", "very high"].includes(l)) return "var(--st-critical)";
      if (["high", "gap", "not ready"].includes(l)) return "var(--st-serious)";
      if (["medium", "partially ready", "in progress", "under review"].includes(l)) return "var(--st-warning)";
      if (["low", "ready", "done", "approved", "proceed"].includes(l)) return "var(--st-good)";
      return "var(--neutral)";
    },
  };

  // ---------------------------------------------------------------- badges & chips
  function badge(text, kind) {
    return h("span", { class: `badge ${kind ? "badge-" + kind : ""}` }, text);
  }
  const STATUS_ICON = { ready: "✓", gap: "!", blocker: "✕", critical: "▲", high: "▲", medium: "●", low: "▼", approved: "✓", proceed: "→", "under review": "…", pending: "○", done: "✓", "in progress": "◐", open: "○", mitigating: "◐", accepted: "✓", closed: "✓" };
  function statusPill(text) {
    const k = String(text || "").toLowerCase();
    return h("span", { class: `pill pill-${k.replace(/\s+/g, "-")}` }, h("span", { class: "pill-ico", "aria-hidden": "true" }, STATUS_ICON[k] || "•"), text || "—");
  }
  function levelPill(text) {
    if (!text) return h("span", { class: "muted" }, "—");
    return h("span", { class: "lvl", style: { "--lvl": colors.level(text) } }, h("span", { class: "lvl-dot" }), text);
  }
  function strategyChip(model, s) {
    return h("span", { class: "chip", style: { "--chip": colors.strategy(model, s) } }, h("span", { class: "chip-dot" }), s);
  }
  function waveChip(model, w) {
    if (!w) return h("span", { class: "muted" }, "Unassigned");
    return h("a", { class: "chip chip-link", href: `#/waves?wave=${encodeURIComponent(w.id)}`, style: { "--chip": colors.wave(model, w.id) } }, h("span", { class: "chip-dot" }), w.shortName || w.name);
  }
  function appLink(app, label) {
    return h("a", { class: "app-link", href: `#/app/${encodeURIComponent(app.id)}` }, label || app.name);
  }
  // horizontal meter for 0..max values
  function meter(value, max, color, label) {
    const pct = value === null || value === undefined ? 0 : Math.max(0, Math.min(1, value / max));
    return h(
      "span",
      { class: "meter", title: label || "" },
      h("span", { class: "meter-track" }, h("span", { class: "meter-fill", style: { width: pct * 100 + "%", background: color || "var(--accent)" } })),
      h("span", { class: "meter-val" }, value === null || value === undefined ? "—" : fmt.score(value, max > 10 ? 0 : 1))
    );
  }

  // ---------------------------------------------------------------- tooltip
  let tipEl = null;
  function tip() {
    if (!tipEl) {
      tipEl = h("div", { class: "tooltip", role: "tooltip" });
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  // rows: [{label, value, color}] ; title string
  function showTip(evt, title, rows) {
    const t = clear(tip());
    if (title) t.appendChild(h("div", { class: "tt-title" }, title));
    (rows || []).forEach((r) =>
      t.appendChild(h("div", { class: "tt-row" }, r.color ? h("span", { class: "tt-key", style: { background: r.color } }) : null, h("span", { class: "tt-val" }, r.value), h("span", { class: "tt-lbl" }, r.label)))
    );
    t.classList.add("show");
    moveTip(evt);
  }
  function moveTip(evt) {
    const t = tip();
    let x, y;
    if (evt && evt.clientX !== undefined && !(evt.type === "focus")) {
      x = evt.clientX;
      y = evt.clientY;
    } else if (evt && evt.target && evt.target.getBoundingClientRect) {
      const r = evt.target.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top;
    } else return;
    const w = t.offsetWidth;
    const hgt = t.offsetHeight;
    let left = x + 14;
    let top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + hgt > window.innerHeight - 8) top = y - hgt - 14;
    t.style.left = Math.max(8, left) + "px";
    t.style.top = Math.max(8, top) + "px";
  }
  function hideTip() {
    if (tipEl) tipEl.classList.remove("show");
  }
  // attach tooltip behaviour to an element
  function hover(el, title, rows) {
    const show = (e) => showTip(e, typeof title === "function" ? title() : title, typeof rows === "function" ? rows() : rows);
    el.addEventListener("pointerenter", show);
    el.addEventListener("pointermove", moveTip);
    el.addEventListener("pointerleave", hideTip);
    el.addEventListener("focus", show);
    el.addEventListener("blur", hideTip);
    return el;
  }

  // ---------------------------------------------------------------- cards & layout
  function card(title, opts = {}, ...body) {
    return h(
      "section",
      { class: `card ${opts.class || ""}`, id: opts.id || null },
      title || opts.actions
        ? h("header", { class: "card-head" }, h("div", {}, title ? h("h3", {}, title) : null, opts.sub ? h("p", { class: "card-sub" }, opts.sub) : null), opts.actions ? h("div", { class: "card-actions" }, opts.actions) : null)
        : null,
      h("div", { class: "card-body" }, body)
    );
  }
  function kpi(label, value, opts = {}) {
    const el = h(
      opts.href ? "a" : "div",
      { class: `kpi ${opts.class || ""}`, href: opts.href || null },
      h("div", { class: "kpi-label" }, label),
      h("div", { class: "kpi-value" }, value),
      opts.sub ? h("div", { class: "kpi-sub" }, opts.sub) : null
    );
    return el;
  }
  function pageHead(title, sub, actions) {
    return h("div", { class: "page-head" }, h("div", {}, h("h1", {}, title), sub ? h("p", { class: "page-sub" }, sub) : null), actions ? h("div", { class: "page-actions" }, actions) : null);
  }
  function empty(text) {
    return h("div", { class: "empty" }, text || "No data available.");
  }
  function legend(items) {
    return h(
      "div",
      { class: "legend" },
      items.map((i) => h("span", { class: "legend-item" }, h("span", { class: `legend-key ${i.line ? "line" : ""}`, style: { background: i.color } }), i.label))
    );
  }

  // ---------------------------------------------------------------- sortable table
  // columns: [{key, label, value(row) → sortable, render(row) → node|string, align, class, width}]
  function table(opts) {
    const state = { sort: opts.sort || null, dir: opts.dir || "desc" };
    const wrap = h("div", { class: "table-wrap" });
    const tbl = h("table", { class: `tbl ${opts.class || ""}` });
    wrap.appendChild(tbl);
    function val(c, r) {
      return c.value ? c.value(r) : r[c.key];
    }
    function draw() {
      clear(tbl);
      let rows = opts.rows.slice();
      if (state.sort) {
        const c = opts.columns.find((x) => x.key === state.sort);
        if (c) {
          rows.sort((a, b) => {
            const va = val(c, a);
            const vb = val(c, b);
            if (va === vb) return 0;
            if (va === null || va === undefined || va === "") return 1;
            if (vb === null || vb === undefined || vb === "") return -1;
            const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true });
            return state.dir === "asc" ? r : -r;
          });
        }
      }
      const thead = h(
        "thead",
        {},
        h(
          "tr",
          {},
          opts.columns.map((c) => {
            const sortable = c.sortable !== false;
            const active = state.sort === c.key;
            const th = h(
              "th",
              { class: `${c.align === "right" ? "num" : ""} ${sortable ? "sortable" : ""} ${active ? "sorted" : ""} ${c.class || ""}`, style: c.width ? { width: c.width } : null, scope: "col", "aria-sort": active ? (state.dir === "asc" ? "ascending" : "descending") : null },
              sortable ? h("button", { class: "th-btn", type: "button" }, c.label, h("span", { class: "sort-ind", "aria-hidden": "true" }, active ? (state.dir === "asc" ? "▲" : "▼") : "↕")) : c.label
            );
            if (sortable)
              th.querySelector("button").addEventListener("click", () => {
                if (state.sort === c.key) state.dir = state.dir === "asc" ? "desc" : "asc";
                else {
                  state.sort = c.key;
                  state.dir = c.defaultDir || (typeof val(c, opts.rows[0] || {}) === "number" ? "desc" : "asc");
                }
                draw();
              });
            return th;
          })
        )
      );
      const tbody = h("tbody");
      if (!rows.length) tbody.appendChild(h("tr", {}, h("td", { colspan: opts.columns.length, class: "empty-row" }, opts.emptyText || "No rows match the current filters.")));
      rows.forEach((r) => {
        const tr = h(
          "tr",
          { class: opts.onRowClick ? "clickable" : "", tabindex: opts.onRowClick ? "0" : null },
          opts.columns.map((c) => {
            const content = c.render ? c.render(r) : val(c, r);
            return h("td", { class: `${c.align === "right" ? "num" : ""} ${c.class || ""}` }, content === null || content === undefined || content === "" ? h("span", { class: "muted" }, "—") : content);
          })
        );
        if (opts.onRowClick) {
          tr.addEventListener("click", (e) => {
            if (e.target.closest("a,button,input,select")) return;
            opts.onRowClick(r);
          });
          tr.addEventListener("keydown", (e) => {
            if (e.key === "Enter") opts.onRowClick(r);
          });
        }
        tbody.appendChild(tr);
      });
      tbl.append(thead, tbody);
      if (opts.footer) tbl.appendChild(opts.footer(rows));
    }
    draw();
    wrap.redraw = (rows) => {
      if (rows) opts.rows = rows;
      draw();
    };
    return wrap;
  }

  // ---------------------------------------------------------------- filters
  // fields: [{key, label, options:[{value,label}] | values:[...], type:"select"|"search"}]
  // state is mirrored to the URL query so filtered views are linkable.
  function filterBar(fields, state, onChange) {
    const bar = h("div", { class: "filters", role: "search" });
    fields.forEach((f) => {
      if (f.type === "search") {
        const inp = h("input", { type: "search", class: "f-search", placeholder: f.placeholder || "Search…", value: state[f.key] || "", "aria-label": f.label || "Search" });
        inp.addEventListener("input", () => {
          state[f.key] = inp.value;
          onChange(state, f.key);
        });
        bar.appendChild(h("label", { class: "f-field f-grow" }, inp));
        return;
      }
      const opts = (f.options || (f.values || []).map((v) => ({ value: v, label: v }))).filter((o) => o.value !== undefined && o.value !== null && o.value !== "");
      const sel = h("select", { "aria-label": f.label }, h("option", { value: "" }, `${f.label}: All`), opts.map((o) => h("option", { value: o.value, selected: String(state[f.key] || "") === String(o.value) ? true : null }, `${f.label}: ${o.label}`)));
      sel.addEventListener("change", () => {
        state[f.key] = sel.value;
        onChange(state, f.key);
      });
      bar.appendChild(h("label", { class: `f-field ${state[f.key] ? "active" : ""}` }, sel));
    });
    const reset = h("button", { class: "btn btn-ghost", type: "button" }, "Reset");
    reset.addEventListener("click", () => {
      Object.keys(state).forEach((k) => (state[k] = ""));
      onChange(state, null, true);
    });
    bar.appendChild(reset);
    return bar;
  }

  // replace query params in the current hash without adding history entries
  function setQuery(params) {
    const [path] = location.hash.slice(1).split("?");
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== "" && v !== null && v !== undefined) q.set(k, v);
    });
    const s = q.toString();
    history.replaceState(null, "", "#" + path + (s ? "?" + s : ""));
  }

  function downloadCSV(filename, columns, rows) {
    const esc = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [columns.map((c) => esc(c.label)).join(",")].concat(rows.map((r) => columns.map((c) => esc(c.csv ? c.csv(r) : c.value ? c.value(r) : r[c.key])).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = h("a", { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 100);
  }

  OT.ui = { h, append, clear, badge, statusPill, levelPill, strategyChip, waveChip, appLink, meter, showTip, moveTip, hideTip, hover, card, kpi, pageHead, empty, legend, table, filterBar, setQuery, downloadCSV, colors };
  OT.fmt = fmt;
})();
