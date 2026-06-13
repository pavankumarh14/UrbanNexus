'use strict';

const { v4: uuidv4 }    = require('uuid');
const { reasonWithLLM } = require('../../shared/llm');
const { saveFinding }   = require('../../db');

async function runDepartment(task) {
  const startTime = Date.now();
  const { taskId, dagId, batchId, complaints, context } = task;
  const intakeClassifications = context.intakeFinding?.details?.classifications || [];

  const systemPrompt = `You are a municipal operations specialist with deep domain knowledge of city services.
For each citizen complaint, assess what department should handle it, what crew is needed, what equipment is required, estimated time to resolve, health/safety risk, SOP reference, and any special notes.

DOMAIN KNOWLEDGE:
- water_leak / flooding:
  - Department: Water & Sewerage
  - High flow + road sinking = main break (150mm+ pipe) — excavation + isolation
  - Low seep = service connection — standard repair crew
  - Critical flooding = emergency protocol, may need pump trucks
- pothole:
  - Department: Roads & Infrastructure
  - Residential road = cold-patch repair (1 crew, 2 hrs)
  - Arterial/bus route = temporary patch + scheduled resurfacing (traffic mgmt needed)
  - Crater > 30cm = immediate hazard, road closure + urgent repair
- street_lighting:
  - Department: Electrical Maintenance
  - Single bulb = standard replacement (1 tech, 1 hr)
  - Multiple consecutive lights = circuit fault (electrician + cable test equipment)
  - Pole damage = structural assessment first
- sanitation:
  - Department: Waste Management
  - Missed collection = schedule extra run (no crew change)
  - Illegal dumping = enforcement + bulk removal crew
  - Pest sighting = health department notification + priority collection

Respond ONLY in valid JSON:
{
  "assessments": [
    {
      "complaint_id": "<complaint id>",
      "department": "water" | "roads" | "lighting" | "sanitation" | "emergency",
      "crew_type": "string description of crew needed",
      "equipment_needed": ["list", "of", "equipment"],
      "estimated_hours": number,
      "health_safety_risk": "none" | "low" | "medium" | "high" | "critical",
      "sop_reference": "string SOP reference code and title",
      "notes": "string special notes"
    }
  ]
}`;

  const userPrompt = JSON.stringify({
    complaints: complaints.map(c => {
      const classification = intakeClassifications.find(cls => cls.id === c.id);
      return {
        id: c.id,
        type: classification?.type ?? c.type,
        severity: classification?.severity ?? c.severity,
        description: c.description,
        location: c.location,
        ward: c.ward,
        needs_emergency: classification?.needs_emergency ?? false,
      };
    }),
  });

  let assessments = [];
  try {
    const raw = await reasonWithLLM(systemPrompt, userPrompt, true);
    const parsed = JSON.parse(raw);
    assessments = parsed.assessments || [];
  } catch (e) {
    console.error('[department] LLM parse failed:', e.message);
    assessments = complaints.map(c => {
      const classification = intakeClassifications.find(cls => cls.id === c.id);
      const type = classification?.type ?? c.type;
      let department, crewType, equipment, estimatedHours, risk, sop;
      if (type === 'water_leak' || type === 'flooding') {
        department = 'water';
        crewType = 'Water repair crew';
        equipment = ['pipe wrench', 'leak detector'];
        estimatedHours = 2;
        risk = 'low';
        sop = 'SOP-WATER-001: Standard leak repair';
      } else if (type === 'pothole') {
        department = 'roads';
        crewType = 'Road repair crew';
        equipment = ['cold patch', 'tamping tool'];
        estimatedHours = 2;
        risk = 'low';
        sop = 'SOP-ROADS-001: Pothole patching';
      } else if (type === 'street_lighting') {
        department = 'lighting';
        crewType = 'Electrical technician';
        equipment = ['ladder', 'replacement bulb'];
        estimatedHours = 1;
        risk = 'low';
        sop = 'SOP-LIGHTING-001: Bulb replacement';
      } else if (type === 'sanitation') {
        department = 'sanitation';
        crewType = 'Waste collection crew';
        equipment = ['collection truck'];
        estimatedHours = 1;
        risk = 'low';
        sop = 'SOP-SANITATION-001: Missed collection';
      } else {
        department = 'emergency';
        crewType = 'General operations crew';
        equipment = ['basic tools'];
        estimatedHours = 1;
        risk = 'low';
        sop = 'SOP-GENERAL-001: General complaint handling';
      }
      return {
        complaint_id: c.id,
        department,
        crew_type: crewType,
        equipment_needed: equipment,
        estimated_hours: estimatedHours,
        health_safety_risk: risk,
        sop_reference: sop,
        notes: 'Fallback assessment due to LLM failure',
      };
    });
  }

  const departmentsInvolved = [...new Set(assessments.map(a => a.department))];
  const summary = `Assessed ${complaints.length} complaints for ${departmentsInvolved.length} department${departmentsInvolved.length > 1 ? 's' : ''}`;

  const finding = {
    id: `finding-${uuidv4()}`,
    dag_id: dagId,
    batch_id: batchId,
    node_id: 'department',
    capability: 'department',
    summary,
    details: {
      assessments,
      departments_involved: departmentsInvolved,
    },
    confidence: 0.8,
    verdict: assessments.some(a => a.health_safety_risk === 'critical' || a.health_safety_risk === 'high') ? 'significant' : 'minor',
    provenance: {
      agentId: 'department-01',
      model: 'llama-3.1-8b-instant',
      durationMs: Date.now() - startTime,
    },
    created_at: new Date().toISOString(),
  };

  saveFinding(finding);
  return finding;
}

module.exports = { runDepartment };
