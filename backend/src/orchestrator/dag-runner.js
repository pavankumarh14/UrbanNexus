'use strict';

// Same state-machine pattern as MarketMind — read that first if unfamiliar.
// Node lifecycle: pending → running → completed | failed

class DAGRunner {
  constructor(dag) {
    this._dag = JSON.parse(JSON.stringify(dag));
  }

  getReadyNodes() {
    return this._dag.nodes.filter(node => {
      if (node.status !== 'pending') return false;
      return node.dependencies.every(depId => {
        const dep = this._dag.nodes.find(n => n.id === depId);
        return dep && dep.status === 'completed';
      });
    });
  }

  markNodeRunning(nodeId) {
    const node = this._getNode(nodeId);
    node.status     = 'running';
    node.started_at = new Date().toISOString();
    this._dag.updated_at = new Date().toISOString();
  }

  markNodeCompleted(nodeId, finding) {
    const node = this._getNode(nodeId);
    node.status       = 'completed';
    node.completed_at = new Date().toISOString();
    node.finding_id   = finding?.id ?? null;
    node.confidence   = finding?.confidence ?? null;
    this._dag.updated_at = new Date().toISOString();
  }

  markNodeFailed(nodeId, error) {
    const node = this._getNode(nodeId);
    node.status    = 'failed';
    node.error     = error?.message ?? String(error);
    node.failed_at = new Date().toISOString();
    this._dag.updated_at = new Date().toISOString();
  }

  isDone()    { return this._dag.nodes.every(n => n.status === 'completed' || n.status === 'failed'); }
  isSuccess() { return this._dag.nodes.every(n => n.status === 'completed'); }
  getDAG()    { return this._dag; }

  _getNode(id) {
    const node = this._dag.nodes.find(n => n.id === id);
    if (!node) throw new Error(`Node not found: ${id}`);
    return node;
  }
}

module.exports = { DAGRunner };
