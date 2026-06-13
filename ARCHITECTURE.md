# CivicSwarm — Architecture Document

> Audience: 3+ year engineers onboarding to this codebase.

---

## 1. System Overview

```
Citizen complaints arrive (mock batches or custom POST)
                │
                ▼
      POST /api/ingest/mock/:batch
                │
                ▼
  ┌─────────────────────────────────────────────────────────┐
  │                     Orchestrator                        │
  │  1. Creates a Batch record + stamps complaint IDs       │
  │  2. Builds a 4-node resolution DAG                      │
  │  3. Fans out Phase 1 concurrently                       │
  │  4. Broadcasts live events via WebSocket                │
  └──────┬─────────────────────────┬────────────────────────┘
         │ Phase 1 — parallel      │
         ▼                         ▼
    [Intake]                  [Clustering]
    Classifies all            Scans ALL stored
    complaints in batch       complaints for
    (type, severity,          root-cause patterns
    emergency flag)           across ward + type
         │                         │
         └──────────┬──────────────┘
                    │ both complete
                    ▼
             [Department]          ← Phase 2  ⬜ CANDIDATE
             Domain-specialist
             assessment per
             complaint type
                    │
                    ▼
             [Resolution]          ← Phase 3  ⬜ CANDIDATE
             Drafts citizen
             responses +
             work orders
                    │
                    ▼
         React Officer Console
```

---

## 2. What Is Built vs What Candidates Complete

### Built

| Component | Status | Location |
|-----------|--------|----------|
| Orchestrator + DAG runner | ✅ | `backend/src/orchestrator/` |
| **Intake agent** | ✅ Reference | `backend/src/agents/intake/index.js` |
| SQLite storage layer | ✅ | `backend/src/db/index.js` |
| Express REST API + WebSocket | ✅ | `backend/src/server.js` |
| Mock complaint fixtures | ✅ | `backend/src/data/mock-complaints.js` |
| Groq LLM client (hard dep) | ✅ | `backend/src/shared/llm.js` |
| React app shell + CSS | ✅ | `frontend/src/App.jsx`, `App.css` |
| WebSocket hook | ✅ | `frontend/src/hooks/useWebSocket.js` |
| API service layer | ✅ | `frontend/src/services/api.js` |
| ComplaintIngest component | ✅ | `frontend/src/components/ComplaintIngest.jsx` |
| CaseList component | ✅ | `frontend/src/components/CaseList.jsx` |

### Candidates complete

| Component | Status | Location |
|-----------|--------|----------|
| Department agent | ⬜ Stub | `backend/src/agents/department/index.js` |
| Clustering agent | ⬜ Stub | `backend/src/agents/clustering/index.js` |
| Resolution agent | ⬜ Stub | `backend/src/agents/resolution/index.js` |
| PipelineView (React Flow) | ⬜ Stub | `frontend/src/components/PipelineView.jsx` |
| ClusterMap | ⬜ Stub | `frontend/src/components/ClusterMap.jsx` |
| ResolutionPanel | ⬜ Stub | `frontend/src/components/ResolutionPanel.jsx` |

---

## 3. Directory Layout

```
CivicSwarm/
├── backend/
│   ├── src/
│   │   ├── server.js                    ← Express + WebSocket entry point
│   │   ├── db/
│   │   │   └── index.js                 ← SQLite: schema + all read/write fns
│   │   ├── shared/
│   │   │   └── llm.js                   ← Groq client (hard dep, no mock)
│   │   ├── data/
│   │   │   └── mock-complaints.js       ← 3 batches: mixed → cluster → escalation
│   │   ├── orchestrator/
│   │   │   ├── index.js                 ← processBatch() — main pipeline entry
│   │   │   ├── dag-runner.js            ← State machine: pending→running→completed|failed
│   │   │   └── dag-builder.js           ← Builds a fresh 4-node DAG per batch
│   │   └── agents/
│   │       ├── intake/
│   │       │   └── index.js             ← ✅ REFERENCE — read this first
│   │       ├── department/
│   │       │   └── index.js             ← ⬜ CANDIDATE TASK
│   │       ├── clustering/
│   │       │   └── index.js             ← ⬜ CANDIDATE TASK
│   │       └── resolution/
│   │           └── index.js             ← ⬜ CANDIDATE TASK
│   ├── data/
│   │   └── civicswarm.db                ← SQLite (auto-created at first run)
│   ├── .env                             ← GROQ_API_KEY (gitignored, each team uses own key)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                      ← App shell — all state lives here
│   │   ├── App.css                      ← Dark civic-console theme
│   │   ├── hooks/
│   │   │   └── useWebSocket.js          ← Auto-reconnect WS hook
│   │   ├── services/
│   │   │   └── api.js                   ← REST client
│   │   └── components/
│   │       ├── ComplaintIngest.jsx      ← ✅ 3-batch ingest panel
│   │       ├── CaseList.jsx             ← ✅ Live sidebar (cases + complaints)
│   │       ├── PipelineView.jsx         ← ⬜ React Flow DAG
│   │       ├── ClusterMap.jsx           ← ⬜ Two-column grouped layout
│   │       └── ResolutionPanel.jsx      ← ⬜ Officer console
│   ├── vite.config.js
│   └── package.json
├── README.md
├── ARCHITECTURE.md
├── .nvmrc                               ← Node 22
└── .gitignore
```

