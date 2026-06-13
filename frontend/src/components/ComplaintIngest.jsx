import React, { useState } from 'react';
import { ingestMockBatch } from '../services/api';

const BATCH_DESCRIPTIONS = {
  1: 'Mixed individual complaints — potholes, lighting, sanitation across 4 wards',
  2: '⚠️ Cluster scenario — 5 water complaints in Ward 7 pointing to one burst main',
  3: '🚨 Escalation — Ward 7 situation critical + new complaints in other wards',
};

export function ComplaintIngest({ onBatchStarted }) {
  const [loading, setLoading] = useState(null);
  const [error, setError]     = useState('');

  async function handleIngest(batchNum) {
    setError('');
    setLoading(batchNum);
    try {
      await ingestMockBatch(batchNum);
      onBatchStarted?.(batchNum);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="ingest-panel">
      <h2>Ingest Complaint Batch</h2>
      <p className="ingest-hint">
        Each batch triggers the full 4-agent pipeline. Ingest in order (1 → 2 → 3)
        to see clustering activate in Batch 2.
      </p>

      <div className="batch-grid">
        {[1, 2, 3].map(n => (
          <div key={n} className={`batch-card ${n === 2 ? 'highlight' : ''}`}>
            <div className="batch-label">Batch {n}</div>
            <p className="batch-desc">{BATCH_DESCRIPTIONS[n]}</p>
            <button
              className={`btn-ingest ${n === 2 ? 'btn-ingest-highlight' : ''}`}
              onClick={() => handleIngest(n)}
              disabled={loading !== null}
            >
              {loading === n ? '⏳ Processing…' : `▶ Ingest Batch ${n}`}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="error-msg">❌ {error}</p>}

      <p className="ingest-note">
        Processing runs in background — watch the Pipeline tab for live node updates.
      </p>
    </div>
  );
}
