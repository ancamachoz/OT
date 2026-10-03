# Cloud Migration Readiness Assessment — Executive Portal

An interactive web application for the results of an OT Cloud Migration Readiness
Assessment. Executives get the portfolio picture at a glance; architects can drill
down to the full assessment of every application.

**Everything on screen comes from one file: `data/assessment.json`.** No portfolio
data is hard-coded. Replace that file and all KPIs, charts, tables, filters,
waves, the business case and the application pages update automatically.

```
JSON → Application Catalog → Assessment Analysis → Migration Decisions → Roadmap & Waves → Business Case
```

## Run it

The app is static HTML/CSS/JS with no build step and no dependencies.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Any static host works (GitHub Pages, S3 + CloudFront, IIS, nginx).

Other ways to load data:

| How | Use |
|---|---|
| `?data=path/or/url.json` | Load a different JSON file, e.g. `index.html?data=data/assessment-v2.json` |
| **Load JSON** button | Pick a local file; the portal re-renders in place |
| Drag & drop | Drop a JSON file anywhere on the page |

When `index.html` is opened straight from disk (`file://`), browsers block the
automatic load. The portal then shows a file picker / drop zone instead.

## Navigation

| Page | What it shows |
|---|---|
| **Overview** | KPIs, 7R mix, domains, criticality, complexity × risk heatmap, readiness vs. benefit, servers / technologies / locations, wave summary, insights. Clicking a chart drills into the filtered application list. |
| **Applications** | Searchable, filterable, sortable catalog (domain, criticality, 7R, wave, decision, quadrant, complexity, risk, readiness, location, pilot) with CSV export. Click a row for the application detail. |
| **Application detail** | Description, architecture, technologies, servers, integrations (upstream / downstream / infrastructure), SLA / RTO / RPO, NERC CIP, complexity drivers, scores, 7R + rationale, target architecture, prerequisites, plan, economics, risks, landing-zone readiness. |
| **Prioritization** | Business value vs. migration complexity matrix with quadrants. Click a dot to open the application. Includes the weighted priority-score model and ranking. |
| **Dependencies** | Interactive dependency map. Click a node to trace its upstream and downstream chains. Also shows critical dependency chains, affinity groups (warns when a "migrate together" group is split across waves), centrality and cross-wave conflicts. |
| **Migration Waves** | Wave cards, quarterly roadmap (Gantt), 7R mix per wave, objectives, and per-wave detail with dependencies, prerequisites and target quarter. |
| **Business Case** | Current cost, migration cost, target run cost, avoided cost, savings, cumulative savings, TCO, ROI, payback; costs and benefits by year and by wave; drill-down to application economics. |
| **Landing Zone** | Pilot × dimension readiness matrix (Ready / Gap / Blocker), gaps, and a filterable remediation backlog. |
| **Risks** | Likelihood × impact heatmap, risks by category, exposed applications, and the risk register. Filter by application, domain, wave, severity, category or status. |

Filtered views are reflected in the URL, so you can share the link to any view.
Light and dark themes are both supported.

## Data file structure

Only `applications` is required. Every other section is optional, and missing
values show as "—". The app lists the problems it found while reading the file
under **Data notes** on the Overview.

