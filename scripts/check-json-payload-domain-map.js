#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const MAP_PATH = 'configs/json-payload-domain-map.json';
const DEFAULT_SCHEMA_PATH = 'apps/backend/prisma/schema.prisma';
const DEFAULT_REPO_DIR = 'apps/backend/src/modules';
const REPOSITORY_FILE_SUFFIX = '.repository.ts';

function readFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`missing file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readFile(relativePath));
}

function listRepositoryFiles(rootRelativeDir) {
  const rootAbsoluteDir = path.join(repoRoot, rootRelativeDir);
  if (!fs.existsSync(rootAbsoluteDir)) {
    throw new Error(`missing directory: ${rootRelativeDir}`);
  }

  const files = [];
  const stack = [rootAbsoluteDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(REPOSITORY_FILE_SUFFIX)) {
        continue;
      }
      files.push(path.relative(repoRoot, absolutePath).replace(/\\/g, '/'));
    }
  }

  files.sort();
  return files;
}

function lowerFirst(value) {
  return value ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}

function parseSchemaPayloadModels(schemaSource) {
  const models = [];
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let match = modelRegex.exec(schemaSource);

  while (match) {
    const model = match[1];
    const body = match[2];
    if (/\bpayload\s+Json\b/.test(body)) {
      const tableMatch = body.match(/@@map\("([^"]+)"\)/);
      models.push({
        model,
        table: tableMatch ? tableMatch[1] : null,
        delegate: lowerFirst(model),
      });
    }
    match = modelRegex.exec(schemaSource);
  }

  models.sort((a, b) => a.model.localeCompare(b.model));
  return models;
}

function gatherRepositoryUsage(payloadModels, repositoryFiles) {
  const usage = new Map();
  for (const payloadModel of payloadModels) {
    usage.set(payloadModel.model, []);
  }

  for (const repositoryPath of repositoryFiles) {
    const source = readFile(repositoryPath);
    for (const payloadModel of payloadModels) {
      const pattern = new RegExp(`\\b${payloadModel.delegate}\\b`);
      if (pattern.test(source)) {
        usage.get(payloadModel.model).push(repositoryPath);
      }
    }
  }

  for (const [, files] of usage.entries()) {
    files.sort();
  }

  return usage;
}

function normalizeModelSet(items) {
  const set = new Set();
  for (const item of items) {
    const model = String(item?.model || '').trim();
    if (!model) {
      throw new Error('mapping entries require non-empty "model"');
    }
    if (set.has(model)) {
      throw new Error(`duplicate model in mapping: ${model}`);
    }
    set.add(model);
  }
  return set;
}

function assertStringArray(values, fieldName, model, issues) {
  if (!Array.isArray(values)) {
    issues.push(`${model}: ${fieldName} must be an array`);
    return;
  }
  for (const value of values) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      issues.push(`${model}: ${fieldName} must contain non-empty strings`);
      break;
    }
  }
}

function main() {
  const mapping = readJson(MAP_PATH);
  const schemaPath =
    String(mapping.schemaPath || DEFAULT_SCHEMA_PATH).trim() || DEFAULT_SCHEMA_PATH;
  const schemaSource = readFile(schemaPath);
  const repositoryFiles = listRepositoryFiles(DEFAULT_REPO_DIR);
  const schemaPayloadModels = parseSchemaPayloadModels(schemaSource);
  const schemaModelSet = new Set(schemaPayloadModels.map((item) => item.model));
  const usageByModel = gatherRepositoryUsage(schemaPayloadModels, repositoryFiles);

  const mappingEntries = Array.isArray(mapping.modelMappings) ? mapping.modelMappings : [];
  const excludedEntries = Array.isArray(mapping.excludedPayloadModels)
    ? mapping.excludedPayloadModels
    : [];

  const mappedSet = normalizeModelSet(mappingEntries);
  const excludedSet = normalizeModelSet(excludedEntries);

  const issues = [];

  for (const excluded of excludedEntries) {
    const model = excluded.model;
    if (!schemaModelSet.has(model)) {
      issues.push(`excluded model not found in schema payload models: ${model}`);
    }
    if (typeof excluded.reason !== 'string' || excluded.reason.trim().length === 0) {
      issues.push(`excluded model requires non-empty reason: ${model}`);
    }
  }

  for (const entry of mappingEntries) {
    const model = entry.model;
    if (!schemaModelSet.has(model)) {
      issues.push(`mapped model is not a schema payload model: ${model}`);
    }
    assertStringArray(entry.repositoryPaths, 'repositoryPaths', model, issues);
    assertStringArray(entry.retainedEncryptedFields, 'retainedEncryptedFields', model, issues);

    if (typeof entry.domain !== 'string' || entry.domain.trim().length === 0) {
      issues.push(`${model}: domain must be a non-empty string`);
    }
    if (
      typeof entry.typedReplacementTarget !== 'string' ||
      entry.typedReplacementTarget.trim().length === 0
    ) {
      issues.push(`${model}: typedReplacementTarget must be a non-empty string`);
    }

    for (const repositoryPath of entry.repositoryPaths || []) {
      const absoluteRepositoryPath = path.join(repoRoot, repositoryPath);
      if (!fs.existsSync(absoluteRepositoryPath)) {
        issues.push(`${model}: repository path does not exist: ${repositoryPath}`);
      }
    }

    const expectedTable = schemaPayloadModels.find((item) => item.model === model)?.table ?? null;
    if (entry.table !== expectedTable) {
      issues.push(
        `${model}: table mismatch (mapping=${String(entry.table)} schema=${String(expectedTable)})`,
      );
    }

    const repositoryUsage = usageByModel.get(model) || [];
    if (repositoryUsage.length > 0) {
      const declaredPaths = new Set(entry.repositoryPaths || []);
      const uncoveredUsage = repositoryUsage.filter((filePath) => !declaredPaths.has(filePath));
      if (uncoveredUsage.length > 0) {
        issues.push(`${model}: repository usage missing in mapping: ${uncoveredUsage.join(', ')}`);
      }
    }
  }

  for (const schemaPayloadModel of schemaPayloadModels) {
    const model = schemaPayloadModel.model;
    if (excludedSet.has(model)) {
      continue;
    }
    if (!mappedSet.has(model)) {
      issues.push(`unmapped schema payload model: ${model}`);
    }
  }

  for (const [model, usagePaths] of usageByModel.entries()) {
    if (usagePaths.length === 0) {
      continue;
    }
    if (!mappedSet.has(model) && !excludedSet.has(model)) {
      issues.push(`repository references unmapped payload model: ${model}`);
    }
  }

  if (issues.length > 0) {
    process.stderr.write('[check-json-payload-domain-map] FAIL\n');
    for (const issue of issues) {
      process.stderr.write(`- ${issue}\n`);
    }
    process.exit(1);
  }

  const totalSchemaPayloadModels = schemaPayloadModels.length;
  const totalExcluded = excludedEntries.length;
  const totalMapped = mappingEntries.length;

  process.stdout.write(
    `[check-json-payload-domain-map] OK: schema payload models=${totalSchemaPayloadModels}, mapped=${totalMapped}, excluded=${totalExcluded}, repositories_scanned=${repositoryFiles.length}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `[check-json-payload-domain-map] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
