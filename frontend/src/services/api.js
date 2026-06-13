const BASE = '/api';

async function request(method, path, body) {
  const res  = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body:    body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data;
}

// Ingestion
export const ingestMockBatch    = (n)         => request('POST', `/ingest/mock/${n}`);
export const ingestComplaints   = (complaints) => request('POST', '/ingest', { complaints });

// Complaints
export const getComplaints      = ()   => request('GET', '/complaints');
export const getBatchComplaints = (id) => request('GET', `/complaints/batch/${id}`);

// Cases
export const getCases           = ()   => request('GET', '/cases');
export const getCase            = (id) => request('GET', `/cases/${id}`);

// Batches
export const getBatches         = ()   => request('GET', '/batches');

// DAGs + Findings
export const getBatchDAG        = (batchId) => request('GET', `/dags/batch/${batchId}`);
export const getDAG             = (dagId)   => request('GET', `/dags/${dagId}`);
export const getDAGFindings     = (dagId)   => request('GET', `/dags/${dagId}/findings`);
