import React, { useState } from 'react';

const TYPE_ICON = {
  water_leak: '💧',
  flooding: '🌊',
  pothole: '🕳',
  street_lighting: '💡',
  sanitation: '🗑',
  other: '📋',
};

export function ClusterMap({ complaints = [], cases = [] }) {
  const [expandedCase, setExpandedCase] = useState(null);

  const clusteredComplaints = complaints.filter(c => c.case_id);
  const individualComplaints = complaints.filter(c => !c.case_id);

  if (complaints.length === 0) {
    return (
      <div className="cluster-map empty">
        <p>No complaints yet</p>
        <p className="hint">Ingest Batch 1 to see complaints appear, then Batch 2 to see clustering activate.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', height: '100%', overflow: 'auto' }}>
      {/* Left column: Root Cause Cases */}
      <div>
        <h3 style={{ margin: '0 0 16px 0', color: '#e5e7eb' }}>🔗 Root Cause Cases ({cases.length})</h3>
        {cases.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No clusters detected yet. Ingest Batch 2 to see clustering in action!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {cases.map(caseItem => {
              const caseComplaints = complaints.filter(c => c.case_id === caseItem.id);
              const isExpanded = expandedCase === caseItem.id;
              return (
                <div
                  key={caseItem.id}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderLeft: '4px solid #ef4444',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '18px', marginRight: '8px' }}>{TYPE_ICON[caseItem.type] || TYPE_ICON.other}</span>
                      <strong style={{ color: '#e5e7eb' }}>{caseItem.ward} - {caseItem.type}</strong>
                    </div>
                    <span
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      {caseItem.complaint_count} complaints
                    </span>
                  </div>
                  {caseItem.root_cause && (
                    <p style={{ margin: '8px 0', color: '#d1d5db', fontSize: '14px' }}>
                      <strong>Root Cause:</strong> {caseItem.root_cause}
                    </p>
                  )}
                  <button
                    onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #374151',
                      color: '#9ca3af',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    {isExpanded ? 'Hide complaints' : 'Show complaints'}
                  </button>
                  {isExpanded && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {caseComplaints.map(c => (
                        <div
                          key={c.id}
                          style={{
                            background: '#1f2937',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            fontSize: '13px',
                          }}
                        >
                          <div style={{ color: '#e5e7eb' }}>{c.description.slice(0, 80)}{c.description.length > 80 ? '...' : ''}</div>
                          <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px' }}>{c.location}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {caseItem.resolution_draft && (
                    <div style={{ marginTop: '12px', padding: '12px', background: '#1f2937', borderRadius: '4px' }}>
                      <p style={{ margin: '0 0 4px 0', color: '#9ca3af', fontSize: '12px', fontWeight: 'bold' }}>Draft Response:</p>
                      <p style={{ margin: 0, color: '#d1d5db', fontSize: '13px' }}>{caseItem.resolution_draft}</p>
                    </div>
                  )}
                  {caseItem.work_order && (
                    <div style={{ marginTop: '8px', padding: '12px', background: '#1f2937', borderRadius: '4px' }}>
                      <p style={{ margin: '0 0 4px 0', color: '#9ca3af', fontSize: '12px', fontWeight: 'bold' }}>Work Order:</p>
                      <p style={{ margin: 0, color: '#d1d5db', fontSize: '13px' }}>{caseItem.work_order}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right column: Individual Complaints */}
      <div>
        <h3 style={{ margin: '0 0 16px 0', color: '#e5e7eb' }}>📋 Individual Complaints ({individualComplaints.length})</h3>
        {individualComplaints.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>All complaints have been clustered into root cause cases!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {individualComplaints.map(c => (
              <div
                key={c.id}
                style={{
                  background: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '18px', marginRight: '8px' }}>{TYPE_ICON[c.type] || TYPE_ICON.other}</span>
                    <span style={{ color: '#e5e7eb', fontWeight: '500' }}>{c.ward}</span>
                  </div>
                  <span
                    style={{
                      background: c.severity === 'critical' || c.severity === 'high' ? '#ef4444' : c.severity === 'medium' ? '#f59e0b' : '#16a34a',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    {c.severity}
                  </span>
                </div>
                <p style={{ margin: '8px 0', color: '#d1d5db', fontSize: '14px' }}>
                  {c.description.slice(0, 150)}{c.description.length > 150 ? '...' : ''}
                </p>
                <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                  📍 {c.location} | Status: {c.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
