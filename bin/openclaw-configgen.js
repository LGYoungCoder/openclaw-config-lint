#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const VERSION = '0.0.0';

function usage(exitCode = 0) {
  const msg = `openclaw-configgen v${VERSION}

Usage:
  openclaw-configgen lint <config.json> [--format json]
  openclaw-configgen rules [--category <compat|core|cron|security>]
  openclaw-configgen explain

Notes:
  - This is a WIP placeholder CLI.
  - Today it only prints rules and does very light checks.
`;
  process.stdout.write(msg);
  process.exit(exitCode);
}

function loadRules() {
  const rulesPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'rules.json'
  );
  if (!fs.existsSync(rulesPath)) {
    process.stderr.write(`ERROR: missing rules.json: ${rulesPath}\n`);
    process.exit(2);
  }
  try {
    return JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  } catch (e) {
    process.stderr.write(`ERROR: failed to parse rules.json: ${rulesPath}\n${e?.message || e}\n`);
    process.exit(2);
  }
}

function ruleFixById(id) {
  const r = loadRules().find(x => x.id === id);
  return r?.fix || null;
}

function printRules(opts = {}) {
  const rules = loadRules();
  const filtered = opts.category ? rules.filter(r => r.category === opts.category) : rules;
  for (const r of filtered) {
    process.stdout.write(`${r.id}\t${r.severity}\t${r.category || 'uncategorized'}\t${r.name}\n`);
  }
}

function printExplain() {
  // For now: source of truth is the human-readable doc.
  // Later: generate both lint-rules.md and runtime rule metadata from one JSON source.
  const mdPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'lint-rules.md'
  );
  if (!fs.existsSync(mdPath)) {
    process.stderr.write(`ERROR: missing lint rules doc: ${mdPath}\n`);
    process.exit(2);
  }
  process.stdout.write(fs.readFileSync(mdPath, 'utf8'));
}

function walk(obj, visit, currentPath = []) {
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => walk(v, visit, currentPath.concat(String(i))));
    } else {
      for (const [k, v] of Object.entries(obj)) {
        const nextPath = currentPath.concat(k);
        visit(nextPath, v);
        walk(v, visit, nextPath);
      }
    }
  }
}

function normalizeCronJobs(cfg, findings) {
  // Support a few common shapes:
  // - { cron: { jobs: <object|array> } }
  // - { cronJobs: <object|array> }
  // - { jobs: <object|array> } (fallback; ambiguous)
  let jobs = cfg?.cron?.jobs;
  let sourcePath = 'cron.jobs';

  if (!jobs && cfg?.cronJobs) {
    jobs = cfg.cronJobs;
    sourcePath = 'cronJobs';
    findings.push({
      id: 'OC_CFG_012',
      severity: 'warn',
      message: 'Found cronJobs at top-level. For compatibility, prefer cron.jobs, but lint will try to read cronJobs.'
    });
  }

  if (!jobs && cfg?.jobs) {
    jobs = cfg.jobs;
    sourcePath = 'jobs';
    findings.push({
      id: 'OC_CFG_016',
      severity: 'warn',
      message: 'Found jobs at top-level. Lint will try to interpret it as cron jobs, but the structure may be ambiguous.'
    });
  }

  if (!jobs) return [];

  // Return: [{ jobId, job, path }]
  if (Array.isArray(jobs)) {
    return jobs.map((job, i) => {
      const jobId = job?.id || job?.jobId || job?.name || `index_${i}`;
      return { jobId, job, path: `${sourcePath}[${i}]` };
    });
  }

  if (typeof jobs === 'object') {
    return Object.entries(jobs).map(([jobId, job]) => ({ jobId, job, path: `${sourcePath}.${jobId}` }));
  }

  findings.push({
    id: 'OC_CFG_002',
    severity: 'error',
    message: `cron.jobs has unsupported type (${typeof jobs}); expected object or array`
  });
  return [];
}

