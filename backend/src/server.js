'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 }      = require('uuid');

const {
  getDb, getBatches,
  getComplaintsByBatch, getAllOpenComplaints,
  getCases, getCaseById,
  getDAGByBatchId, getDAGById, getFindingsByDagId,
} = require('./db');
const { processBatch, ingestMockBatch, setBroadcast } = require('./orchestrator');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

const PORT            = process.env.PORT ?? 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

// ── WebSocket ─────────────────────────────────────────────────────────────────

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'connected', data: { message: 'UrbanNexus live feed connected' } }));
  ws.on('error', () => {});
});

function broadcast(event) {
  const msg = JSON.stringify(event);
  wss.clients.forEach(ws => {
    if (ws.readyState !== ws.OPEN) return;
    try { ws.send(msg); } catch { /* client disconnected mid-send */ }
  });
}

setBroadcast(broadcast);

// ── Helpers ───────────────────────────────────────────────────────────────────

const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  data, timestamp: new Date().toISOString() });
const err = (res, msg, status = 500) => res.status(status).json({ success: false, error: msg, timestamp: new Date().toISOString() });

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => ok(res, { status: 'ok', db: !!getDb(), groq: !!process.env.GROQ_API_KEY }));

// Ingest a custom array of complaints
app.post('/api/ingest', async (req, res) => {
  const { complaints } = req.body;
  if (!Array.isArray(complaints) || complaints.length === 0)
    return err(res, 'complaints must be a non-empty array', 400);

  res.status(202).json({ success: true, data: { message: 'Batch processing started' }, timestamp: new Date().toISOString() });
  processBatch(complaints).catch(e => console.error('[ingest]', e.message));
});

// Ingest a pre-built mock batch (1, 2, or 3)
app.post('/api/ingest/mock/:batch', async (req, res) => {
  const batchNum = parseInt(req.params.batch, 10);
  if (![1, 2, 3].includes(batchNum)) return err(res, 'batch must be 1, 2, or 3', 400);

  res.status(202).json({ success: true, data: { message: `Ingesting mock batch ${batchNum}` }, timestamp: new Date().toISOString() });
  ingestMockBatch(batchNum).catch(e => console.error('[mock ingest]', e.message));
});

// Complaints
app.get('/api/complaints',            (_req, res) => ok(res, getAllOpenComplaints()));
app.get('/api/complaints/batch/:id',  (req, res)  => ok(res, getComplaintsByBatch(req.params.id)));

// Cases
app.get('/api/cases',      (_req, res) => ok(res, getCases()));
app.get('/api/cases/:id',  (req, res)  => {
  const c = getCaseById(req.params.id);
  return c ? ok(res, c) : err(res, 'Case not found', 404);
});

// Batches
app.get('/api/batches', (_req, res) => ok(res, getBatches()));

// DAGs + Findings
app.get('/api/dags/batch/:id',    (req, res) => {
  const d = getDAGByBatchId(req.params.id);
  return d ? ok(res, d) : err(res, 'DAG not found', 404);
});
app.get('/api/dags/:id',          (req, res) => {
  const d = getDAGById(req.params.id);
  return d ? ok(res, d) : err(res, 'DAG not found', 404);
});
app.get('/api/dags/:id/findings', (req, res) => ok(res, getFindingsByDagId(req.params.id)));

// ── Boot ──────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  const hasKey = !!process.env.GROQ_API_KEY;
  console.log(`\n🏛  UrbanNexus backend → http://localhost:${PORT}`);
  console.log(`   WebSocket         → ws://localhost:${PORT}/ws`);
  console.log(`   Groq key          → ${hasKey ? '✅ set' : '❌ NOT SET — add GROQ_API_KEY to backend/.env'}\n`);
  if (!hasKey) {
    console.warn('   ⚠️  Without a Groq key the pipeline will throw on first LLM call.');
    console.warn('   Get a free key at https://console.groq.com\n');
  }
});
