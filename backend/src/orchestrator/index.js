'use strict';

const { v4: uuidv4 }        = require('uuid');
const { buildBatchDAG }     = require('./dag-builder');
const { DAGRunner }         = require('./dag-runner');
const { runIntake }         = require('../agents/intake');
const { runClustering }     = require('../agents/clustering');
const { runDepartment }     = require('../agents/department');
const { runResolution }     = require('../agents/resolution');
const {
  saveBatch, updateBatchStatus,
  saveComplaints, getComplaintsByBatch,
  saveDAG, getFindingsByDagId,
} = require('../db');
const { getMockComplaints } = require('../data/mock-complaints');

let broadcast = () => {};
function setBroadcast(fn) { broadcast = fn; }

/**
 * Ingest a batch of complaints and run the full 4-agent pipeline.
 *
 * Pipeline:
 *   Phase 1 — intake + clustering (parallel, no dependencies)
 *   Phase 2 — department (depends on intake)
 *   Phase 3 — resolution (depends on department + clustering)
 *
 * @param {object[]} complaints  Raw complaint objects (without id/batch_id)
 * @returns {Promise<{ batch, dag, findings }>}
 */
async function processBatch(complaints) {
  const now    = new Date().toISOString();
  const batchId = `batch-${uuidv4()}`;

  // ── Persist batch + complaints ────────────────────────────────────────────
  const batch = { id: batchId, status: 'processing', created_at: now };
  saveBatch(batch);

  const stamped = complaints.map(c => ({
    ...c,
    id:         `complaint-${uuidv4()}`,
    batch_id:   batchId,
    status:     'open',
    case_id:    null,
    created_at: now,
  }));
  saveComplaints(stamped);

  // ── Build DAG ─────────────────────────────────────────────────────────────
  const dag    = buildBatchDAG(batchId);
  const runner = new DAGRunner(dag);
  saveDAG(runner.getDAG());
  broadcast({ type: 'dag_update', data: runner.getDAG() });

  const taskBase = { dagId: dag.id, batchId, complaints: stamped, context: {} };

  // ── Phase 1: intake + clustering (concurrent) ────────────────────────────
  const phase1Nodes = runner.getReadyNodes();

  const [intakeFinding, clusteringFinding] = await Promise.all(
    phase1Nodes.map(async node => {
      runner.markNodeRunning(node.id);
      saveDAG(runner.getDAG());
      broadcast({ type: 'dag_update', data: runner.getDAG() });

      const runFn = node.id === 'intake' ? runIntake : runClustering;
      try {
        const finding = await runFn({ taskId: `task-${uuidv4()}`, nodeId: node.id, ...taskBase });
        runner.markNodeCompleted(node.id, finding);
        broadcast({ type: 'finding', data: finding });
        return finding;
      } catch (err) {
        console.error(`[orchestrator] ${node.id} failed:`, err.message);
        runner.markNodeFailed(node.id, err);
        return null;
      } finally {
        saveDAG(runner.getDAG());
        broadcast({ type: 'dag_update', data: runner.getDAG() });
      }
    })
  );

  // ── Phase 2: department ───────────────────────────────────────────────────
  const [deptNode] = runner.getReadyNodes();
  let departmentFinding = null;

  if (deptNode) {
    runner.markNodeRunning(deptNode.id);
    saveDAG(runner.getDAG());
    broadcast({ type: 'dag_update', data: runner.getDAG() });

    try {
      departmentFinding = await runDepartment({
        taskId: `task-${uuidv4()}`, nodeId: 'department',
        ...taskBase,
        context: { intakeFinding },
      });
      runner.markNodeCompleted(deptNode.id, departmentFinding);
      broadcast({ type: 'finding', data: departmentFinding });
    } catch (err) {
      console.error('[orchestrator] department failed:', err.message);
      runner.markNodeFailed(deptNode.id, err);
    } finally {
      saveDAG(runner.getDAG());
      broadcast({ type: 'dag_update', data: runner.getDAG() });
    }
  }

  // ── Phase 3: resolution ───────────────────────────────────────────────────
  const [resNode] = runner.getReadyNodes();
  let resolutionFinding = null;

  if (resNode) {
    runner.markNodeRunning(resNode.id);
    saveDAG(runner.getDAG());
    broadcast({ type: 'dag_update', data: runner.getDAG() });

    try {
      resolutionFinding = await runResolution({
        taskId: `task-${uuidv4()}`, nodeId: 'resolution',
        ...taskBase,
        context: { intakeFinding, clusteringFinding, departmentFinding },
      });
      runner.markNodeCompleted(resNode.id, resolutionFinding);
      broadcast({ type: 'finding', data: resolutionFinding });
    } catch (err) {
      console.error('[orchestrator] resolution failed:', err.message);
      runner.markNodeFailed(resNode.id, err);
    } finally {
      saveDAG(runner.getDAG());
      broadcast({ type: 'dag_update', data: runner.getDAG() });
    }
  }

  runner.getDAG().status = runner.isSuccess() ? 'completed' : 'failed';
  saveDAG(runner.getDAG());
  updateBatchStatus(batchId, runner.getDAG().status);
  broadcast({ type: 'dag_update', data: runner.getDAG() });

  const findings = getFindingsByDagId(dag.id);
  broadcast({ type: 'batch_complete', data: { batch_id: batchId, dag: runner.getDAG(), findings } });

  console.log(`[orchestrator] Batch ${batchId} complete — ${stamped.length} complaints processed`);
  return { batch, dag: runner.getDAG(), findings };
}

/**
 * Convenience: ingest one of the pre-built mock complaint batches (1–3).
 * Called by the /api/ingest/mock/:batch endpoint.
 */
async function ingestMockBatch(batchNumber) {
  const complaints = getMockComplaints(batchNumber);
  return processBatch(complaints);
}

module.exports = { processBatch, ingestMockBatch, setBroadcast };
