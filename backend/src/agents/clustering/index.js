'use strict';

const { v4: uuidv4 }  = require('uuid');
const { saveFinding, getAllOpenComplaints, saveCase, assignComplaintToCase } = require('../../db');

const CLUSTER_THRESHOLD  = 3;
const TIME_WINDOW_HOURS  = 48;

function normaliseType(type) {
  if (type === 'flooding') return 'water_leak';
  return type;
}

async function runClustering(task) {
  const startTime = Date.now();
  const allOpenComplaints = getAllOpenComplaints();

  const groups = {};
  for (const complaint of allOpenComplaints) {
    const normalisedType = normaliseType(complaint.type);
    const groupKey = `${complaint.ward}-${normalisedType}`;
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(complaint);
  }

  const clusters = [];
  const now = new Date();
  for (const [key, complaintsInGroup] of Object.entries(groups)) {
    const timeWindowMs = TIME_WINDOW_HOURS * 60 * 60 * 1000;
    const recentComplaints = complaintsInGroup.filter(c => {
      const createdAt = new Date(c.created_at);
      return (now - createdAt) <= timeWindowMs;
    });

    if (recentComplaints.length >= CLUSTER_THRESHOLD) {
      const ward = recentComplaints[0].ward;
      const type = normaliseType(recentComplaints[0].type);
      const caseId = `case-${uuidv4()}`;
      const complaintIds = recentComplaints.map(c => c.id);
      let rootCause;
      if (type === 'water_leak') {
        rootCause = `Suspected burst water main in ${ward} based on ${recentComplaints.length} related complaints.`;
      } else if (type === 'pothole') {
        rootCause = `Suspected road surface failure in ${ward} based on ${recentComplaints.length} related complaints.`;
      } else {
        rootCause = `Root-cause issue detected in ${ward} for ${type} with ${recentComplaints.length} complaints.`;
      }

      saveCase({
        id: caseId,
        batch_id: task.batchId,
        ward,
        type,
        complaint_count: recentComplaints.length,
        root_cause: rootCause,
        status: 'escalated',
        created_at: new Date().toISOString(),
      });

      for (const complaintId of complaintIds) {
        assignComplaintToCase(complaintId, caseId);
      }

      clusters.push({
        case_id: caseId,
        ward,
        type,
        complaint_ids: complaintIds,
        root_cause: rootCause,
        complaint_count: recentComplaints.length,
      });
    }
  }

  const totalClustered = clusters.reduce((sum, c) => sum + c.complaint_count, 0);
  const totalIndividual = allOpenComplaints.length - totalClustered;
  const summary = clusters.length > 0
    ? `Detected ${clusters.length} root-cause cluster${clusters.length > 1 ? 's' : ''}: ${clusters.map(c => `${c.complaint_count} ${c.type} complaints in ${c.ward}`).join(', ')}`
    : 'No root-cause clusters detected';

  const finding = {
    id: `finding-${uuidv4()}`,
    dag_id: task.dagId,
    batch_id: task.batchId,
    node_id: 'clustering',
    capability: 'clustering',
    summary,
    details: {
      clusters,
      total_clustered: totalClustered,
      total_individual: totalIndividual,
    },
    confidence: 1.0,
    verdict: clusters.length > 0 ? 'significant' : 'neutral',
    provenance: { agentId: 'clustering-01', model: 'algorithm', durationMs: Date.now() - startTime },
    created_at: new Date().toISOString(),
  };

  saveFinding(finding);
  return finding;
}

module.exports = { runClustering, CLUSTER_THRESHOLD, TIME_WINDOW_HOURS };
