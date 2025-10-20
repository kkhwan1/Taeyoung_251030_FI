#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * API Normalization Workflow
 *
 * This utility reenacts the sequential remediation steps described in
 * ERP_TEST_RESULTS_REPORT.md. Each step either fixes known issues or
 * highlights remaining work so the API surface can be stabilized.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

const STEP_STATUS = {
  PASS: 'PASS',
  FIXED: 'FIXED',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

function collectSourceFiles(dir, exts, accumulator = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (['node_modules', '.next', 'logs', 'dist', 'coverage'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, exts, accumulator);
    } else if (exts.includes(path.extname(entry.name))) {
      accumulator.push(fullPath);
    }
  }
  return accumulator;
}

function logStepStart(name) {
  console.log(`\n==> ${name}`);
}

function logStepResult(name, status, details) {
  console.log(`   [${status}] ${name}`);
  if (details) {
    if (Array.isArray(details)) {
      details.forEach(detail => console.log(`     - ${detail}`));
    } else {
      console.log(`     - ${details}`);
    }
  }
}

function checkRawSqlTemplates() {
  const files = collectSourceFiles(path.join(repoRoot, 'src'), ['.ts', '.tsx', '.js', '.mjs']);
  const findings = [];
  const templateWithInterpolation = /`[^`]*\$\{[^`]*`/g;
  const executeSqlConcatPattern = /supabase\.rpc\s*\(\s*['\"]execute_sql['\"][^;\n]*\+/gim;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    templateWithInterpolation.lastIndex = 0;
    while ((match = templateWithInterpolation.exec(content)) !== null) {
      const snippet = match[0];
      const compactSnippet = snippet.replace(/\s+/g, ' ').trim();
      const upper = compactSnippet.toUpperCase();
      const isSelect = upper.includes('SELECT ') && upper.includes(' FROM ');
      const isInsert = upper.includes('INSERT ') && upper.includes(' INTO ');
      const isUpdate = upper.includes('UPDATE ') && upper.includes(' SET ');
      const isDelete = upper.includes('DELETE ') && upper.includes(' FROM ');
      if (isSelect || isInsert || isUpdate || isDelete) {
        findings.push(`${path.relative(repoRoot, file)} => ${compactSnippet}`);
      }
    }

    executeSqlConcatPattern.lastIndex = 0;
    if (executeSqlConcatPattern.test(content)) {
      findings.push(`${path.relative(repoRoot, file)} => uses execute_sql with string concatenation`);
    }
  }

  if (findings.length === 0) {
    return { status: STEP_STATUS.PASS, details: 'No raw SQL template literals detected.' };
  }

  return {
    status: STEP_STATUS.WARN,
    details: [
      'Potential raw SQL interpolation detected – replace with Supabase query builder as in ERP_TEST_RESULTS_REPORT.md Section 1.',
      ...findings.slice(0, 10),
      findings.length > 10 ? `...and ${findings.length - 10} more occurrences` : undefined,
    ].filter(Boolean),
  };
}

function ensureUtf8ContentType() {
  const files = collectSourceFiles(path.join(repoRoot, 'src'), ['.ts', '.tsx', '.js']);
  const updatedFiles = [];
  const headerPattern = /(Content-Type\s*['\"]?\s*[:=]\s*['\"])(application\/json)(['\"])/g;
  const setHeaderPattern = /(setHeader\(\s*['\"]Content-Type['\"],\s*['\"])(application\/json)(['\"])/g;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    content = content.replace(headerPattern, (match, prefix, mime, suffix) => {
      if (match.includes('charset')) return match;
      modified = true;
      return `${prefix}${mime}; charset=utf-8${suffix}`;
    });

    content = content.replace(setHeaderPattern, (match, prefix, mime, suffix) => {
      if (match.includes('charset')) return match;
      modified = true;
      return `${prefix}${mime}; charset=utf-8${suffix}`;
    });

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      updatedFiles.push(path.relative(repoRoot, file));
    }
  }

  if (updatedFiles.length === 0) {
    return { status: STEP_STATUS.PASS, details: 'All JSON responses already emit UTF-8 headers.' };
  }

  const preview = updatedFiles.slice(0, 5).map(file => `updated ${file}`);
  if (updatedFiles.length > 5) {
    preview.push(`...and ${updatedFiles.length - 5} more file(s)`);
  }

  return {
    status: STEP_STATUS.FIXED,
    details: [`Normalized Content-Type headers in ${updatedFiles.length} file(s).`, ...preview],
  };
}

function ensureEnvPlaceholders() {
  const envPath = path.join(repoRoot, '.env.example');
  if (!fs.existsSync(envPath)) {
    return { status: STEP_STATUS.ERROR, details: '.env.example not found.' };
  }

  const placeholderMap = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://<project-ref>.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '<anon-key>',
    SUPABASE_SERVICE_ROLE_KEY: '<service-role-key>',
    JWT_SECRET: '<jwt-secret>',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    SESSION_SECRET: '<session-secret>',
    NEXT_PUBLIC_CHARSET: 'utf-8',
    LANG: 'ko_KR.UTF-8',
    LC_ALL: 'ko_KR.UTF-8',
  };

  const originalContent = fs.readFileSync(envPath, 'utf8');
  const lines = originalContent.split(/\r?\n/);
  const lineIndexMap = new Map();

  lines.forEach((line, index) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (match) {
      lineIndexMap.set(match[1], index);
    }
  });

  let changed = false;

  for (const [key, value] of Object.entries(placeholderMap)) {
    if (lineIndexMap.has(key)) {
      const currentLine = lines[lineIndexMap.get(key)];
      if (!currentLine.endsWith(value)) {
        lines[lineIndexMap.get(key)] = `${key}=${value}`;
        changed = true;
      }
    } else {
      lines.push(`${key}=${value}`);
      changed = true;
    }
  }

  if (!changed) {
    return { status: STEP_STATUS.PASS, details: '.env.example already aligned with placeholder guidance.' };
  }

  const sanitized = lines.join('\n').replace(/\s+$/g, '') + '\n';
  fs.writeFileSync(envPath, sanitized, 'utf8');
  return { status: STEP_STATUS.FIXED, details: 'Updated .env.example with standardized placeholders.' };
}

function runVerificationCommands() {
  const commands = [
    ['npm', ['run', 'lint']],
    ['npm', ['run', 'type-check']],
  ];

  const failures = [];

  for (const [command, args] of commands) {
    const result = spawnSync(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    if (result.status !== 0) {
      failures.push(`${command} ${args.join(' ')}`);
    }
  }

  if (failures.length > 0) {
    return {
      status: STEP_STATUS.WARN,
      details: [`Verification commands failed: ${failures.join(', ')}`],
    };
  }

  return { status: STEP_STATUS.PASS, details: 'Lint and type-check commands completed successfully.' };
}

const steps = [
  { name: 'Detect raw SQL template usage', runner: checkRawSqlTemplates },
  { name: 'Normalize UTF-8 response headers', runner: ensureUtf8ContentType },
  { name: 'Align environment placeholders', runner: ensureEnvPlaceholders },
  { name: 'Run lint/type-check safeguards', runner: runVerificationCommands },
];

function runWorkflow() {
  const summary = [];

  for (const step of steps) {
    logStepStart(step.name);
    try {
      const { status, details } = step.runner();
      summary.push({ name: step.name, status, details });
      logStepResult(step.name, status, details);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.push({ name: step.name, status: STEP_STATUS.ERROR, details: message });
      logStepResult(step.name, STEP_STATUS.ERROR, message);
    }
  }

  console.log('\nSummary:');
  for (const item of summary) {
    console.log(` - ${item.name}: ${item.status}`);
  }

  const hasError = summary.some(item => item.status === STEP_STATUS.ERROR);
  const hasWarn = summary.some(item => item.status === STEP_STATUS.WARN);
  if (hasError) process.exitCode = 1;
  else if (hasWarn) process.exitCode = 2;
}

runWorkflow();

