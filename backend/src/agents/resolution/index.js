'use strict';

const { v4: uuidv4 }    = require('uuid');
const { reasonWithLLM } = require('../../shared/llm');
const { saveFinding, updateComplaintStatus, updateCase, getCaseById } = require('../../db');

async function runResolution(task) {
  const startTime = Date.now();
  const { taskId, dagId, batchId, complaints, context } = task;
  const departmentAssessments = context.departmentFinding?.details?.assessments || [];
  const clusters = context.clusteringFinding?.details?.clusters || [];

  const systemPrompt = `You are a municipal resolution officer.
For each complaint or case (cluster of complaints), draft:
1. A professional citizen response acknowledging the complaint, explaining what action is being taken, and giving an estimated timeframe
2. A detailed work order for the field crew with location, priority, crew/equipment needed, and instructions

For clustered complaints (case_id set):
- Draft one citizen response referencing the Case number and noting that multiple reports have been consolidated
- Draft one work order for the root cause

For individual complaints:
- Draft a citizen response per complaint
- Draft a work order per complaint

Respond ONLY in valid JSON:
{
  "resolutions": [
    {
      "complaint_id": "string or null (null for case-level resolution)",
      "case_id": "string or null (set for escalated clusters)",
      "type": "individual" | "escalated",
      "citizen_response": "professional message to resident(s)",
      "work_order": "internal crew instruction",
      "priority": "routine" | "urgent" | "emergency",
      "estimated_hours": number
    }
  ]
}`;

  const userPromptData = {
    complaints: complaints.map(c => {
      const assessment = departmentAssessments.find(a => a.complaint_id === c.id);
      return {
        id: c.id,
        case_id: c.case_id,
        type: c.type,
        severity: c.severity,
        description: c.description,
        location: c.location,
        ward: c.ward,
        status: c.status,
        assessment,
      };
    }),
    clusters: clusters.map(c => {
      const caseRecord = getCaseById(c.case_id);
      return {
        case_id: c.case_id,
        ward: c.ward,
        type: c.type,
        complaint_count: c.complaint_count,
        root_cause: c.root_cause,
        complaint_ids: c.complaint_ids,
        case_record: caseRecord,
        assessments: c.complaint_ids.map(cid => departmentAssessments.find(a => a.complaint_id === cid)).filter(Boolean),
      };
    }),
  };

  const userPrompt = JSON.stringify(userPromptData);

  let resolutions = [];
  try {
    const raw = await reasonWithLLM(systemPrompt, userPrompt, true);
    const parsed = JSON.parse(raw);
    resolutions = parsed.resolutions || [];
  } catch (e) {
    console.error('[resolution] LLM parse failed:', e.message);
    const processedCaseIds = new Set();
    for (const complaint of complaints) {
      const assessment = departmentAssessments.find(a => a.complaint_id === complaint.id);
      if (complaint.case_id && !processedCaseIds.has(complaint.case_id)) {
        processedCaseIds.add(complaint.case_id);
        const cluster = clusters.find(c => c.case_id === complaint.case_id);
        resolutions.push({
          complaint_id: null,
          case_id: complaint.case_id,
          type: 'escalated',
          citizen_response: `Dear resident, we have received multiple reports about ${cluster?.type} in ${cluster?.ward} and have consolidated them into Case ${complaint.case_id}. ${cluster?.root_cause} We are dispatching ${assessment?.crew_type} with estimated resolution in ${assessment?.estimated_hours} hours. We apologize for the inconvenience.`,
          work_order: `Location: ${cluster?.ward} | Issue: ${cluster?.type} | Root Cause: ${cluster?.root_cause} | Crew: ${assessment?.crew_type} | Equipment: ${(assessment?.equipment_needed || []).join(', ')} | Estimated Time: ${assessment?.estimated_hours} hours | Priority: emergency`,
          priority: 'emergency',
          estimated_hours: assessment?.estimated_hours || 4,
        });
      } else if (!complaint.case_id) {
        resolutions.push({
          complaint_id: complaint.id,
          case_id: null,
          type: 'individual',
          citizen_response: `Dear resident, we have received your complaint about ${complaint.type} at ${complaint.location}. We are dispatching ${assessment?.crew_type} with estimated resolution in ${assessment?.estimated_hours} hours. Thank you for your patience.`,
          work_order: `Location: ${complaint.location} | Issue: ${complaint.type} | Severity: ${complaint.severity} | Crew: ${assessment?.crew_type} | Equipment: ${(assessment?.equipment_needed || []).join(', ')} | Estimated Time: ${assessment?.estimated_hours} hours | Priority: routine`,
          priority: 'routine',
          estimated_hours: assessment?.estimated_hours || 2,
        });
      }
    }
  }

  const processedCaseIds = new Set();
  for (const resolution of resolutions) {
    if (resolution.type === 'escalated' && resolution.case_id && !processedCaseIds.has(resolution.case_id)) {
      updateCase(resolution.case_id, {
        resolution_draft: resolution.citizen_response,
        work_order: resolution.work_order,
        status: 'escalated',
      });
      processedCaseIds.add(resolution.case_id);
    } else if (resolution.type === 'individual' && resolution.complaint_id) {
      updateComplaintStatus(resolution.complaint_id, 'resolved');
    }
  }

  const totalResolved = resolutions.filter(r => r.type === 'individual').length;
  const totalEscalated = resolutions.filter(r => r.type === 'escalated').length;
  const summary = `Drafted resolutions for ${resolutions.length} item${resolutions.length > 1 ? 's' : ''} — ${totalResolved} individual, ${totalEscalated} escalated`;

  const finding = {
    id: `finding-${uuidv4()}`,
    dag_id: dagId,
    batch_id: batchId,
    node_id: 'resolution',
    capability: 'resolution',
    summary,
    details: {
      resolutions,
      total_resolved: totalResolved,
      total_escalated: totalEscalated,
    },
    confidence: 0.8,
    verdict: totalEscalated > 0 ? 'significant' : 'minor',
    provenance: {
      agentId: 'resolution-01',
      model: 'llama-3.1-8b-instant',
      durationMs: Date.now() - startTime,
    },
    created_at: new Date().toISOString(),
  };

  saveFinding(finding);
  return finding;
}

module.exports = { runResolution };