---

## 4. Data Model (SQLite)

**Why SQLite:**
CivicSwarm is event-driven (not continuous like a scheduler), but the Clustering agent needs to query the full complaint history across all batches to find root-cause patterns. SQLite provides WAL-mode concurrent writes during the parallel Phase 1 (intake + clustering both write findings simultaneously) and a proper query layer for cross-batch lookups. JSON files cannot do either safely.

### Schema

```sql
-- One row per complaint batch ingestion.
batches (
  id         TEXT PK,
  status     TEXT,   -- processing | completed | failed
  created_at TEXT
)

-- One row per citizen complaint.
-- case_id is NULL for individual complaints; set by the Clustering agent
-- when it collapses related complaints into a root-cause Case.
complaints (
  id          TEXT PK,
  batch_id    TEXT FK → batches,
  ward        TEXT,
  type        TEXT,   -- pothole | water_leak | street_lighting | sanitation | flooding | other
  severity    TEXT,   -- low | medium | high | critical
  description TEXT,
  location    TEXT,
  status      TEXT,   -- open | in_progress | resolved | escalated
  case_id     TEXT,   -- NULL until clustering assigns it
  created_at  TEXT
)

-- One row per root-cause cluster detected by the Clustering agent.
-- complaint_count tracks how many complaints have been linked to this case.
-- resolution_draft and work_order are populated by the Resolution agent.
cases (
  id               TEXT PK,
  batch_id         TEXT FK → batches,
  ward             TEXT,
  type             TEXT,
  complaint_count  INTEGER,
  root_cause       TEXT,
  status           TEXT,   -- open | escalated | resolved
  resolution_draft TEXT,
  work_order       TEXT,
  created_at       TEXT,
  updated_at       TEXT
)

-- One DAG per batch — 4 nodes serialised as JSON.
dags (
  id         TEXT PK,
  batch_id   TEXT FK → batches,
  nodes      TEXT,   -- JSON DAGNode[]
  status     TEXT,   -- running | completed | failed
  created_at TEXT,
  updated_at TEXT
)

-- One finding per agent per batch.
findings (
  id         TEXT PK,
  dag_id     TEXT FK → dags,
  batch_id   TEXT,
  node_id    TEXT,
  capability TEXT,   -- intake | clustering | department | resolution
  summary    TEXT,
  details    TEXT,   -- JSON: agent-specific payload
  confidence REAL,
  verdict    TEXT,   -- significant | minor | noise | neutral
  provenance TEXT,   -- JSON: { agentId, model, durationMs }
  created_at TEXT
)
```

---

## 5. DAG Structure Per Batch

```
Nodes:
  intake      phase=1  deps=[]               — classifies complaints (LLM)
  clustering  phase=1  deps=[]               — finds root-cause clusters (algorithm)
  department  phase=2  deps=[intake]         — domain assessment (LLM)
  resolution  phase=3  deps=[department,     — drafts responses + work orders (LLM)
                             clustering]

Node lifecycle: pending → running → completed | failed
```

**Why intake and clustering run in parallel (Phase 1):**

Clustering queries the full complaint history from SQLite — it does not need the intake classification to start. Running them in parallel (via `Promise.all`) cuts total pipeline time nearly in half for large batches. The Resolution agent (Phase 3) depends on both because it needs the department assessment (what crew/equipment) AND the cluster information (is this an individual or escalated case?) to draft the right response.

**Phase execution in `orchestrator/index.js`:**
1. `runner.getReadyNodes()` → `[intake, clustering]` → `Promise.all([runIntake, runClustering])`
2. `runner.getReadyNodes()` → `[department]` → `await runDepartment()`
3. `runner.getReadyNodes()` → `[resolution]` → `await runResolution()`
4. Broadcast `batch_complete` with all findings

---

## 6. Agent Contracts

Every agent receives a **TaskPayload** and must return a **Finding**, persisted via `saveFinding()`.

### TaskPayload
```javascript
{
  taskId:     string,
  dagId:      string,
  batchId:    string,
  nodeId:     'intake' | 'clustering' | 'department' | 'resolution',
  complaints: Complaint[],   // current batch
  context: {
    intakeFinding:     Finding | null,   // for department
    clusteringFinding: Finding | null,   // for resolution
    departmentFinding: Finding | null,   // for resolution
  }
}
```

### Finding (shared shape)
```javascript
{
  id:         'finding-<uuid>',
  dag_id:     string,
  batch_id:   string,
  node_id:    string,
  capability: string,
  summary:    string,        // one sentence
  details:    object,        // agent-specific — see each stub's contract
  confidence: number,        // 0.0–1.0
  verdict:    'significant' | 'minor' | 'noise' | 'neutral',
  provenance: { agentId, model, durationMs },
  created_at: string,
}
```

