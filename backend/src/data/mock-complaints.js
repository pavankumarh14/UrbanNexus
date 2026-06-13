'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Mock complaint fixtures — 3 batches that tell a progressive story.
//
// Batch 1 — mixed individual complaints across different wards
// Batch 2 — the cluster scenario: 5 water complaints in Ward 7 pointing to
//            one burst water main on Pine Street (the standout UrbanNexus feature)
// Batch 3 — escalation + follow-up: Ward 7 situation worsening, new
//            individual complaints in other wards
//
// The Clustering agent (candidate task) should detect the Ward 7 water main
// cluster in Batches 2 and 3 and collapse those complaints into one Case.
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_1 = [
  {
    ward: 'Ward 7',
    type: 'pothole',
    severity: 'medium',
    description: 'Large pothole on Oak Street near the bus stop. Has blown out two tyres this month.',
    location: 'Oak Street near Bus Stop 14, Ward 7',
  },
  {
    ward: 'Ward 7',
    type: 'pothole',
    severity: 'low',
    description: 'Small pothole forming on Maple Avenue close to the primary school entrance.',
    location: 'Maple Avenue, Ward 7',
  },
  {
    ward: 'Ward 3',
    type: 'street_lighting',
    severity: 'medium',
    description: 'Street light on River Road has been out for two weeks. Section of road completely dark at night.',
    location: 'River Road, Ward 3',
  },
  {
    ward: 'Ward 12',
    type: 'water_leak',
    severity: 'high',
    description: 'Water bubbling up through pavement near East Market Street. Appears to be a subsurface pipe issue.',
    location: 'East Market Street, Ward 12',
  },
  {
    ward: 'Ward 5',
    type: 'sanitation',
    severity: 'low',
    description: 'Bins on Central Park Avenue overflowing — not collected in 10 days. Attracting birds and foxes.',
    location: 'Central Park Avenue, Ward 5',
  },
  {
    ward: 'Ward 5',
    type: 'sanitation',
    severity: 'low',
    description: 'Missed garbage collection on West 5th Street for the second consecutive week.',
    location: 'West 5th Street, Ward 5',
  },
];

const BATCH_2 = [
  // ── Ward 7 water main cluster (5 complaints, same root cause) ───────────────
  {
    ward: 'Ward 7',
    type: 'water_leak',
    severity: 'high',
    description: 'Water gushing up from the ground at the corner of Pine Street and 3rd Avenue. Getting worse.',
    location: 'Pine Street & 3rd Avenue, Ward 7',
  },
  {
    ward: 'Ward 7',
    type: 'water_leak',
    severity: 'critical',
    description: 'Street flooding on 3rd Avenue. Water coming from underground, road surface collapsing.',
    location: '3rd Avenue near Pine Street, Ward 7',
  },
  {
    ward: 'Ward 7',
    type: 'water_leak',
    severity: 'high',
    description: 'Large puddle forming at Pine Street junction. Residents reporting very low water pressure in buildings.',
    location: 'Pine Street junction, Ward 7',
  },
  {
    ward: 'Ward 7',
    type: 'flooding',
    severity: 'critical',
    description: 'Basement flooding at 42 Pine Street. Water coming through floor drain, entire ground floor affected.',
    location: '42 Pine Street, Ward 7',
  },
  {
    ward: 'Ward 7',
    type: 'water_leak',
    severity: 'high',
    description: 'Pine Street road surface is sinking near the junction. Smells of sewage. Multiple households without water.',
    location: 'Pine Street, Ward 7',
  },
  {
    ward: 'Ward 3',
    type: 'pothole',
    severity: 'high',
    description: 'Deep crater on Bridge Road — utility truck nearly got stuck. Dangerous for heavy vehicles.',
    location: 'Bridge Road, Ward 3',
  },
  {
    ward: 'Ward 3',
    type: 'street_lighting',
    severity: 'medium',
    description: 'Three consecutive street lights out on Bridge Road. 100m stretch completely dark at night.',
    location: 'Bridge Road (southern end), Ward 3',
  },
  {
    ward: 'Ward 12',
    type: 'sanitation',
    severity: 'medium',
    description: 'Illegal dumping of construction waste in the empty lot on Commerce Street.',
    location: 'Commerce Street vacant lot, Ward 12',
  },
];

const BATCH_3 = [
  // ── Ward 7 escalation (same root cause, now critical) ───────────────────────
  {
    ward: 'Ward 7',
    type: 'water_leak',
    severity: 'critical',
    description: 'URGENT: No water pressure in entire Ward 7 residential block. Multiple buildings affected. Please send emergency crew.',
    location: 'Ward 7 residential zone, Pine Street area',
  },
  {
    ward: 'Ward 7',
    type: 'flooding',
    severity: 'critical',
    description: 'Pine Street impassable — water level 30cm deep. Road closure required. Vehicles stranded.',
    location: 'Pine Street, Ward 7',
  },
  // ── Other individual complaints ──────────────────────────────────────────────
  {
    ward: 'Ward 3',
    type: 'pothole',
    severity: 'high',
    description: 'Bridge Road crater now 60cm wide. Two cars have hit it today. Needs urgent repair.',
    location: 'Bridge Road, Ward 3',
  },
  {
    ward: 'Ward 5',
    type: 'sanitation',
    severity: 'medium',
    description: 'Rats spotted near overflowing bins on Central Park Avenue. Health hazard — residents have children.',
    location: 'Central Park Avenue, Ward 5',
  },
  {
    ward: 'Ward 2',
    type: 'street_lighting',
    severity: 'low',
    description: 'Flickering street light on Harbor Drive keeps residents awake. Has been reported before.',
    location: 'Harbor Drive, Ward 2',
  },
  {
    ward: 'Ward 11',
    type: 'pothole',
    severity: 'medium',
    description: 'Series of potholes on Industrial Road. Lorry drivers reporting suspension damage.',
    location: 'Industrial Road, Ward 11',
  },
];

/**
 * Returns the mock complaint array for a given batch number (1–3).
 * Caps at 3; beyond that returns Batch 3 again.
 *
 * @param {number} batchNumber
 * @returns {object[]}
 */
function getMockComplaints(batchNumber) {
  const batches = { 1: BATCH_1, 2: BATCH_2, 3: BATCH_3 };
  return batches[Math.min(batchNumber, 3)] ?? BATCH_3;
}

module.exports = { getMockComplaints, BATCH_1, BATCH_2, BATCH_3 };
