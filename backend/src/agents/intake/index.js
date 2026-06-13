'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Intake agent — reference implementation.
//
// Classifies every complaint in the batch using a single batched LLM call,
// then saves enriched complaint data back to SQLite.
//
// This is the pattern all candidate agents (Department, Clustering, Resolution)
// must follow. Read every line before implementing your own agent.
//
// What it does:
//   1. Sends all complaints to the LLM in one call — efficient, one round-trip
//   2. Parses the structured JSON response
//   3. Updates each complaint record in SQLite with the classification
//   4. Returns a Finding with the classified complaints in details
// ─────────────────────────────────────────────────────────────────────────────

const { v4: uuidv4 }    = require('uuid');
const { reasonWithLLM } = require('../../shared/llm');
const { saveFinding, saveComplaint } = require('../../db');

/**
 * @param {object} task  TaskPayload from the orchestrator
 * @returns {Promise<object>} Finding
 */
async function runIntake(task) {
  const startTime = Date.now();
  const { taskId, dagId, batchId, complaints } = task;

  const systemPrompt = `You are a municipal complaint intake officer.
Classify each citizen complaint in the provided array.
For type use ONLY: pothole | water_leak | street_lighting | sanitation | flooding | other
For severity use ONLY: low | medium | high | critical
Respond ONLY in valid JSON:
{
  "classifications": [
    {
      "id": "<complaint id>",
      "type": "...",
      "severity": "...",
      "needs_emergency": true|false,
      "keywords": ["term1", "term2"],
      "clean_description": "one sentence professional summary"
    }
  ]
}`;

  const userPrompt = JSON.stringify({
    complaints: complaints.map(c => ({
      id:          c.id,
      description: c.description,
      location:    c.location,
      ward:        c.ward,
    })),
  });

  let classifications = [];
  try {
    const raw    = await reasonWithLLM(systemPrompt, userPrompt, true);
    const parsed = JSON.parse(raw);
    classifications = parsed.classifications ?? [];
  } catch (e) {
    console.error('[intake] LLM parse failed:', e.message);
    // Fallback: mark each complaint with its provided type/severity
    classifications = complaints.map(c => ({
      id: c.id, type: c.type, severity: c.severity,
      needs_emergency: c.severity === 'critical',
      keywords: [c.type, c.ward],
      clean_description: c.description.slice(0, 100),
    }));
  }

  // Update complaint records with LLM-refined classification
  for (const cls of classifications) {
    const original = complaints.find(c => c.id === cls.id);
    if (original) {
      saveComplaint({
        ...original,
        type:     cls.type     ?? original.type,
        severity: cls.severity ?? original.severity,
        status:   'in_progress',
      });
    }
  }

  const emergencyCount = classifications.filter(c => c.needs_emergency).length;
  const summary = `Classified ${complaints.length} complaints — ${emergencyCount} need emergency response`;

  const finding = {
    id:          `finding-${uuidv4()}`,
    dag_id:      dagId,
    batch_id:    batchId,
    node_id:     'intake',
    capability:  'intake',
    summary,
    details: {
      classifications,
      total:            complaints.length,
      emergency_count:  emergencyCount,
      type_breakdown:   groupBy(classifications, 'type'),
    },
    confidence: 0.85,
    verdict:    emergencyCount > 0 ? 'significant' : 'minor',
    provenance: {
      agentId:    'intake-01',
      model:      'llama-3.1-8b-instant',
      durationMs: Date.now() - startTime,
    },
    created_at: new Date().toISOString(),
  };

  saveFinding(finding);
  return finding;
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] ?? 'unknown';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

module.exports = { runIntake };
