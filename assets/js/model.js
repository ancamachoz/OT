/*
 * Data model pipeline.
 *
 *   JSON → Application Catalog → Assessment Analysis → Migration Decisions
 *        → Roadmap & Waves → Business Case
 *
 * Everything the UI shows is derived here from the raw JSON. Nothing about the
 * portfolio is hard-coded: counts, categories, colours, waves, years and
 * thresholds are all read from (or computed from) the data file.
 */
(function () {
  "use strict";
  const OT = (window.OT = window.OT || {});

  // ---------------------------------------------------------------- helpers
  const num = (v, d = null) => (v === null || v === undefined || v === "" || isNaN(+v) ? d : +v);
  const arr = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
  const get = (obj, path, d) => {
    let cur = obj;
    for (const k of path.split(".")) {
      if (cur === null || cur === undefined) return d;
      cur = cur[k];
    }
    return cur === undefined || cur === null ? d : cur;
  };
  const uniq = (xs) => Array.from(new Set(xs.filter((x) => x !== undefined && x !== null && x !== "")));
  const sum = (xs, f = (x) => x) => xs.reduce((s, x) => s + (num(f(x), 0) || 0), 0);
  const mean = (xs) => (xs.length ? sum(xs) / xs.length : null);
  const countBy = (xs, f) => {
    const m = new Map();
    xs.forEach((x) => arr(f(x)).forEach((k) => m.set(k, (m.get(k) || 0) + 1)));
    return m;
  };

  // Quarters: "2027-Q1", "Q1 2027", "2027Q1" → absolute quarter index
  function parseQuarter(q) {
    if (!q) return null;
    const s = String(q).toUpperCase();
    let m = s.match(/(\d{4})\s*-?\s*Q([1-4])/);
    if (m) return +m[1] * 4 + (+m[2] - 1);
    m = s.match(/Q([1-4])\s*[-/ ]?\s*(\d{4})/);
    if (m) return +m[2] * 4 + (+m[1] - 1);
    m = s.match(/^(\d{4})-(\d{2})/); // ISO date
    if (m) return +m[1] * 4 + Math.floor((+m[2] - 1) / 3);
    return null;
  }
  const quarterLabel = (i) => (i === null || i === undefined ? "—" : `Q${(i % 4) + 1} ${Math.floor(i / 4)}`);

  function levelFor(value, levels) {
    if (value === null || value === undefined || !levels || !levels.length) return null;
    for (const l of levels) if (value <= l.max) return l.label;
    return levels[levels.length - 1].label;
  }

  const DEFAULT_CONFIG = {
    strategies: ["Rehost", "Replatform", "Refactor", "Relocate", "Repurchase", "Retain", "Retire"].map((id) => ({ id, label: id })),
    priorityScoring: {
      normalize: true,
      factors: [
        { key: "businessCriticality", label: "Business Criticality", weight: 0.3 },
        { key: "riskReduction", label: "Risk Reduction / Resilience", weight: 0.2 },
        { key: "dependencyCentrality", label: "Dependency Centrality", weight: 0.2 },
        { key: "regulatoryUrgency", label: "Regulatory Urgency", weight: 0.15 },
        { key: "migrationEffort", label: "Migration Effort", weight: -0.1 },
        { key: "technicalComplexity", label: "Technical Complexity", weight: -0.05 },
      ],
    },
    complexityDrivers: [],
    scales: { businessValue: { min: 1, max: 5 }, cloudBenefit: { min: 1, max: 5 }, migrationComplexity: { min: 1, max: 5 }, cloudReadiness: { min: 0, max: 100 }, migrationRisk: { min: 0, max: 100 } },
    levels: {
      complexity: [{ label: "Low", max: 2.5 }, { label: "Medium", max: 3.5 }, { label: "High", max: 5 }],
      risk: [{ label: "Low", max: 40 }, { label: "Medium", max: 60 }, { label: "High", max: 80 }, { label: "Critical", max: 100 }],
      readiness: [{ label: "Not ready", max: 40 }, { label: "Partially ready", max: 70 }, { label: "Ready", max: 100 }],
    },
    quadrants: {
      xMetric: "migrationComplexity", yMetric: "businessValue", xThreshold: 3, yThreshold: 3,
      definitions: [
        { id: "quick-wins", name: "Migrate / Quick Wins", value: "high", complexity: "low" },
        { id: "optimize", name: "Optimize", value: "high", complexity: "high" },
        { id: "invest", name: "Invest", value: "low", complexity: "high" },
        { id: "tolerate", name: "Tolerate / Eliminate", value: "low", complexity: "low" },
      ],
    },
    businessCase: { startYear: null, horizonYears: 5 },
    decisionStatuses: [],
  };

  function mergeConfig(cfg) {
    const c = Object.assign({}, DEFAULT_CONFIG, cfg || {});
    c.scales = Object.assign({}, DEFAULT_CONFIG.scales, get(cfg, "scales", {}));
    c.levels = Object.assign({}, DEFAULT_CONFIG.levels, get(cfg, "levels", {}));
    c.quadrants = Object.assign({}, DEFAULT_CONFIG.quadrants, get(cfg, "quadrants", {}));
    c.priorityScoring = Object.assign({}, DEFAULT_CONFIG.priorityScoring, get(cfg, "priorityScoring", {}));
    c.businessCase = Object.assign({}, DEFAULT_CONFIG.businessCase, get(cfg, "businessCase", {}));
    c.strategies = arr(c.strategies).map((s) => (typeof s === "string" ? { id: s, label: s } : s));
    return c;
  }

  // ================================================================ build
  function build(raw) {
    const warnings = [];
    if (!raw || typeof raw !== "object") throw new Error("The data file is not a JSON object.");
    const rawApps = arr(raw.applications);
    if (!rawApps.length) throw new Error("The data file has no \"applications\" array.");

    const config = mergeConfig(raw.config);
    const meta = Object.assign({ title: "Cloud Migration Readiness Assessment", currency: "USD" }, raw.meta || {});

    // ------------------------------------------------ 1. Application Catalog
    const waveDefs = arr(raw.waves).map((w, i) => ({
      ...w,
      id: w.id || `W${i}`,
      order: num(w.order, i),
      name: w.name || w.id || `Wave ${i}`,
      shortName: w.shortName || w.name || w.id,
      startQ: parseQuarter(w.startQuarter),
      endQ: parseQuarter(w.endQuarter),
    }));
    const waveById = new Map(waveDefs.map((w) => [w.id, w]));
    const agDefs = arr(raw.affinityGroups).map((g) => ({ ...g }));
    const agById = new Map(agDefs.map((g) => [g.id, g]));
    const infra = arr(raw.sharedInfrastructure).map((i) => ({ ...i }));
    const infraById = new Map(infra.map((i) => [i.id, i]));

    const catalog = rawApps.map((r, idx) => {
      const id = r.id || `APP-${idx + 1}`;
      if (!r.id) warnings.push(`Application #${idx + 1} has no id; generated "${id}".`);
      const a = get(r, "assessment", {});
      const d = get(r, "decision", {});
      const p = get(r, "plan", {});
      const f = get(r, "financials", {});
      const waveId = p.wave || r.wave || null;
      if (waveId && !waveById.has(waveId)) {
        waveDefs.push({ id: waveId, name: waveId, shortName: waveId, order: waveDefs.length, startQ: null, endQ: null, synthetic: true });
        waveById.set(waveId, waveDefs[waveDefs.length - 1]);
        warnings.push(`Wave "${waveId}" used by ${id} is not defined in "waves"; it was added automatically.`);
      }
      const servers = arr(r.servers).map((s) => (typeof s === "string" ? { hostname: s } : s));
      return {
        raw: r,
        id,
        name: r.name || id,
        shortName: r.shortName || r.name || id,
        description: r.description || "",
        domain: r.domain || "Unassigned",
        businessFunction: r.businessFunction || "",
        appType: r.appType || "",
        businessOwner: r.businessOwner || "",
        technicalOwner: r.technicalOwner || "",
        criticality: r.criticality || "Unrated",
        tier: r.tier || "",
        users: r.users || null,
        architecture: r.architecture || {},
        technologies: arr(r.technologies).map((t) => (typeof t === "string" ? { name: t } : t)),
        hosting: r.hosting || {},
        servers,
        dependencies: arr(r.dependencies || r.integrations).map((x) => (typeof x === "string" ? { target: x } : x)),
        infrastructureDependencies: arr(r.infrastructureDependencies),
        sla: r.sla || {},
        regulatory: r.regulatory || {},
        // assessment
        businessValue: num(a.businessValue ?? r.businessValue),
        cloudBenefit: num(a.cloudBenefit ?? r.cloudBenefit),
        cloudReadiness: num(a.cloudReadiness ?? r.cloudReadiness),
        migrationRisk: num(a.migrationRisk ?? r.migrationRisk),
        effort: num(a.effortPersonWeeks ?? a.effort ?? r.effortPersonWeeks),
        complexityDrivers: a.complexityDrivers || {},
        complexityNotes: arr(a.complexityNotes),
        complexityGiven: num(a.migrationComplexity ?? r.migrationComplexity),
        priorityFactors: r.priorityFactors || {},
        priorityGiven: num(r.priorityScore ?? a.priorityScore),
        // decision
        strategy: d.strategy || r.strategy || "Undecided",
        rationale: d.rationale || "",
        decisionStatus: d.status || r.decisionStatus || "Pending",
        targetArchitecture: d.targetArchitecture || "",
        targetServices: arr(d.targetServices),
        prerequisites: arr(d.prerequisites),
        // plan
        waveId,
        startQ: parseQuarter(p.startQuarter),
        endQ: parseQuarter(p.endQuarter || p.targetQuarter),
        startQuarter: p.startQuarter || null,
        endQuarter: p.endQuarter || p.targetQuarter || null,
        durationWeeks: num(p.durationWeeks),
        pilot: !!p.pilot,
        // financials
        currentCost: num(f.currentAnnualRunCost, 0),
        targetCost: num(f.targetAnnualRunCost, 0),
        migrationCost: num(f.migrationCost, 0),
        avoidedCost: num(f.annualAvoidedCost, 0),
        affinityGroupId: r.affinityGroup || null,
      };
    });
    const appById = new Map(catalog.map((x) => [x.id, x]));

    // strategies: config order first, then any unknown strategies found in data
    const strategies = config.strategies.slice();
    uniq(catalog.map((x) => x.strategy)).forEach((s) => {
      if (!strategies.find((x) => x.id === s)) strategies.push({ id: s, label: s });
    });

    // ------------------------------------------------ 2. Assessment Analysis
    const driverDefs = config.complexityDrivers.length
      ? config.complexityDrivers
      : uniq(catalog.flatMap((x) => Object.keys(x.complexityDrivers))).map((k) => ({ key: k, label: k }));

    // dependency graph (consumer → provider)
    const extNodes = new Map();
    const edges = [];
    catalog.forEach((x) => {
      x.dependencies.forEach((dep) => {
        const target = dep.target || dep.appId || dep.id || dep.name;
        if (!target) return;
        const isApp = appById.has(target);
        if (!isApp && !extNodes.has(target)) extNodes.set(target, { id: target, name: target, external: true });
        edges.push({ from: x.id, to: target, toApp: isApp, type: dep.type || "", protocol: dep.protocol || "", criticality: dep.criticality || "Medium", description: dep.description || "" });
      });
      x.infrastructureDependencies.forEach((iid) => {
        if (!infraById.has(iid)) {
          infraById.set(iid, { id: iid, name: iid });
          infra.push(infraById.get(iid));
        }
      });
    });
    catalog.forEach((x) => {
      x.upstream = edges.filter((e) => e.from === x.id);
      x.downstream = edges.filter((e) => e.to === x.id);
      x.infra = x.infrastructureDependencies.map((i) => infraById.get(i));
    });
    const walk = (startId, dir) => {
      const seen = new Set();
      const stack = [startId];
      while (stack.length) {
        const cur = stack.pop();
        const next = dir === "up" ? edges.filter((e) => e.from === cur).map((e) => e.to) : edges.filter((e) => e.to === cur).map((e) => e.from);
        next.forEach((n) => {
          if (!seen.has(n) && n !== startId) {
            seen.add(n);
            stack.push(n);
          }
        });
      }
      return seen;
    };
    catalog.forEach((x) => {
      x.allUpstream = walk(x.id, "up");
      x.allDownstream = walk(x.id, "down");
    });

    const scaleMax = (k) => get(config, `scales.${k}.max`, 5);
    catalog.forEach((x) => {
      // migration complexity: provided, else mean of the complexity drivers
      const dv = driverDefs.map((d) => num(x.complexityDrivers[d.key])).filter((v) => v !== null);
      x.migrationComplexity = x.complexityGiven !== null ? x.complexityGiven : dv.length ? Math.round(mean(dv) * 10) / 10 : null;
      x.complexityLevel = levelFor(x.migrationComplexity, config.levels.complexity);
      x.riskLevel = levelFor(x.migrationRisk, config.levels.risk);
      x.readinessLevel = levelFor(x.cloudReadiness, config.levels.readiness);

      // quadrant
      const q = config.quadrants;
      const xv = x[q.xMetric === "migrationComplexity" ? "migrationComplexity" : q.xMetric];
      const yv = x[q.yMetric];
      if (xv !== null && xv !== undefined && yv !== null && yv !== undefined) {
        const hiVal = yv >= q.yThreshold;
        const hiCx = xv >= q.xThreshold;
        x.quadrant = arr(q.definitions).find((d) => (d.value === "high") === hiVal && (d.complexity === "high") === hiCx) || null;
      } else x.quadrant = null;
    });

    // dependency centrality fallback: share of portfolio downstream of this app
    const maxDown = Math.max(1, ...catalog.map((x) => x.allDownstream.size));
    // priority score
    const factors = arr(config.priorityScoring.factors);
    const posSum = sum(factors.filter((f) => f.weight > 0), (f) => f.weight);
    const negSum = sum(factors.filter((f) => f.weight < 0), (f) => f.weight);
    catalog.forEach((x) => {
      const derived = {
        dependencyCentrality: Math.round((x.allDownstream.size / maxDown) * 100),
        migrationEffort: x.effort !== null ? Math.min(100, Math.round((x.effort / Math.max(1, ...catalog.map((c) => c.effort || 0))) * 100)) : null,
        technicalComplexity: x.migrationComplexity !== null ? Math.round(((x.migrationComplexity - 1) / (scaleMax("migrationComplexity") - 1)) * 100) : null,
        riskReduction: null,
        regulatoryUrgency: null,
        businessCriticality: { high: 90, medium: 60, low: 25 }[String(x.criticality).toLowerCase()] ?? null,
      };
      let raw = 0;
      x.priorityBreakdown = factors.map((f) => {
        let v = num(x.priorityFactors[f.key]);
        let derivedFlag = false;
        if (v === null && derived[f.key] !== null && derived[f.key] !== undefined) {
          v = derived[f.key];
          derivedFlag = true;
        }
        v = v === null ? 0 : v;
        const c = f.weight * v;
        raw += c;
        return { key: f.key, label: f.label || f.key, weight: f.weight, value: v, contribution: c, derived: derivedFlag };
      });
      let score = raw;
      if (config.priorityScoring.normalize !== false) score = ((raw - negSum * 100) / ((posSum - negSum) * 100)) * 100;
      x.priorityScore = x.priorityGiven !== null ? x.priorityGiven : Math.round(score * 10) / 10;
    });
    const ranked = catalog.slice().sort((a, b) => b.priorityScore - a.priorityScore);
    ranked.forEach((x, i) => (x.priorityRank = i + 1));

    // ------------------------------------------------ 3. Migration Decisions
    catalog.forEach((x) => {
      x.wave = x.waveId ? waveById.get(x.waveId) : null;
      x.affinityGroup = x.affinityGroupId ? agById.get(x.affinityGroupId) || { id: x.affinityGroupId, name: x.affinityGroupId } : null;
      if (x.affinityGroupId && !agById.has(x.affinityGroupId)) {
        agById.set(x.affinityGroupId, x.affinityGroup);
        agDefs.push(x.affinityGroup);
      }
    });

    // ------------------------------------------------ 4. Roadmap & Waves
    waveDefs.sort((a, b) => a.order - b.order);
    waveDefs.forEach((w, i) => (w.index = i));
    catalog.forEach((x) => {
      if (x.startQ === null && x.wave) x.startQ = x.wave.startQ;
      if (x.endQ === null && x.wave) x.endQ = x.wave.endQ;
      if (x.endQ === null && x.startQ !== null && x.durationWeeks) x.endQ = x.startQ + Math.max(0, Math.ceil(x.durationWeeks / 13) - 1);
      if (x.startQ === null && x.endQ !== null) x.startQ = x.endQ;
    });
    const waves = waveDefs.map((w) => {
      const apps = catalog.filter((x) => x.waveId === w.id).sort((a, b) => b.priorityScore - a.priorityScore);
      const qs = apps.flatMap((x) => [x.startQ, x.endQ]).filter((v) => v !== null);
      const startQ = w.startQ ?? (qs.length ? Math.min(...qs) : null);
      const endQ = w.endQ ?? (qs.length ? Math.max(...qs) : null);
      return Object.assign(w, {
        apps,
        startQ,
        endQ,
        effort: sum(apps, (x) => x.effort),
        durationWeeks: Math.max(0, ...apps.map((x) => x.durationWeeks || 0)),
        avgPriority: mean(apps.map((x) => x.priorityScore)),
        avgRisk: mean(apps.map((x) => x.migrationRisk).filter((v) => v !== null)),
        migrationCost: sum(apps, (x) => x.migrationCost),
        strategies: countBy(apps, (x) => x.strategy),
      });
    });
    catalog.forEach((x) => (x.waveIndex = x.wave ? x.wave.index : 999));

    // cross-wave dependency issues: an app depends on a migrating app in a later wave
    const MOVING = (x) => !["Retain", "Retire", "Undecided"].includes(x.strategy);
    const crossWave = [];
    edges.forEach((e) => {
      if (!e.toApp) return;
      const a = appById.get(e.from);
      const b = appById.get(e.to);
      if (!a.wave || !b.wave || !MOVING(a)) return;
      if (b.wave.index > a.wave.index && MOVING(b)) crossWave.push({ edge: e, consumer: a, provider: b, kind: "provider-later" });
    });
    // affinity groups spanning waves
    const affinity = agDefs.map((g) => {
      const apps = catalog.filter((x) => x.affinityGroupId === g.id);
      const waveIds = uniq(apps.map((x) => x.waveId));
      const internal = edges.filter((e) => apps.some((x) => x.id === e.from) && apps.some((x) => x.id === e.to));
      return Object.assign(g, { apps, waveIds, internalEdges: internal, split: !!g.migrateTogether && waveIds.length > 1 });
    });

    // critical dependency chains along High-criticality app→app edges (provider → consumer order)
    const hi = edges.filter((e) => e.toApp && String(e.criticality).toLowerCase() === "high");
    const consumersOf = (id) => hi.filter((e) => e.to === id).map((e) => e.from);
    const hasProvider = (id) => hi.some((e) => e.from === id);
    const chains = [];
    const extend = (path) => {
      const last = path[path.length - 1];
      const next = consumersOf(last).filter((n) => !path.includes(n));
      if (!next.length) {
        if (path.length >= 3) chains.push(path.slice());
        return;
      }
      next.forEach((n) => extend(path.concat(n)));
    };
    uniq(hi.map((e) => e.to)).filter((id) => !hasProvider(id)).forEach((root) => extend([root]));
    chains.sort((a, b) => b.length - a.length || sum(b, (id) => appById.get(id).priorityScore) - sum(a, (id) => appById.get(id).priorityScore));

    // ------------------------------------------------ 5. Business Case
    const allQ = catalog.flatMap((x) => [x.startQ, x.endQ]).filter((v) => v !== null);
    const startYear = num(config.businessCase.startYear) || (allQ.length ? Math.floor(Math.min(...allQ) / 4) : new Date().getFullYear());
    const horizon = Math.max(1, num(config.businessCase.horizonYears, 5));
    const q0 = startYear * 4;
    const nQ = horizon * 4;
    const years = Array.from({ length: horizon }, (_, i) => startYear + i);

    const appEcon = catalog.map((x) => {
      const s = x.startQ ?? q0;
      const e = Math.max(s, x.endQ ?? s);
      const cutover = e + 1; // first quarter on target run cost
      const migQs = e - s + 1;
      const yearly = years.map((y) => ({ year: y, baseline: 0, run: 0, migration: 0, avoided: 0, statusQuo: 0, target: 0 }));
      for (let qi = 0; qi < nQ; qi++) {
        const q = q0 + qi;
        const Y = yearly[Math.floor(qi / 4)];
        const migrated = q >= cutover;
        Y.baseline += x.currentCost / 4;
        Y.run += (migrated ? x.targetCost : x.currentCost) / 4;
        Y.avoided += migrated ? x.avoidedCost / 4 : 0;
        if (q >= s && q <= e) Y.migration += x.migrationCost / migQs;
      }
      // migration quarters before the horizon are charged to year 1
      if (s < q0) yearly[0].migration += (x.migrationCost / migQs) * Math.min(migQs, q0 - s);
      yearly.forEach((Y) => {
        Y.savings = Y.baseline - Y.run;
        Y.net = Y.savings + Y.avoided - Y.migration;
      });
      const annualBenefit = x.currentCost - x.targetCost + x.avoidedCost;
      const totalNet = sum(yearly, (Y) => Y.net);
      return {
        app: x,
        cutoverQ: cutover,
        yearly,
        annualSavings: x.currentCost - x.targetCost,
        annualBenefit,
        horizonBenefit: sum(yearly, (Y) => Y.savings + Y.avoided),
        horizonNet: totalNet,
        roi: x.migrationCost > 0 ? totalNet / x.migrationCost : null,
        paybackYears: annualBenefit > 0 ? x.migrationCost / annualBenefit : null,
      };
    });
    appEcon.forEach((e) => (e.app.econ = e));

    const aggYears = years.map((y, i) => {
      const Y = { year: y, baseline: 0, run: 0, migration: 0, avoided: 0, savings: 0, net: 0 };
      appEcon.forEach((e) => ["baseline", "run", "migration", "avoided", "savings", "net"].forEach((k) => (Y[k] += e.yearly[i][k])));
      return Y;
    });
    let cum = 0;
    aggYears.forEach((Y) => {
      cum += Y.net;
      Y.cumulative = cum;
    });
    // payback (quarterly resolution)
    let payback = null;
    {
      let c = 0;
      let wasNeg = false;
      for (let qi = 0; qi < nQ; qi++) {
        const q = q0 + qi;
        let net = 0;
        appEcon.forEach((e) => {
          const x = e.app;
          const s = x.startQ ?? q0;
          const en = Math.max(s, x.endQ ?? s);
          const migrated = q >= e.cutoverQ;
          net += migrated ? (x.currentCost - x.targetCost + x.avoidedCost) / 4 : 0;
          if (q >= s && q <= en) net -= x.migrationCost / (en - s + 1);
          if (qi === 0 && s < q0) net -= (x.migrationCost / (en - s + 1)) * Math.min(en - s + 1, q0 - s);
        });
        const prev = c;
        c += net;
        if (c < 0) wasNeg = true;
        if (wasNeg && prev < 0 && c >= 0) {
          const frac = net > 0 ? -prev / net : 1;
          payback = { months: Math.round((qi + frac) * 3), quarter: q };
          break;
        }
      }
    }
    const totals = {
      currentAnnual: sum(catalog, (x) => x.currentCost),
      targetAnnual: sum(catalog, (x) => x.targetCost),
      migration: sum(catalog, (x) => x.migrationCost),
      avoidedAnnual: sum(catalog, (x) => x.avoidedCost),
    };
    totals.annualSavings = totals.currentAnnual - totals.targetAnnual;
    totals.annualBenefit = totals.annualSavings + totals.avoidedAnnual;
    totals.cumulativeNet = cum;
    totals.cumulativeGross = sum(aggYears, (Y) => Y.savings + Y.avoided);
    totals.tcoStatusQuo = sum(aggYears, (Y) => Y.baseline) + totals.avoidedAnnual * horizon;
    totals.tcoTarget = totals.tcoStatusQuo - sum(aggYears, (Y) => Y.savings + Y.avoided) + totals.migration;
    totals.roi = totals.migration > 0 ? (totals.cumulativeGross - totals.migration) / totals.migration : null;
    totals.payback = payback;

    const byWave = waves.map((w) => {
      const es = appEcon.filter((e) => e.app.waveId === w.id);
      return {
        wave: w,
        current: sum(es, (e) => e.app.currentCost),
        target: sum(es, (e) => e.app.targetCost),
        migration: sum(es, (e) => e.app.migrationCost),
        avoided: sum(es, (e) => e.app.avoidedCost),
        annualSavings: sum(es, (e) => e.annualSavings),
        horizonNet: sum(es, (e) => e.horizonNet),
      };
    });
    const businessCase = { startYear, horizon, years, yearly: aggYears, totals, byWave, apps: appEcon, notes: config.businessCase.notes || "" };

    // ------------------------------------------------ Landing zone
    const lzRaw = raw.landingZone || {};
    const lzDims = arr(lzRaw.dimensions).map((d) => (typeof d === "string" ? { id: d, name: d } : d));
    const lzAssess = arr(lzRaw.assessments).map((a) => {
      const app = appById.get(a.appId);
      if (!app) warnings.push(`Landing-zone assessment references unknown application "${a.appId}".`);
      Object.keys(a.dimensions || {}).forEach((k) => {
        if (!lzDims.find((d) => d.id === k)) lzDims.push({ id: k, name: k });
      });
      return { ...a, app };
    });
    catalog.forEach((x) => (x.landingZone = lzAssess.find((a) => a.appId === x.id) || null));
    const backlog = arr(lzRaw.backlog).map((b) => ({ ...b, apps: arr(b.appIds).map((id) => appById.get(id)).filter(Boolean) }));
    const landingZone = { dimensions: lzDims, assessments: lzAssess.filter((a) => a.app), backlog };

    // ------------------------------------------------ Risks
    const sevOrder = ["Critical", "High", "Medium", "Low"];
    const risks = arr(raw.risks).map((r, i) => {
      const apps = arr(r.appIds || r.applications).map((id) => appById.get(id)).filter(Boolean);
      const likelihood = num(r.likelihood);
      const impact = num(r.impact);
      return {
        ...r,
        id: r.id || `R-${i + 1}`,
        category: r.category || "Other",
        severity: r.severity || (likelihood && impact ? (likelihood * impact >= 16 ? "Critical" : likelihood * impact >= 10 ? "High" : likelihood * impact >= 5 ? "Medium" : "Low") : "Medium"),
        likelihood,
        impact,
        apps,
        domains: uniq(apps.map((a) => a.domain)),
        waveIds: uniq(apps.map((a) => a.waveId)),
      };
    });
    catalog.forEach((x) => (x.risks = risks.filter((r) => r.apps.includes(x))));

    // ------------------------------------------------ Portfolio aggregates
    const allServers = [];
    const seenHosts = new Set();
    catalog.forEach((x) =>
      x.servers.forEach((s) => {
        const key = s.hostname || `${x.id}-${allServers.length}`;
        if (seenHosts.has(key)) return;
        seenHosts.add(key);
        allServers.push({ ...s, appId: x.id });
      })
    );
    const techCounts = countBy(catalog, (x) => uniq(x.technologies.map((t) => t.name)));
    const serverLocations = countBy(allServers, (s) => s.location || "Unknown");
    const appLocations = countBy(catalog, (x) => x.hosting.location || x.hosting.site || "Unknown");
    const osCounts = countBy(allServers, (s) => s.os || "Unknown");

    const portfolio = {
      appCount: catalog.length,
      serverCount: allServers.length,
      servers: allServers,
      domains: uniq(catalog.map((x) => x.domain)),
      techCounts,
      osCounts,
      serverLocations,
      appLocations,
      locations: uniq([...serverLocations.keys(), ...appLocations.keys()]).filter((l) => l !== "Unknown"),
      datacenters: uniq(allServers.map((s) => s.datacenter).concat(catalog.map((x) => x.hosting.datacenter))),
      avgReadiness: mean(catalog.map((x) => x.cloudReadiness).filter((v) => v !== null)),
      avgBenefit: mean(catalog.map((x) => x.cloudBenefit).filter((v) => v !== null)),
      avgValue: mean(catalog.map((x) => x.businessValue).filter((v) => v !== null)),
      avgComplexity: mean(catalog.map((x) => x.migrationComplexity).filter((v) => v !== null)),
      avgRisk: mean(catalog.map((x) => x.migrationRisk).filter((v) => v !== null)),
      totalEffort: sum(catalog, (x) => x.effort),
      pilots: catalog.filter((x) => x.pilot),
      eolTech: uniq(catalog.flatMap((x) => x.technologies.filter((t) => /end of life|eol/i.test(t.lifecycle || "")).map((t) => `${t.name} ${t.version || ""}`.trim()))),
    };

    // auto-generated insights (computed from the data)
    const computedInsights = [];
    const sc = countBy(catalog, (x) => x.strategy);
    const topS = [...sc.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topS) computedInsights.push({ type: "computed", title: `${topS[0]} is the leading strategy`, text: `${topS[1]} of ${catalog.length} applications (${Math.round((topS[1] / catalog.length) * 100)}%) are recommended for ${topS[0]}.` });
    const moving = catalog.filter(MOVING);
    computedInsights.push({ type: "computed", title: `${moving.length} applications move to AWS`, text: `${catalog.length - moving.length} are retained or retired. Average cloud readiness is ${Math.round(portfolio.avgReadiness || 0)}/100.` });
    if (portfolio.avgValue !== null && portfolio.avgComplexity !== null)
      computedInsights.push({ type: "computed", title: "Value versus complexity", text: `Average business value ${portfolio.avgValue.toFixed(1)} vs. average migration complexity ${portfolio.avgComplexity.toFixed(1)} (1–5 scale).` });
    if (crossWave.length) computedInsights.push({ type: "computed", title: `${crossWave.length} cross-wave dependencies`, text: "Some applications depend on providers scheduled in a later wave; hybrid connectivity is required during the gap." });
    const split = affinity.filter((g) => g.split);
    if (split.length) computedInsights.push({ type: "computed", title: "Affinity groups split across waves", text: `${split.map((g) => g.name).join(", ")} should migrate together but span several waves.` });
    if (payback) computedInsights.push({ type: "computed", title: `Payback in ${payback.months} months`, text: `Cumulative net benefit over ${horizon} years is ${OT.fmt ? OT.fmt.money(cum) : Math.round(cum)}.` });

    return {
      raw,
      meta,
      config,
      warnings,
      strategies,
      driverDefs,
      priorityFactors: factors,
      catalog,
      appById,
      ranked,
      edges,
      externalNodes: [...extNodes.values()],
      infrastructure: infra,
      infraById,
      waves,
      waveById,
      affinity,
      crossWave,
      chains: chains.slice(0, 12),
      businessCase,
      landingZone,
      risks,
      severityOrder: sevOrder,
      portfolio,
      insights: arr(raw.insights),
      computedInsights,
      quarterLabel,
      isMoving: MOVING,
    };
  }

  OT.model = { build, parseQuarter, quarterLabel, levelFor, uniq, sum, mean, countBy, arr, get, num };
})();
