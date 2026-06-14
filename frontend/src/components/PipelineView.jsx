import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

const NODE_POSITIONS = {
  intake: { x: 80, y: 80 },
  clustering: { x: 320, y: 80 },
  department: { x: 80, y: 240 },
  resolution: { x: 200, y: 400 },
};

const NODE_LABELS = {
  intake: '🔍 Intake',
  clustering: '🔗 Clustering',
  department: '🏢 Department',
  resolution: '📋 Resolution',
};

const NODE_DESCRIPTIONS = {
  intake: 'Classifies complaints and extracts key information like type, severity, and urgency.',
  clustering: 'Groups similar complaints by location and type to identify root causes.',
  department: 'Adds domain-specific information based on complaint type (water, roads, lighting, etc.).',
  resolution: 'Generates draft citizen responses and work orders for cases.',
};

function statusColor(status) {
  switch (status) {
    case 'pending': return '#374151';
    case 'running': return '#2563eb';
    case 'completed': return '#16a34a';
    case 'failed': return '#dc2626';
    default: return '#374151';
  }
}

function CustomNode({ data }) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        background: data.color,
        color: 'white',
        textAlign: 'center',
        minWidth: '160px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        border: '2px solid rgba(255,255,255,0.2)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{data.label}</div>
      {data.confidence !== null && (
        <div style={{ fontSize: '12px', opacity: 0.9 }}>
          Confidence: {Math.round(data.confidence * 100)}%
        </div>
      )}
      <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
        Status: {data.status}
      </div>
      {isHovered && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
          padding: '8px 12px',
          background: '#111827',
          borderRadius: '6px',
          fontSize: '11px',
          maxWidth: '200px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          border: '1px solid #374151',
        }}>
          {data.description}
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

export function PipelineView({ dag }) {
  if (!dag) {
    return (
      <div className="pipeline-view empty">
        <p>No active pipeline</p>
        <p className="hint">Ingest a complaint batch to see the pipeline animate.</p>
      </div>
    );
  }

  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const nodes = dag.nodes.map(node => ({
      id: node.id,
      type: 'custom',
      position: NODE_POSITIONS[node.id],
      data: {
        label: NODE_LABELS[node.id],
        status: node.status,
        color: statusColor(node.status),
        confidence: node.confidence,
        description: NODE_DESCRIPTIONS[node.id],
      },
    }));

    const edges = [
      { id: 'e1', source: 'intake', target: 'department', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e2', source: 'clustering', target: 'resolution', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e3', source: 'department', target: 'resolution', markerEnd: { type: MarkerType.ArrowClosed } },
    ];

    return { nodes, edges };
  }, [dag]);

  return (
    <div style={{ height: 500, width: '100%', background: '#1f2937', borderRadius: '8px' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={16} />
        <Controls style={{ background: '#374151', color: 'white' }} />
      </ReactFlow>
    </div>
  );
}
