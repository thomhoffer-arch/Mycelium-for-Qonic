#!/usr/bin/env node
// mycelium-for-qonic — Qonic model element → spine records.
// Qonic carries IFC GlobalIds natively, so ifcGuid is the primary join key.
import { runAdapter } from 'mycelium-sdk';

const config = {
  source: 'qonic',
  identity: {
    uniqueId: 'qonic:{elementId}',
    projectKey: '{project}',
    localIdField: 'elementId',
  },
  freshness: {
    revisionId: '{revision}',
    asOf: '{modified}',
    confidence: 'snapshot',
  },
};

async function fetchSource() {
  // Replace with a real Qonic API call.
  return [
    {
      elementId: 'QNC-0007',
      project: 'horizons',
      ifcGuid: '2gggggkxlCpDtTxkxkxkxl',
      classification: [{ system: 'NL-SfB', code: '23.22' }],
      revision: 'r/12',
      modified: '2026-06-17T09:00:00Z',
    },
  ];
}

const result = await runAdapter(config, { fetchSource });
console.log(JSON.stringify(result, null, 2));
process.exit(result.conformant ? 0 : 1);
