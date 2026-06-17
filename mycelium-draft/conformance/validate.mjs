// SPDX-License-Identifier: Apache-2.0
// Conformance checker — validates spine records against the connective-spine MUST-keys contract.

const MUST_KEYS = ['source', 'sourceLocalId', 'projectKey'];

/**
 * checkConformance() verifies a spine record carries all required identity fields.
 * Returns { conformant: boolean, conformanceErrors?: string[] }.
 */
export function checkConformance(record) {
  const id = record?.identity ?? {};
  const missing = MUST_KEYS.filter((k) => !id[k]);
  if (missing.length === 0) return { conformant: true };
  return {
    conformant: false,
    conformanceErrors: missing.map((k) => `missing identity.${k}`),
  };
}
