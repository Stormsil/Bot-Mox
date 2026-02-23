#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const prismaSchemaPath = path.join(repoRoot, 'apps', 'backend', 'prisma', 'schema.prisma');
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
const dynamicRlsMigrationPath = path.join(migrationsDir, '20260221000300_enable_tenant_rls.sql');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function listSqlMigrations() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => path.join(migrationsDir, entry.name));
}

function extractTenantScopedTablesFromPrisma(schemaText) {
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  const tables = [];
  let match = modelRegex.exec(schemaText);
  while (match) {
    const modelName = String(match[1] || '');
    const body = String(match[2] || '');
    const hasTenantIdField = /\btenantId\b/.test(body);
    if (!hasTenantIdField) {
      match = modelRegex.exec(schemaText);
      continue;
    }

    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const tableName = mapMatch ? String(mapMatch[1] || '').trim() : modelName;
    if (tableName) {
      tables.push(tableName);
    }
    match = modelRegex.exec(schemaText);
  }

  return Array.from(new Set(tables)).sort();
}

function extractDynamicRlsTables(migrationText) {
  const arrayMatch = migrationText.match(/tenant_tables\s+text\[\]\s*:=\s*ARRAY\[(.*?)\];/s);
  if (!arrayMatch) {
    return [];
  }
  const block = String(arrayMatch[1] || '');
  const itemRegex = /'([^']+)'/g;
  const items = [];
  let m = itemRegex.exec(block);
  while (m) {
    const name = String(m[1] || '').trim();
    if (name) {
      items.push(name);
    }
    m = itemRegex.exec(block);
  }
  return Array.from(new Set(items)).sort();
}

function hasExplicitRlsPolicy(sqlText, tableName) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const enableRegex = new RegExp(
    `ALTER\\s+TABLE\\s+public\\.${escaped}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
    'i',
  );
  const policyRegex = new RegExp(`CREATE\\s+POLICY[\\s\\S]*?ON\\s+public\\.${escaped}\\b`, 'i');
  return enableRegex.test(sqlText) && policyRegex.test(sqlText);
}

function main() {
  if (!fs.existsSync(prismaSchemaPath)) {
    throw new Error(
      `Prisma schema not found: ${toPosix(path.relative(repoRoot, prismaSchemaPath))}`,
    );
  }
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations dir not found: ${toPosix(path.relative(repoRoot, migrationsDir))}`);
  }

  const schemaText = readText(prismaSchemaPath);
  const expectedTables = extractTenantScopedTablesFromPrisma(schemaText);
  const migrationFiles = listSqlMigrations();
  const combinedSql = migrationFiles.map((file) => readText(file)).join('\n\n');

  const dynamicTables = fs.existsSync(dynamicRlsMigrationPath)
    ? extractDynamicRlsTables(readText(dynamicRlsMigrationPath))
    : [];
  const dynamicSet = new Set(dynamicTables);

  const missing = [];
  for (const tableName of expectedTables) {
    const explicit = hasExplicitRlsPolicy(combinedSql, tableName);
    const dynamic = dynamicSet.has(tableName);
    if (!explicit && !dynamic) {
      missing.push(tableName);
    }
  }

  if (missing.length > 0) {
    process.stderr.write(
      'RLS coverage check failed. Missing tenant RLS policy coverage for tables:\n',
    );
    for (const tableName of missing) {
      process.stderr.write(`- ${tableName}\n`);
    }
    process.stderr.write(
      'Add explicit RLS migration or include table in 20260221000300_enable_tenant_rls.sql tenant_tables.\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `RLS coverage check passed (${expectedTables.length} tenant-scoped tables validated).\n`,
  );
}

main();
