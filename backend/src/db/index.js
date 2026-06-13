'use strict';

const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = path.join(__dirname, '../../data/urbannexus.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');  // concurrent reads during parallel agent writes
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS complaints (
      id          TEXT PRIMARY KEY,
      batch_id    TEXT NOT NULL,
      ward        TEXT NOT NULL,
      type        TEXT NOT NULL,      -- pothole | water_leak | street_lighting | sanitation | flooding | other
      severity    TEXT NOT NULL,      -- low | medium | high | critical
      description TEXT NOT NULL,
      location    TEXT NOT NULL,
      status      TEXT DEFAULT 'open', -- open | in_progress | resolved | escalated
      case_id     TEXT,               -- set when clustering assigns to a root-cause case
      created_at  TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS batches (
      id          TEXT PRIMARY KEY,
      status      TEXT DEFAULT 'processing',  -- processing | completed | failed
      created_at  TEXT NOT NULL
    );

    -- A case is one or more complaints sharing a root cause.
    -- Created by the Clustering agent when count >= threshold.
    CREATE TABLE IF NOT EXISTS cases (
      id               TEXT PRIMARY KEY,
      batch_id         TEXT NOT NULL,
      ward             TEXT NOT NULL,
      type             TEXT NOT NULL,
      complaint_count  INTEGER DEFAULT 0,
      root_cause       TEXT,           -- LLM-determined root cause description
      status           TEXT DEFAULT 'open',  -- open | escalated | resolved
      resolution_draft TEXT,           -- from Resolution agent
      work_order       TEXT,           -- from Resolution agent
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    -- One DAG per batch — 4 nodes across 3 phases.
    CREATE TABLE IF NOT EXISTS dags (
      id          TEXT PRIMARY KEY,
      batch_id    TEXT NOT NULL,
      nodes       TEXT NOT NULL,   -- JSON DAGNode[]
      status      TEXT DEFAULT 'running',  -- running | completed | failed
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    -- One finding per agent per batch.
    CREATE TABLE IF NOT EXISTS findings (
      id          TEXT PRIMARY KEY,
      dag_id      TEXT NOT NULL,
      batch_id    TEXT NOT NULL,
      node_id     TEXT NOT NULL,
      capability  TEXT NOT NULL,   -- intake | clustering | department | resolution
      summary     TEXT NOT NULL,
      details     TEXT NOT NULL,   -- JSON
      confidence  REAL DEFAULT 0,
      verdict     TEXT DEFAULT 'neutral',
      provenance  TEXT NOT NULL,   -- JSON { agentId, model, durationMs }
      created_at  TEXT NOT NULL,
      FOREIGN KEY (dag_id) REFERENCES dags(id)
    );
  `);
}

// ── Batches ───────────────────────────────────────────────────────────────────

function saveBatch(batch) {
  getDb().prepare(
    'INSERT OR REPLACE INTO batches (id, status, created_at) VALUES (?, ?, ?)'
  ).run(batch.id, batch.status, batch.created_at);
}

function updateBatchStatus(id, status) {
  getDb().prepare('UPDATE batches SET status = ? WHERE id = ?').run(status, id);
}

function getBatches(limit = 20) {
  return getDb().prepare('SELECT * FROM batches ORDER BY created_at DESC LIMIT ?').all(limit);
}

// ── Complaints ────────────────────────────────────────────────────────────────

function saveComplaint(c) {
  getDb().prepare(`
    INSERT OR REPLACE INTO complaints (id, batch_id, ward, type, severity, description, location, status, case_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(c.id, c.batch_id, c.ward, c.type, c.severity, c.description, c.location, c.status ?? 'open', c.case_id ?? null, c.created_at);
}

function saveComplaints(complaints) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO complaints (id, batch_id, ward, type, severity, description, location, status, case_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insert = getDb().transaction(cs => {
    for (const c of cs) stmt.run(c.id, c.batch_id, c.ward, c.type, c.severity, c.description, c.location, c.status ?? 'open', c.case_id ?? null, c.created_at);
  });
  insert(complaints);
}

function assignComplaintToCase(complaintId, caseId) {
  getDb().prepare('UPDATE complaints SET case_id = ?, status = ? WHERE id = ?').run(caseId, 'escalated', complaintId);
}

function updateComplaintStatus(id, status) {
  getDb().prepare('UPDATE complaints SET status = ? WHERE id = ?').run(status, id);
}

function getComplaintsByBatch(batch_id) {
  return getDb().prepare('SELECT * FROM complaints WHERE batch_id = ?').all(batch_id);
}

// Returns all open complaints across all batches — used by the Clustering agent
// to find root-cause patterns that span multiple batches.
function getAllOpenComplaints() {
  return getDb().prepare("SELECT * FROM complaints WHERE status IN ('open', 'in_progress', 'escalated') ORDER BY created_at ASC").all();
}

function getComplaintById(id) {
  return getDb().prepare('SELECT * FROM complaints WHERE id = ?').get(id);
}

// ── Cases ─────────────────────────────────────────────────────────────────────

function saveCase(c) {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT OR REPLACE INTO cases
      (id, batch_id, ward, type, complaint_count, root_cause, status, resolution_draft, work_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(c.id, c.batch_id, c.ward, c.type, c.complaint_count ?? 0, c.root_cause ?? null,
         c.status ?? 'open', c.resolution_draft ?? null, c.work_order ?? null,
         c.created_at ?? now, now);
}

function updateCase(id, fields) {
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  getDb().prepare(`UPDATE cases SET ${sets}, updated_at = ? WHERE id = ?`)
    .run(...Object.values(fields), new Date().toISOString(), id);
}

function getCases(limit = 50) {
  return getDb().prepare('SELECT * FROM cases ORDER BY created_at DESC LIMIT ?').all(limit);
}

function getCaseById(id) {
  return getDb().prepare('SELECT * FROM cases WHERE id = ?').get(id);
}

// ── DAGs ──────────────────────────────────────────────────────────────────────

function saveDAG(dag) {
  getDb().prepare(`
    INSERT OR REPLACE INTO dags (id, batch_id, nodes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(dag.id, dag.batch_id, JSON.stringify(dag.nodes), dag.status, dag.created_at ?? new Date().toISOString(), new Date().toISOString());
}

function getDAGByBatchId(batch_id) {
  const row = getDb().prepare('SELECT * FROM dags WHERE batch_id = ? ORDER BY created_at DESC LIMIT 1').get(batch_id);
  return row ? { ...row, nodes: JSON.parse(row.nodes) } : null;
}

function getDAGById(id) {
  const row = getDb().prepare('SELECT * FROM dags WHERE id = ?').get(id);
  return row ? { ...row, nodes: JSON.parse(row.nodes) } : null;
}

// ── Findings ─────────────────────────────────────────────────────────────────

function saveFinding(f) {
  getDb().prepare(`
    INSERT OR REPLACE INTO findings
      (id, dag_id, batch_id, node_id, capability, summary, details, confidence, verdict, provenance, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(f.id, f.dag_id, f.batch_id, f.node_id, f.capability, f.summary,
         JSON.stringify(f.details), f.confidence, f.verdict,
         JSON.stringify(f.provenance), f.created_at ?? new Date().toISOString());
}

function getFindingsByDagId(dag_id) {
  return getDb().prepare('SELECT * FROM findings WHERE dag_id = ? ORDER BY created_at ASC').all(dag_id)
    .map(r => ({ ...r, details: JSON.parse(r.details), provenance: JSON.parse(r.provenance) }));
}

module.exports = {
  getDb,
  saveBatch, updateBatchStatus, getBatches,
  saveComplaint, saveComplaints, assignComplaintToCase, updateComplaintStatus,
  getComplaintsByBatch, getAllOpenComplaints, getComplaintById,
  saveCase, updateCase, getCases, getCaseById,
  saveDAG, getDAGByBatchId, getDAGById,
  saveFinding, getFindingsByDagId,
};
