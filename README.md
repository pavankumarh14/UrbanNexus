# UrbanNexus — Multi-Agent Municipal Grievance Resolution Swarm

> Theme 05 — Agent Swarms

---

## Problem Statement

### The Complaint Backlog: Why Citizen Grievances Sit Unresolved While the Same Problem Is Reported a Hundred Times

**Problem Background**

Cities receive thousands of complaints daily — potholes, water leaks, broken lights, sanitation failures — across phone lines, web portals, and apps. Each complaint must be classified, routed to the right department, assessed, and resolved. Done manually, the process is slow: complaints queue for days, get mis-routed to the wrong crew, and the same underlying issue gets treated as dozens of unrelated tickets.

When a water main bursts on Pine Street, fifty residents file fifty individual complaints. Without intelligent clustering, that generates fifty work orders, fifty citizen responses, and five separate field crew dispatches to the same street — while the root cause goes unaddressed for hours.

**Why It Matters**

Responsive local government is the most visible form of public trust. Resolving a complaint in hours builds confidence; losing it in a backlog erodes it. The bottleneck is not intake — it is the parallel attention and pattern recognition required to classify complaints accurately, assess them with domain knowledge, detect when many reports share one root cause, and draft the right response. A swarm of specialist agents running concurrently inverts this: what takes a human clerk hours happens in seconds.

**Expected Impact**

- Clear complaint backlogs faster via **parallel, auto-routed processing** across all incoming reports
- **Collapse duplicates into single root-cause cases** — fix the burst pipe once, not fifty times
- Domain-aware routing and assessment reduces mis-routing and false closures
- Officers stay in control — the swarm **drafts**, humans **approve**

---

## What UrbanNexus Does

A complaint batch arrives (from citizens via any channel). An Orchestrator fans it out to four specialist agents running as a DAG: Intake classifies every complaint, Clustering scans the full complaint history for root-cause patterns simultaneously, Department applies domain knowledge to assess what response is needed, and Resolution drafts citizen responses and work orders. When clustering detects that multiple complaints share one root cause, it collapses them into a single escalated Case — one work order, one communication to all affected residents.

---

## What Is Built vs What Candidates Implement

### ✅ Built (infrastructure + Intake reference agent)

| Component | Details |
|-----------|---------|
| Orchestrator + DAG runner | 4-node pipeline, 3-phase fan-out |
| **Intake agent** | Batched LLM classification — type, severity, emergency flag |
| SQLite storage | WAL mode, 5 tables: complaints, cases, batches, dags, findings |
| Express REST API | All endpoints, envelope pattern |
| WebSocket server | Live events: `dag_update`, `finding`, `batch_complete` |
| React shell | App layout, tabs, ingest panel |
| **ComplaintIngest component** | 3-batch ingest panel with cluster scenario callout |
| **CaseList component** | Live sidebar — escalated cases + individual complaints |

### ⬜ Candidate tasks

| File | What to build | Dimension tested |
|------|--------------|-----------------|
| `backend/src/agents/department/index.js` | Domain-specialist LLM assessment (water/roads/lighting/sanitation SOPs) | AI Integration |
| `backend/src/agents/resolution/index.js` | Draft citizen responses + work orders (individual and escalated) | AI Integration |
| `backend/src/agents/clustering/index.js` | Root-cause clustering algorithm — ward + type + time proximity, no LLM | System Architecture |
| `frontend/src/components/PipelineView.jsx` | React Flow DAG — 4 nodes, live status, phase labels | System Arch viz + UX |
| `frontend/src/components/ClusterMap.jsx` | Two-column grouped layout — cases vs individual complaints | UX |
| `frontend/src/components/ResolutionPanel.jsx` | Officer console — review drafts, approve/reject | UX + Prototype Readiness |

Read the `// CANDIDATE TASK` block at the top of each stub before starting.

---

## ⚠️ Groq API Key Required

UrbanNexus has **no mock mode** — every agent makes real LLM calls.