function lintConfig(filePath, opts = {}) {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`ERROR: file not found: ${abs}\n`);
    process.exit(2);
  }

  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    process.stderr.write(`ERROR: failed to parse JSON: ${abs}\n${e?.message || e}\n`);
    process.exit(2);
  }

  const findings = [];

  // Friendly hint when the file doesn't look like an OpenClaw config
  // (We still run whatever checks we can.)
  const hasCronish = !!(cfg?.cron?.jobs || cfg?.cronJobs || cfg?.jobs);
  const hasCore = !!(cfg?.gateway || cfg?.heartbeat || cfg?.channels || cfg?.plugins);
  const looksLikeOpenClaw = (cfg && typeof cfg === 'object') && (cfg.cron || hasCore || hasCronish);

  // Minimal core section checks (suppress when this is clearly a cron-only snippet)
  const isCronOnlySnippet = hasCronish && !hasCore;

  // Channel/security checks (deterministic rules; CI-friendly)
  const feishu = cfg?.channels?.feishu;
  if (feishu && feishu.groupPolicy === 'open') {
    findings.push({
      id: 'OC_CFG_017',
      severity: 'warn',
      message: 'channels.feishu.groupPolicy="open" allows any group member to trigger the bot (mention-gated). Consider restricting to allowlist.'
    });
  }

  // Plugins: duplicate plugin ids in config (CI-friendly)
  // Accept shapes:
  // - plugins.entries: [{id, ...}, ...]
  // - plugins.entries: { <id>: {...}, ... } (rare)
  const entries = cfg?.plugins?.entries;
  if (Array.isArray(entries)) {
    const seen = new Map();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const id = e?.id;
      if (typeof id !== 'string' || id.trim() === '') continue;
      if (seen.has(id)) {
        findings.push({
          id: 'OC_CFG_018',
          severity: 'warn',
          message: `plugins.entries has duplicate id "${id}" at indices ${seen.get(id)} and ${i}`
        });
      } else {
        seen.set(id, i);
      }
    }
  } else if (entries && typeof entries === 'object') {
    // Object keys are already unique; but if any entry also declares a conflicting .id,
    // surface it as a hint.
    for (const [k, v] of Object.entries(entries)) {
      const id = v?.id;
      if (typeof id === 'string' && id.trim() !== '' && id !== k) {
        findings.push({
          id: 'OC_CFG_018',
          severity: 'warn',
          message: `plugins.entries key "${k}" has nested id "${id}"; consider aligning to avoid confusion`
        });
      }
    }
  }

  if (looksLikeOpenClaw && !isCronOnlySnippet && !cfg?.gateway) {
    findings.push({
      id: 'OC_CFG_013',
      severity: 'warn',
      message: 'Missing gateway section. (If this is a partial config, ignore; otherwise OpenClaw likely needs gateway configured.)'
    });
  }

  if (looksLikeOpenClaw && !isCronOnlySnippet && !cfg?.heartbeat) {
    findings.push({
      id: 'OC_CFG_014',
      severity: 'warn',
      message: 'Missing heartbeat section. (If you rely on periodic checks, configure heartbeat. If you only use cron jobs, you may ignore.)'
    });
  }

  if (!looksLikeOpenClaw) {
    findings.push({
      id: 'OC_CFG_002',
      severity: 'warn',
      message: 'Input does not look like an OpenClaw config (expected keys like cron/gateway/heartbeat/channels/plugins). If you passed a random JSON, results may be meaningless.'
    });
  } else if (hasCronish && !hasCore) {
    findings.push({
      id: 'OC_CFG_011',
      severity: 'warn',
      message: 'This file contains cron jobs but is missing core sections (gateway/heartbeat/channels/plugins). If this is intended as a partial config, merge it into a full OpenClaw config before running.'
    });
  }

  // OC_CFG_008: very naive secret/token detection by key name.
  const suspectKeys = new Set(['token', 'key', 'secret', 'password', 'apiKey', 'accessToken', 'refreshToken']);
  walk(cfg, (p, v) => {
    const last = p[p.length - 1];
    if (suspectKeys.has(last) && typeof v === 'string' && v.trim().length > 0) {
      findings.push({
        id: 'OC_CFG_008',
        severity: 'error',
        message: `Possible plaintext secret at ${p.join('.')}`
      });
    }
  });

  // OC_CFG_004: cron job sessionTarget vs payload.kind mismatch
  // Expectation (from OpenClaw cron tool constraints):
  // - sessionTarget="main" requires payload.kind="systemEvent"
  // - sessionTarget="isolated" requires payload.kind="agentTurn"
  const jobEntries = normalizeCronJobs(cfg, findings);

  // OC_CFG_004: cron job sessionTarget vs payload.kind mismatch
  for (const { jobId, job, path } of jobEntries) {
    const st = job?.sessionTarget;
    const pk = job?.payload?.kind;
    if (st === 'main' && pk && pk !== 'systemEvent') {
      findings.push({
        id: 'OC_CFG_004',
        severity: 'error',
        message: `${path}: sessionTarget=main but payload.kind=${pk} (expected systemEvent)`
      });
    }
    if (st === 'isolated' && pk && pk !== 'agentTurn') {
      findings.push({
        id: 'OC_CFG_004',
        severity: 'error',
        message: `${path}: sessionTarget=isolated but payload.kind=${pk} (expected agentTurn)`
      });
    }
  }

  // OC_CFG_006: duplicate job names within cron.jobs
  {
    const seen = new Map(); // name -> jobId
    for (const { jobId, job } of jobEntries) {
      const name = job?.name;
      if (typeof name !== 'string' || name.trim() === '') continue;
      if (seen.has(name)) {
        findings.push({
          id: 'OC_CFG_006',
          severity: 'error',
          message: `Duplicate cron job name "${name}" in ${seen.get(name)} and ${jobId}`
        });
      } else {
        seen.set(name, jobId);
      }
    }
  }

  // OC_CFG_003: invalid schedule.everyMs range (basic sanity)
  for (const { path, job } of jobEntries) {
    const sch = job?.schedule;
    if (sch?.kind === 'every') {
      const everyMs = sch?.everyMs;
      if (!Number.isInteger(everyMs) || everyMs <= 0) {
        findings.push({
          id: 'OC_CFG_003',
          severity: 'error',
          message: `${path}: schedule.everyMs must be a positive integer`
        });
      } else {
        const min = 60_000; // 1 min
        const max = 30 * 24 * 60 * 60_000; // 30 days
        if (everyMs < min) {
          findings.push({
            id: 'OC_CFG_003',
            severity: 'warn',
            message: `${path}: schedule.everyMs=${everyMs}ms is very small (<1m); check cost/intent`
          });
        }
        if (everyMs > max) {
          findings.push({
            id: 'OC_CFG_003',
            severity: 'warn',
            message: `${path}: schedule.everyMs=${everyMs}ms is very large (>30d); check intent`
          });
        }
      }
    }
  }

  // OC_CFG_015: cron schedule missing/invalid expr
  const cronExprInvalidPaths = new Set();
  for (const { path, job } of jobEntries) {
    const sch = job?.schedule;
    if (sch?.kind === 'cron') {
      const expr = sch?.expr;
      if (typeof expr !== 'string' || expr.trim() === '') {
        cronExprInvalidPaths.add(path);
        findings.push({
          id: 'OC_CFG_015',
          severity: 'error',
          message: `${path}: schedule.kind=cron but schedule.expr is missing/invalid`
        });
      }
    }
  }

  // OC_CFG_005: cron schedule missing tz
  // Noise reduction: if expr itself is invalid (OC_CFG_015), skip tz warning for that job.
  for (const { path, job } of jobEntries) {
    if (cronExprInvalidPaths.has(path)) continue;
    const sch = job?.schedule;
    if (sch?.kind === 'cron') {
      const tz = sch?.tz;
      if (tz == null || (typeof tz === 'string' && tz.trim() === '')) {
        findings.push({
          id: 'OC_CFG_005',
          severity: 'warn',
          message: `${path}: schedule.kind=cron without tz; consider setting tz to avoid drift`
        });
      }
    }
  }

  if (opts.format === 'json') {
    const enriched = findings.map(f => ({
      ...f,
      fix: ruleFixById(f.id)
    }));
    const out = {
      file: abs,
      findings: enriched,
      ok: enriched.length === 0,
      hasError: enriched.some(f => f.severity === 'error')
    };
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    process.exit(out.hasError ? 1 : 0);
  }

  if (findings.length === 0) {
    process.stdout.write('OK: no findings (WIP linter; not comprehensive).\n');
    return;
  }

  for (const f of findings) {
    process.stdout.write(`${f.severity.toUpperCase()} ${f.id}: ${f.message}\n`);
    const fix = ruleFixById(f.id);
    if (fix) process.stdout.write(`  Fix: ${fix}\n`);
  }
  process.exit(findings.some(f => f.severity === 'error') ? 1 : 0);
}

const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') usage(0);
if (argv[0] === '-v' || argv[0] === '--version') {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

const cmd = argv[0];
if (cmd === 'rules') {
  const catIdx = argv.indexOf('--category');
  const category = catIdx !== -1 ? (argv[catIdx + 1] || null) : null;
  printRules({ category });
  process.exit(0);
}

if (cmd === 'explain') {
  printExplain();
  process.exit(0);
}

if (cmd === 'lint') {
  // Accept args in any order, e.g.:
  // - lint path/to/openclaw.json --format json
  // - lint --format json path/to/openclaw.json
  const rest = argv.slice(1);
  let target = null;
  let format = null;

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--format') {
      format = rest[i + 1] || null;
      i++;
      continue;
    }
    if (a.startsWith('--format=')) {
      format = a.split('=', 2)[1] || null;
      continue;
    }
    if (a.startsWith('-')) {
      // unknown flag
      continue;
    }
    if (!target) target = a;
  }

  if (!target) usage(2);
  lintConfig(target, { format });
  process.exit(0);
}

process.stderr.write(`Unknown command: ${cmd}\n\n`);
usage(2);