```jsonc
{
  "meta": { "title": "...", "client": "...", "programme": "...", "preparedBy": "...",
            "assessmentDate": "2026-12-15", "dataVersion": "1.0", "status": "...", "currency": "USD" },

  "config": {
    "strategies": [{ "id": "Rehost", "label": "Rehost", "description": "..." }, ...],   // order = colour order
    "priorityScoring": { "normalize": true,
      "factors": [{ "key": "businessCriticality", "label": "...", "weight": 0.30 }, ...] },  // negative weight = inverse factor
    "complexityDrivers": [{ "key": "realTimeLatency", "label": "...", "description": "..." }, ...],
    "scales":  { "businessValue": { "min": 1, "max": 5 }, ... },
    "levels":  { "complexity": [{ "label": "Low", "max": 2.5 }, ...], "risk": [...], "readiness": [...] },
    "quadrants": { "xMetric": "migrationComplexity", "yMetric": "businessValue", "xThreshold": 3, "yThreshold": 3,
                   "definitions": [{ "id": "quick-wins", "name": "Migrate / Quick Wins", "value": "high", "complexity": "low" }, ...] },
    "businessCase": { "startYear": 2027, "horizonYears": 5, "notes": "..." }
  },

  "waves": [{ "id": "W1", "name": "Wave 1 – Quick Wins", "shortName": "...", "theme": "...",
              "startQuarter": "2027-Q1", "endQuarter": "2027-Q3", "status": "Proceed",
              "objectives": ["..."], "exitCriteria": "..." }],

  "affinityGroups": [{ "id": "AG-DATA", "name": "...", "description": "...", "migrateTogether": true, "rationale": "..." }],

  "sharedInfrastructure": [{ "id": "INF-ESB", "name": "MuleSoft ESB", "type": "Integration", "description": "..." }],

  "applications": [{
    "id": "OT-003", "name": "...", "shortName": "...", "description": "...",
    "domain": "...", "businessFunction": "...", "appType": "...", "tier": "Tier 1",
    "businessOwner": "...", "technicalOwner": "...", "criticality": "High",
    "users": { "max": 900, "typical": 380 },
    "architecture": { "pattern": "...", "current": "..." },
    "technologies": [{ "name": "...", "category": "...", "version": "...", "lifecycle": "Supported | Extended | End of Life" }],
    "hosting": { "model": "...", "platform": "...", "location": "...", "datacenter": "...", "environments": ["Production"] },
    "servers": [{ "hostname": "...", "role": "...", "os": "...", "platform": "...", "environment": "...",
                  "location": "...", "datacenter": "...", "vcpu": 8, "ramGB": 32, "storageGB": 500, "cpuUtilPct": 22 }],
    "dependencies": [{ "target": "OT-017 | external system name", "type": "...", "protocol": "...",
                       "criticality": "High | Medium | Low", "description": "..." }],   // this app depends on target
    "infrastructureDependencies": ["INF-ESB"],
    "sla": { "availability": "99.9%", "rto": "4 h", "rpo": "15 min", "supportWindow": "24x7" },
    "regulatory": { "nercCip": "...", "frameworks": ["..."], "dataResidency": "...", "notes": "..." },
    "assessment": { "businessValue": 4.4, "cloudBenefit": 4.5, "cloudReadiness": 66, "migrationRisk": 58,
                    "effortPersonWeeks": 30, "complexityDrivers": { "realTimeLatency": 2, ... },   // 1-5
                    "complexityNotes": ["..."] },        // optional "migrationComplexity" overrides the driver average
    "priorityFactors": { "businessCriticality": 85, ... },    // 0-100; optional "priorityScore" overrides the model
    "decision": { "strategy": "Replatform", "status": "Proceed", "rationale": "...", "targetArchitecture": "...",
                  "targetServices": ["..."], "prerequisites": ["..."] },
    "plan": { "wave": "W2", "startQuarter": "2027-Q3", "endQuarter": "2027-Q4", "durationWeeks": 24, "pilot": true },
    "financials": { "currentAnnualRunCost": 410000, "targetAnnualRunCost": 255000,
                    "migrationCost": 520000, "annualAvoidedCost": 95000 },
    "affinityGroup": "AG-DATA"
  }],

  "landingZone": {
    "dimensions": [{ "id": "network", "name": "Network & Connectivity", "description": "...", "controls": ["..."] }],
    "assessments": [{ "appId": "OT-003", "dimensions": { "network": { "status": "Ready | Gap | Blocker", "findings": "..." } } }],
    "backlog": [{ "id": "LZ-01", "title": "...", "dimension": "network", "severity": "Blocker", "priority": "P1",
                  "owner": "...", "effortWeeks": 10, "targetDate": "2027-03-31", "status": "Open", "appIds": ["OT-003"] }]
  },

  "risks": [{ "id": "R-01", "title": "...", "category": "Technical", "severity": "Critical",
              "likelihood": 4, "impact": 5, "appIds": ["OT-001"], "mitigation": "...", "owner": "...", "status": "Open" }],

  "insights": [{ "type": "finding | risk | recommendation | conclusion", "title": "...", "text": "..." }]
}
```

### What is computed (not stored)

- **Migration complexity**: mean of the complexity drivers, unless `assessment.migrationComplexity` is given. Levels and quadrants come from `config`.
- **Priority score**: Σ weight × factor, normalised to 0–100. Missing factors are derived: dependency centrality from the dependency graph, effort from person-weeks, technical complexity from the complexity score, and business criticality from the rating.
- **Dependencies**: downstream links are the reverse of each app's `dependencies`. The app also computes transitive chains, critical chains along high-criticality links, cross-wave conflicts, and affinity groups that are split across waves.
- **Business case**: quarterly model over `horizonYears`. Run cost switches from current to target the quarter after `plan.endQuarter`. Avoided cost starts in that same quarter. Migration cost is spread over the migration quarters. ROI, TCO, cumulative savings and payback are all derived from these figures.
- **Portfolio KPIs**: server, location and technology counts come from the application records.

## Sample data

`data/assessment.json` holds **illustrative** sample data. It is modelled on the
proposal's example portfolio (20 OT applications, waves W0–W3, the weighted scoring
model). `tools/generate_sample_data.py` regenerates it. The portal itself does not
use that script.

## Project layout

```
index.html                  entry point
data/assessment.json        the only data source
assets/css/app.css          design tokens (light/dark) and layout
assets/js/model.js          JSON → catalog → analysis → decisions → roadmap → business case
assets/js/ui.js             DOM helpers, formatting, colours, tooltip, table, filters
assets/js/charts.js         donut, bars, columns, scatter, heatmap, gauge (SVG/HTML, no libraries)
assets/js/views/*.js        one file per page
assets/js/app.js            loader, router, header/navigation
tools/generate_sample_data.py
```
