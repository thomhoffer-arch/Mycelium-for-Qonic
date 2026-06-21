#!/usr/bin/env node
// Interactive setup wizard — writes .env and runs a smoke test.
import { createInterface } from 'node:readline/promises';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => rl.question(q);

console.log('=== Mycelium-for-Qonic setup wizard ===\n');

// ── existing .env? ────────────────────────────────────────────────────────────
if (existsSync('.env')) {
  const answer = await ask('.env already exists. Overwrite? [y/N] ');
  if (answer.trim().toLowerCase() !== 'y') {
    console.log('\nKeeping existing .env. Run connector with: node connector.mjs');
    rl.close();
    process.exit(0);
  }
  console.log('');
}

// ── pick mode ────────────────────────────────────────────────────────────────
console.log('How do you want to connect to Qonic?\n');
console.log('  1) Phase 0 — IFC export file  (no API key needed; works today)');
console.log('  2) Phase 1 — Qonic REST API   (OAuth 2.1 Bearer token)');
console.log('');
const mode = (await ask('Mode [1/2]: ')).trim();

const lines = [];

if (mode === '1') {
  // ── Phase 0 ────────────────────────────────────────────────────────────────
  const ifcPath = (await ask('Path to your IFC export file: ')).trim();
  if (!ifcPath) { console.error('✗ Path required.'); rl.close(); process.exit(1); }
  lines.push(`QONIC_IFC=${ifcPath}`);
} else if (mode === '2') {
  // ── Phase 1 ────────────────────────────────────────────────────────────────
  console.log('\nGet a token at https://developer.qonic.com');
  console.log('Scopes needed: projects:read, models:read\n');
  const token = (await ask('QONIC_TOKEN (Bearer): ')).trim();
  if (!token) { console.error('✗ Token required.'); rl.close(); process.exit(1); }
  const project = (await ask('QONIC_PROJECT_ID: ')).trim();
  if (!project) { console.error('✗ Project ID required.'); rl.close(); process.exit(1); }
  const apiUrl = (await ask('QONIC_API_URL [https://api.qonic.com/v1]: ')).trim();
  lines.push(`QONIC_TOKEN=${token}`);
  lines.push(`QONIC_PROJECT_ID=${project}`);
  if (apiUrl) lines.push(`QONIC_API_URL=${apiUrl}`);

  // optional Phase 2 write-back
  const writeBack = (await ask('\nEnable Phase 2 write-back? [y/N]: ')).trim().toLowerCase();
  if (writeBack === 'y') lines.push('QONIC_APPLY=1');
} else {
  console.error('✗ Invalid choice. Run setup.mjs again and enter 1 or 2.');
  rl.close();
  process.exit(1);
}

rl.close();

// ── write .env ───────────────────────────────────────────────────────────────
writeFileSync('.env', lines.join('\n') + '\n');
console.log('\n✓ Wrote .env');
console.log('  ' + lines.map((l) => l.replace(/=.+/, '=***')).join('\n  '));

// ── smoke test ────────────────────────────────────────────────────────────────
console.log('\n→ Running smoke test (node connector.mjs)...\n');
try {
  execSync('node connector.mjs', { stdio: 'inherit' });
  console.log('\n✓ Connector exited cleanly.');
} catch {
  console.log('\n⚠  Connector exited with errors — check the output above and your .env.');
  console.log('   Edit .env, then re-run: node connector.mjs');
}