**Rule: every agent calls `saveFinding(finding)` before returning.**

---

## 7. Intake Agent Deep-Dive (Reference Implementation)

Read `agents/intake/index.js` before implementing any candidate agent.

**Key patterns:**

1. **Batched LLM call** — sends all complaints in one prompt, not N individual calls. One round-trip, lower latency, lower rate-limit pressure.

2. **Graceful fallback in try/catch** — if LLM returns unparseable JSON, falls back to the original `type`/`severity` from the fixture. Pipeline never halts on a parse error.

3. **Saves back to SQLite** — updates each complaint record with the LLM-refined classification before returning the finding.

4. **Returns before the caller saves** — the agent owns `saveFinding()`. The orchestrator does not persist findings.

---

## 8. Clustering Agent — Why No LLM

The clustering agent is the algorithmic heart of CivicSwarm and it deliberately uses no LLM. This tests the **System Architecture** dimension, not AI Integration.

The algorithm must be deterministic: same input → same output every time. LLM calls are non-deterministic and slow. A spatial + temporal grouping algorithm is the right tool:

```
group by (ward + normalised_type) within TIME_WINDOW_HOURS
if group.count >= CLUSTER_THRESHOLD:
  create Case
  assign all complaints in group to Case
```

Related type pairs (treat as same for clustering):
- `water_leak` ↔ `flooding` — both signal a water infrastructure failure
- `pothole` ↔ `flooding` — road collapse caused by water ingress

`provenance.model` should be `'algorithm'` — not a model name. This makes it clear in the DB that no LLM was used and the output is fully reproducible.

---

## 9. LLM Client — Hard Dependency

`backend/src/shared/llm.js` has **no mock fallback**. If `GROQ_API_KEY` is not set, every LLM call throws with a clear error pointing to `https://console.groq.com`.

**Why no mock:**
AI integration is a scored dimension. Candidates must demonstrate real LLM calls with well-designed prompts — not stub responses. Each team uses their own key (free tier, 30-second signup) to avoid shared rate-limit collisions during the hackathon demo.

**Retry logic is kept** — 3 retries with 2s/4s/6s backoff on HTTP 429 (rate limit). This is operational resilience, not a fallback.

---

## 10. Frontend Architecture

### Component Tree
```
App.jsx                        (all state lives here)
├── Header                     (status dot, complaint + case counts)
├── Sidebar
│   ├── ComplaintIngest.jsx    ✅ — 3-batch ingest panel
│   └── CaseList.jsx           ✅ — escalated cases + individual complaints
└── Main Panel (tabbed)
    ├── PipelineView.jsx        ⬜ — React Flow 4-node DAG
    ├── ClusterMap.jsx          ⬜ — two-column grouped layout
    └── ResolutionPanel.jsx     ⬜ — officer console
```

### State (App.jsx)

| State | Updated by |
|-------|-----------|
| `cases[]` | REST on mount + WS `batch_complete` |
| `complaints[]` | REST on mount + WS `batch_complete` |
| `activeCase` | CaseList click |
| `activeDAG` | WS `dag_update` |
| `eventCount` | Every WS message |

### React Flow (PipelineView)
React Flow v11 (`reactflow` package). CSS imported once in `main.jsx`. Candidates declare `nodes[]` and `edges[]` arrays — React Flow handles all rendering, zoom, and pan. No SVG math required. Node positions are fixed (not force-directed) to keep the phase structure readable.

---

## 11. Mock Complaint Scenario

Three batches that tell a progressive story, designed so Batch 2 triggers clustering:

| Batch | Contents | Expected clustering outcome |
|-------|----------|----------------------------|
| 1 | 6 mixed complaints across 4 wards | No clusters — all individual |
| 2 | 5 Ward 7 water/flooding + 3 others | **1 cluster** — Ward 7 water main, 5 complaints → 1 Case |
| 3 | 2 more Ward 7 water (escalation) + 4 others | Cluster grows to 7 complaints, status escalates to critical |

After Batch 2, the ClusterMap should show 5 complaints collapsing from the right column (individual) into one escalated case on the left. This is the demo money-shot — make it visually clear.

---

## 12. Key Design Decisions

| Decision | Reason |
|----------|--------|
| Hard Groq dependency (no mock) | AI Integration is a scored dimension — real prompts, real responses required |
| Each team uses their own key | Groq free tier is per-key; shared keys cause rate-limit collisions during simultaneous demos |
| SQLite over JSON files | Clustering agent needs cross-batch queries; WAL mode handles parallel Phase 1 writes |
| Clustering is algorithmic (no LLM) | Tests System Architecture dimension; deterministic algorithm is correct tool for spatial grouping |
| Intake uses one batched LLM call | One round-trip for N complaints — lower latency, lower rate-limit pressure than N individual calls |
| React Flow over D3 | Candidates declare node/edge arrays — no SVG math. 3× faster to implement for a hackathon |
| Event-driven (no scheduler) | Complaints are discrete batches, not time-series — a cron scheduler would be wrong model |
| `node --watch` (no nodemon) | Node 22 ships this natively — zero extra dependency |
