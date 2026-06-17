// SPDX-License-Identifier: Apache-2.0
// Spine adapter helpers — shared across all Mycelium connectors.

export const SPINE_VERSION = '0.1';

/**
 * stamp() attaches freshness metadata to a spine record.
 * @param {{ source: string, revisionId?: string|null, asOf?: string|null, confidence?: string }} opts
 */
export function stamp({ source, revisionId = null, asOf = null, confidence = 'snapshot' }) {
  return {
    source,
    revisionId,
    asOf,
    confidence,
    stampedAt: new Date().toISOString(),
  };
}
