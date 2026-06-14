import React, { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { getCases, getComplaints, getBatches, getBatchDAG } from './services/api';
import { ComplaintIngest }  from './components/ComplaintIngest';
import { CaseList }         from './components/CaseList';
import { PipelineView }     from './components/PipelineView';
import { ClusterMap }       from './components/ClusterMap';
import { ResolutionPanel }  from './components/ResolutionPanel';

export default function App() {
  const [cases, setCases]           = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [activeCase, setActiveCase] = useState(null);
  const [activeDAG, setActiveDAG]   = useState(null);
  const [batches, setBatches]       = useState([]);
  const [view, setView]             = useState('pipeline');
  const [eventCount, setEventCount] = useState(0);

  const { lastMessage, isConnected } = useWebSocket();

  useEffect(() => {
    Promise.all([getCases(), getComplaints(), getBatches()])
      .then(async ([casesData, complaintsData, batchesData]) => {
        setCases(casesData);
        setComplaints(complaintsData);
        setBatches(batchesData);
        if (batchesData.length > 0) {
          try {
            const latestBatch = batchesData[0];
            const dag = await getBatchDAG(latestBatch.id);
            setActiveDAG(dag);
          } catch (e) {
            console.error('Failed to get latest DAG:', e);
          }
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    setEventCount(n => n + 1);
    const { type, data } = lastMessage;

    if (type === 'dag_update') setActiveDAG(data);

    if (type === 'batch_complete') {
      getCases().then(setCases).catch(console.error);
      getComplaints().then(setComplaints).catch(console.error);
      getBatches().then(setBatches).catch(console.error);
    }
  }, [lastMessage]);

  function handleBatchStarted() {
    setView('pipeline');
  }

  async function handleSelectBatch(batchId) {
    try {
      const dag = await getBatchDAG(batchId);
      setActiveDAG(dag);
    } catch (e) {
      console.error('Failed to get batch DAG:', e);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="logo">🏛 UrbanNexus</span>
          <span className={`ws-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="event-count">{eventCount} events</span>
        </div>
        <div className="header-right">
          <span className="stat">{cases.length} cases</span>
          <span className="stat">{complaints.length} complaints</span>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <ComplaintIngest onBatchStarted={handleBatchStarted} />
          <div className="sidebar-divider" />
          <div className="sidebar-section-header">Cases &amp; Complaints</div>
          <CaseList
            cases={cases}
            complaints={complaints}
            onSelectCase={setActiveCase}
            activeCase={activeCase}
          />
        </aside>

        <main className="main-panel">
          {batches.length > 0 && (
            <div className="batch-selector" style={{ marginBottom: '16px', padding: '12px', background: '#1e293b', borderRadius: '8px' }}>
              <label style={{ marginRight: '8px', color: '#94a3b8', fontSize: '12px' }}>Select Batch:</label>
              <select
                value={activeDAG?.batch_id || batches[0]?.id}
                onChange={(e) => handleSelectBatch(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  background: '#0f172a',
                  color: '#f1f5f9',
                  fontSize: '12px'
                }}
              >
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.id} ({batch.status})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="view-tabs">
            {[
              { id: 'pipeline',   label: '🕸 Pipeline'   },
              { id: 'clusters',   label: '🔗 Clusters'   },
              { id: 'resolution', label: '📋 Resolution' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab ${view === tab.id ? 'active' : ''}`}
                onClick={() => setView(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {view === 'pipeline'   && <PipelineView   dag={activeDAG} />}
          {view === 'clusters'   && <ClusterMap     complaints={complaints} cases={cases} />}
          {view === 'resolution' && <ResolutionPanel activeCase={activeCase} complaints={complaints} />}
        </main>
      </div>
    </div>
  );
}
