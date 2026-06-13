'use strict';

const { v4: uuidv4 } = require('uuid');

// ─────────────────────────────────────────────────────────────────────────────
// DAG shape for one UrbanNexus complaint batch:
//
//  Phase 1 — parallel (no dependencies):
//    intake      — classifies all complaints in the batch
//    clustering  — scans ALL stored complaints for root-cause patterns
//
//  Phase 2 — depends on intake:
//    department  — domain-specialist assessment (water/roads/sanitation/lighting)
//
//  Phase 3 — depends on department AND clustering:
//    resolution  — drafts citizen responses + work orders
//
// Why clustering runs in Phase 1 (parallel to intake):
//   Clustering looks at the entire complaint history in SQLite — not just this
//   batch. It doesn't need the intake classification to start. Running it in
//   parallel with intake minimises total pipeline time.
// ─────────────────────────────────────────────────────────────────────────────

function buildBatchDAG(batch_id) {
  const now = new Date().toISOString();

  const nodes = [
    {
      id: 'intake',     capability: 'intake',     phase: 1,
      status: 'pending', dependencies: [],
      started_at: null, completed_at: null, failed_at: null, finding_id: null, confidence: null, error: null,
    },
    {
      id: 'clustering', capability: 'clustering', phase: 1,
      status: 'pending', dependencies: [],
      started_at: null, completed_at: null, failed_at: null, finding_id: null, confidence: null, error: null,
    },
    {
      id: 'department', capability: 'department', phase: 2,
      status: 'pending', dependencies: ['intake'],
      started_at: null, completed_at: null, failed_at: null, finding_id: null, confidence: null, error: null,
    },
    {
      id: 'resolution', capability: 'resolution', phase: 3,
      status: 'pending', dependencies: ['department', 'clustering'],
      started_at: null, completed_at: null, failed_at: null, finding_id: null, confidence: null, error: null,
    },
  ];

  return {
    id:         `dag-${uuidv4()}`,
    batch_id,
    nodes,
    status:     'running',
    created_at: now,
    updated_at: now,
  };
}

module.exports = { buildBatchDAG };
