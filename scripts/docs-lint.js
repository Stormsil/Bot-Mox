#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docsRoot = path.join(root, 'docs');

const requiredCanonicalDocs = [
  'docs/architecture/ARCHITECTURE_CANONICAL.md',
  'docs/workflow/DEV_WORKFLOW_CANONICAL.md',
  'docs/workflow/START_HERE_FOR_DEVS_AND_AGENTS.md',
  'docs/frontend/FRONTEND_ARCHITECTURE_CANONICAL.md',
  'docs/backend/BACKEND_ARCHITECTURE_CANONICAL.md',
  'docs/agent/AGENT_ARCHITECTURE_CANONICAL.md',
  'docs/standards/CODE_QUALITY_CONSTITUTION.md',
  'docs/standards/AI_AGENT_DEVELOPMENT_RULES.md',
  'docs/standards/ENGINEERING_CONSTITUTION.md',
  'docs/standards/ARCHITECTURE_DECISION_RECORDS.md',
  'docs/standards/PR_REVIEW_CONTRACT.md',
  'docs/standards/OWNERSHIP_MAP.md',
  'docs/standards/AI_IMPLEMENTATION_PLAYBOOK.md',
  'docs/README.md',
];

const requiredMetaFields = ['Status:', 'Owner:', 'Last Updated:'];

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

for (const file of requiredCanonicalDocs) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) {
    fail(`Missing canonical documentation file: ${file}`);
  }

  const source = fs.readFileSync(abs, 'utf8');
  for (const field of requiredMetaFields) {
    if (!source.includes(field)) {
      fail(`Missing required metadata field "${field}" in ${file}`);
    }
  }

  if (/\bnpm run\b/.test(source)) {
    fail(`Found forbidden npm command in canonical docs: ${file}`);
  }
}

if (!fs.existsSync(docsRoot)) {
  fail('docs directory does not exist');
}

process.stdout.write('Docs lint passed: canonical files and metadata are valid.\n');
