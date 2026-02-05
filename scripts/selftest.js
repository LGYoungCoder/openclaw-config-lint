#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const manifestPath = path.join(root, 'scripts', 'selftest-manifest.json');
const cliPath = path.join(root, 'bin', 'openclaw-configgen.js');

function fail(msg) {
  process.stderr.write(`SELFTEST FAIL: ${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) fail(`missing manifest: ${manifestPath}`);
if (!fs.existsSync(cliPath)) fail(`missing cli: ${cliPath}`);

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  fail(`failed to parse manifest: ${e?.message || e}`);
}

const cases = manifest?.cases;
if (!Array.isArray(cases) || cases.length === 0) fail('manifest.cases must be a non-empty array');

const ruleFilters = manifest?.ruleFilters || [];
if (!Array.isArray(ruleFilters)) fail('manifest.ruleFilters must be an array');

let passed = 0;
let total = 0;

function assertExpectedIds(context, idsSet, expectIds) {
  const missing = expectIds.filter(x => !idsSet.has(x));
  if (missing.length) fail(`${context}: missing expected ids: ${missing.join(', ')}`);
}

for (const c of cases) {
  total++;
  const relFile = c?.file;
  const expectIds = c?.expectIds;
  const forbidIds = c?.forbidIds || [];
  if (typeof relFile !== 'string' || relFile.trim() === '') fail('case.file must be a string');
  if (!Array.isArray(expectIds) || expectIds.length === 0) fail(`case.expectIds must be non-empty for ${relFile}`);
  if (!Array.isArray(forbidIds)) fail(`case.forbidIds must be an array for ${relFile}`);

  const absFile = path.join(root, relFile);
  if (!fs.existsSync(absFile)) fail(`missing example file: ${absFile}`);

  const res = spawnSync('node', [cliPath, 'lint', absFile, '--format', 'json'], {
    cwd: root,
    encoding: 'utf8'
  });

  if (!res.stdout) {
    process.stderr.write(res.stderr || '');
    fail(`no JSON output for ${relFile}`);
  }

  let out;
  try {
    out = JSON.parse(res.stdout);
  } catch (e) {
    process.stderr.write(res.stdout.slice(0, 500) + '\n');
    fail(`invalid JSON output for ${relFile}: ${e?.message || e}`);
  }

  const ids = new Set((out.findings || []).map(f => f.id));
  assertExpectedIds(relFile, ids, expectIds);
  const forbiddenFound = forbidIds.filter(x => ids.has(x));
  if (forbiddenFound.length) {
    fail(`${relFile}: found forbidden ids: ${forbiddenFound.join(', ')}`);
  }
  passed++;
}

for (const rf of ruleFilters) {
  total++;
  const category = rf?.category;
  const expectIds = rf?.expectIds;
  if (typeof category !== 'string' || category.trim() === '') fail('ruleFilters.category must be a string');
  if (!Array.isArray(expectIds) || expectIds.length === 0) fail(`ruleFilters.expectIds must be non-empty for category=${category}`);

  const res = spawnSync('node', [cliPath, 'rules', '--category', category], {
    cwd: root,
    encoding: 'utf8'
  });

  if (!res.stdout) {
    process.stderr.write(res.stderr || '');
    fail(`no output for rules --category ${category}`);
  }

  const ids = new Set(
    res.stdout
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.split(/\s+/)[0])
  );

  assertExpectedIds(`rules --category ${category}`, ids, expectIds);
  passed++;
}

process.stdout.write(`SELFTEST OK: ${passed}/${total} checks passed\n`);