1. Get your **free** key at [console.groq.com](https://console.groq.com) — takes 30 seconds
2. Copy `.env.example` to `.env` and paste your key
3. **Use your own key** — do not share keys across teams (rate limits are per-key)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env:  GROQ_API_KEY=gsk_...
```

---

## Prerequisites

- **Node.js 22** — use nvm
- A free Groq API key (see above)

```bash
nvm install 22 && nvm use 22
node --version   # v22.x.x
```

---

## Quick Start

### 1. Install

```bash
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure

```bash
cp backend/.env.example backend/.env
# Add your GROQ_API_KEY
```

### 3. Run — two terminals

**Terminal 1 — Backend:**
```bash
cd backend && npm run dev
# → 🏛 UrbanNexus backend → http://localhost:3001
# → Groq key → ✅ set
```

**Terminal 2 — Frontend:**
```bash
cd frontend && npm run dev
# → http://localhost:5173
```

### 4. Demo walkthrough

1. Open **http://localhost:5173**
2. Click **▶ Ingest Batch 1** — mixed individual complaints, no clusters
3. Watch the **🕸 Pipeline** tab — 4 nodes animate through the DAG
4. Click **▶ Ingest Batch 2** — 5 Ward 7 water complaints pointing to one burst main
5. After your Clustering agent runs: see complaints collapse into one escalated Case
6. Click the **🔗 Clusters** tab — before/after view of the clustering effect
7. Click the escalated case → **📋 Resolution** tab — review the drafted response

### 5. Reset

```bash
rm backend/data/urbannexus.db
# DB auto-recreates on next backend start
```

---

## API Reference

All responses: `{ success: boolean, data?: T, error?: string, timestamp: string }`

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Health check — shows Groq key status |
| `POST` | `/api/ingest` | Ingest custom complaints. Body: `{ complaints[] }` |
| `POST` | `/api/ingest/mock/:batch` | **Ingest mock batch** 1, 2, or 3 (202 — async) |
| `GET`  | `/api/complaints` | All open complaints |
| `GET`  | `/api/complaints/batch/:id` | Complaints for a batch |
| `GET`  | `/api/cases` | All cases (root-cause clusters) |
| `GET`  | `/api/cases/:id` | Single case |
| `GET`  | `/api/batches` | Batch history |
| `GET`  | `/api/dags/batch/:id` | DAG for a batch |
| `GET`  | `/api/dags/:id/findings` | All findings for a DAG |

---

## WebSocket Events

Connect to `ws://localhost:3001/ws`

| Type | Payload | When |
|------|---------|------|
| `connected` | `{ message }` | On connect |
| `dag_update` | DAG object | Every node status change |
| `finding` | Finding object | When any agent completes |
| `batch_complete` | `{ batch_id, dag, findings }` | Pipeline finished |

---

## Candidate Implementation Guide

### Before you start

1. **Read `docs/sample-output.txt` first** — shows exactly what each agent should produce, including the full clustering example (5 complaints → 1 case). Use it as your target output when implementing.
2. Run end-to-end: ingest Mock Batch 1, watch the pipeline, check SQLite
3. Read `backend/src/agents/intake/index.js` completely — the reference implementation
4. Inspect what lands in the DB:
```bash
sqlite3 backend/data/urbannexus.db "SELECT capability, verdict, confidence, summary FROM findings ORDER BY created_at DESC LIMIT 10"
```

### Department agent (`backend/src/agents/department/index.js`)

Receives `task.context.intakeFinding.details.classifications[]`. For each complaint, use the LLM to apply domain-specific knowledge: what crew is needed, what equipment, estimated hours, health/safety risk level. The domain knowledge to encode is documented in the `// CANDIDATE TASK` block. One batched LLM call is more efficient than N individual calls.

### Clustering agent (`backend/src/agents/clustering/index.js`)

**No LLM needed** — this is a deterministic algorithm. Call `getAllOpenComplaints()` from `../../db`, group by ward + type within a time window, create Case records for groups ≥ `CLUSTER_THRESHOLD`. The algorithm spec and DB functions are documented in the stub. Test by ingesting Batch 1 then Batch 2 — you should see one Case appear for Ward 7 water complaints.

### Resolution agent (`backend/src/agents/resolution/index.js`)

Receives all three prior findings as context. For clustered complaints (case_id set), draft one escalated work order and one bulk citizen communication referencing the Case number. For individual complaints, draft per-complaint responses. Call `updateCase()` and `updateComplaintStatus()` to persist the drafts. The output is what the officer sees in ResolutionPanel.

### PipelineView (`frontend/src/components/PipelineView.jsx`)

React Flow node/edge arrays. Fixed positions, colour by status, friendly labels. The `dag` prop updates on every `dag_update` WebSocket event — React Flow re-renders automatically. No manual D3 math.

### ClusterMap (`frontend/src/components/ClusterMap.jsx`)

Two-column plain React layout. Left: escalated cases (filter `complaints.case_id !== null`). Right: individual complaints (filter `complaints.case_id === null`). The moment Batch 2 runs and clustering fires, complaints move from right to left — make that transition visually obvious.

### ResolutionPanel (`frontend/src/components/ResolutionPanel.jsx`)

Officer console for the selected case. Editable textareas for citizen response and work order drafts. Approve/Reject buttons (UI-only). Show a stub warning when resolution agent is not yet implemented.
