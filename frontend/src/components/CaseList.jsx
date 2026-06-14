import React from 'react';

const TYPE_META = {
  water_leak:      { icon: '💧', color: '#0ea5e9' },
  flooding:        { icon: '🌊', color: '#2563eb' },
  pothole:         { icon: '🕳',  color: '#f59e0b' },
  street_lighting: { icon: '💡', color: '#8b5cf6' },
  sanitation:      { icon: '🗑',  color: '#6b7280' },
  other:           { icon: '📋', color: '#374151' },
};

const STATUS_COLOR = {
  open:       '#ca8a04',
  in_progress:'#2563eb',
  escalated:  '#dc2626',
  resolved:   '#16a34a',
};

export function CaseList({ cases, complaints, onSelectCase, activeCase }) {
  const grouped = groupByCase(complaints, cases);

  if (cases.length === 0 && complaints.length === 0) {
    return (
      <div className="case-list empty">
        <p>No complaints ingested yet</p>
        <p className="hint">Click "Ingest Complaint Batch" to start the pipeline.</p>
      </div>
    );
  }

  return (
    <div className="case-list">
      {/* Cases first */}
      {cases.length > 0 && (
        <>
          <div className="sidebar-section-header">Root Cause Cases ({cases.length})</div>
          {cases.map(c => {
            const meta = TYPE_META[c.type] ?? TYPE_META.other;
            return (
              <div
                key={c.id}
                className={`case-card ${activeCase?.id === c.id ? 'active' : ''}`}
                onClick={() => onSelectCase?.(c)}
                style={{ borderLeftColor: meta.color, cursor: 'pointer' }}
              >
                <div className="case-header">
                  <span className="type-icon">{meta.icon}</span>
                  <span className="case-ward">{c.ward}</span>
                  <span className="case-count">{c.complaint_count} reports</span>
                  <span className="status-badge" style={{ color: STATUS_COLOR[c.status] }}>
                    ● {c.status}
                  </span>
                </div>
                {c.root_cause && <p className="case-root-cause">{c.root_cause}</p>}
                <div className="case-time">{formatTime(c.created_at)}</div>
              </div>
            );
          })}
        </>
      )}

      {/* Individual complaints */}
      {grouped.individual.length > 0 && (
        <>
          <div className="sidebar-section-header">Individual Complaints ({grouped.individual.length})</div>
          {grouped.individual.map(c => {
            const meta = TYPE_META[c.type] || TYPE_META.other;
            return (
              <div
                key={c.id}
                className="case-card individual"
                style={{ borderLeftColor: meta.color }}
              >
                <div className="case-header">
                  <span className="type-icon">{meta.icon}</span>
                  <span className="case-ward">{c.ward}</span>
                  <span className={`severity-badge`} style={{ background: c.severity === 'critical' || c.severity === 'high' ? '#dc2626' : c.severity === 'medium' ? '#ca8a04' : '#16a34a', color: '#fff' }}>{c.severity}</span>
                  <span className="status-badge" style={{ color: STATUS_COLOR[c.status] || '#94a3b8' }}>
                    ● {c.status}
                  </span>
                </div>
                <p className="complaint-desc">{c.description.slice(0, 90)}{c.description.length > 90 ? '…' : ''}</p>
                <div className="case-time">{formatTime(c.created_at)}</div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function groupByCase(complaints, cases) {
  const caseIds  = new Set(cases.map(c => c.id));
  const individual = complaints.filter(c => !c.case_id || !caseIds.has(c.case_id));
  return { individual };
}

function formatTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
