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
  const [view, setView]             = useState('pipeline');
  const [eventCount, setEventCount] = useState(0);

  const { lastMessage, isConnected } = useWebSocket();

  useEffect(() => {
    Promise.all([getCases(), getComplaints()])
      .then(([c, comp]) => { setCases(c); setComplaints(comp); })
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
    }
  }, [lastMessage]);

  function handleBatchStarted() {
    setView('pipeline');
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
