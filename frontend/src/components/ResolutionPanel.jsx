import React, { useState } from 'react';

const TYPE_ICON = {
  water_leak: '💧',
  flooding: '🌊',
  pothole: '🕳',
  street_lighting: '💡',
  sanitation: '🗑',
  other: '📋',
};

export function ResolutionPanel({ activeCase, complaints = [] }) {
  const [toast, setToast] = useState('');
  const [showAllComplaints, setShowAllComplaints] = useState(false);

  if (!activeCase) {
    return (
      <div className="resolution-panel empty">
        <p>No case selected</p>
        <p className="hint">Select an escalated case from the sidebar to review the draft response.</p>
      </div>
    );
  }

  const caseComplaints = complaints.filter(c => c.case_id === activeCase.id);
  const displayComplaints = showAllComplaints ? caseComplaints : caseComplaints.slice(0, 5);

  function handleAction(action) {
    setToast(action === 'approve' ? '✅ Dispatched to field crew' : '❌ Sent back for review');
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflow: 'auto' }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#1f2937',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
          }}
        >
          {toast}
        </div>
      )}

      {/* Case Header */}
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.1)',
          borderLeft: '4px solid #ef4444',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '24px', marginRight: '12px' }}>{TYPE_ICON[activeCase.type] || TYPE_ICON.other}</span>
            <h2 style={{ margin: 0, display: 'inline', color: '#e5e7eb', fontSize: '20px' }}>
              {activeCase.ward} - {activeCase.type}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span
              style={{
                background: '#ef4444',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              {activeCase.complaint_count} complaints
            </span>
            <span
              style={{
                background: activeCase.status === 'escalated' ? '#ef4444' : '#374151',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}
            >
              {activeCase.status}
            </span>
          </div>
        </div>
        {!activeCase.resolution_draft && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              borderLeft: '3px solid #f59e0b',
              padding: '12px 16px',
              borderRadius: '4px',
              marginTop: '12px',
            }}
          >
            ⚠️ Resolution agent not yet implemented — drafts will be empty
          </div>
        )}
      </div>

      {/* Root Cause */}
      {activeCase.root_cause && (
        <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 8px 0', color: '#9ca3af', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            🔍 Root Cause
          </p>
          <p style={{ margin: 0, color: '#d1d5db', fontSize: '16px' }}>{activeCase.root_cause}</p>
        </div>
      )}

      {/* Drafts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 'bold' }}>📧 Citizen Response Draft</label>
          <textarea
            defaultValue={activeCase.resolution_draft || ''}
            placeholder="Resolution agent not yet implemented"
            style={{
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '12px',
              color: '#e5e7eb',
              minHeight: '150px',
              resize: 'vertical',
              fontSize: '14px',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 'bold' }}>🛠️ Work Order</label>
          <textarea
            defaultValue={activeCase.work_order || ''}
            placeholder="Resolution agent not yet implemented"
            style={{
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '12px',
              color: '#e5e7eb',
              minHeight: '150px',
              resize: 'vertical',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      {/* Affected Complaints */}
      <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 12px 0', color: '#9ca3af', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
          📋 Affected Complaints ({caseComplaints.length})
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayComplaints.map(c => (
            <div
              key={c.id}
              style={{
                background: '#111827',
                padding: '12px',
                borderRadius: '6px',
                borderLeft: '3px solid #374151',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ color: '#e5e7eb', fontWeight: '500' }}>{c.ward}</span>
                <span
                  style={{
                    background: c.severity === 'critical' || c.severity === 'high' ? '#ef4444' : c.severity === 'medium' ? '#f59e0b' : '#16a34a',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}
                >
                  {c.severity}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '13px' }}>
                {c.description.slice(0, 100)}{c.description.length > 100 ? '...' : ''}
              </p>
            </div>
          ))}
        </div>
        {caseComplaints.length > 5 && (
          <button
            onClick={() => setShowAllComplaints(!showAllComplaints)}
            style={{
              marginTop: '12px',
              background: 'transparent',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            {showAllComplaints ? 'Show less' : `Show all ${caseComplaints.length} complaints`}
          </button>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
        <button
          onClick={() => handleAction('approve')}
          style={{
            flex: 1,
            background: '#16a34a',
            color: 'white',
            border: 'none',
            padding: '14px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          ✅ Approve & Dispatch
        </button>
        <button
          onClick={() => handleAction('reject')}
          style={{
            flex: 1,
            background: '#374151',
            color: 'white',
            border: 'none',
            padding: '14px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          ❌ Reject — Send Back
        </button>
      </div>
    </div>
  );
}
