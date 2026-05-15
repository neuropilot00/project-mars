#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const targetSha = args.find(arg => !arg.startsWith('--')) || process.env.ROLLBACK_SHA || '';
const apply = args.includes('--apply');
const push = args.includes('--push');

function run(command, options = {}) {
  return execSync(command, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function fail(message) {
  console.error(`❌  ${message}`);
  process.exit(1);
}

function usage() {
  console.log('Usage: npm run rollback:plan -- <known-good-sha> [--apply] [--push]');
  console.log('');
  console.log('Examples:');
  console.log('  npm run rollback:plan -- f4efa44');
  console.log('  npm run rollback:plan -- f4efa44 --apply');
  console.log('  npm run rollback:plan -- f4efa44 --apply --push');
}

if (!targetSha) {
  usage();
  process.exit(1);
}

let resolvedSha;
try {
  resolvedSha = run(`git rev-parse --verify ${targetSha}`);
} catch (error) {
  fail(`invalid target SHA: ${targetSha}`);
}

const branch = run('git rev-parse --abbrev-ref HEAD');
const head = run('git rev-parse HEAD');
const shortHead = run('git rev-parse --short HEAD');
const shortTarget = run(`git rev-parse --short ${resolvedSha}`);
const dirty = run('git status --short');
const now = new Date().toISOString();

console.log(`branch=${branch}`);
console.log(`head=${head}`);
console.log(`target=${resolvedSha}`);
console.log(`mode=${apply ? 'apply' : 'dry-run'}`);
console.log('');

if (head === resolvedSha) {
  fail('target SHA is already current HEAD');
}

try {
  const summary = run(`git log --oneline --decorate --no-abbrev-commit ${resolvedSha}..${head}`);
  console.log('Commits to remove from main:');
  console.log(summary);
} catch (error) {
  console.log('Commits to remove from main: (none listed)');
}

const commands = [
  `git checkout ${branch}`,
  `git reset --hard ${resolvedSha}`,
  'git status --short',
];
if (push) commands.push(`git push --force-with-lease origin ${branch}`);

console.log('');
console.log('Planned commands:');
commands.forEach(command => console.log(`  ${command}`));

if (!apply) {
  console.log('');
  console.log('✅  dry-run complete');
  process.exit(0);
}

if (dirty) {
  fail('working tree is not clean; commit or stash changes before apply');
}

if (push && branch !== 'main') {
  fail(`refusing --push on non-main branch: ${branch}`);
}

console.log('');
console.log(`⚠️  applying rollback at ${now}`);
run(`git reset --hard ${resolvedSha}`, { stdio: 'inherit' });
if (push) {
  run(`git push --force-with-lease origin ${branch}`, { stdio: 'inherit' });
}
console.log(`✅  rollback applied: ${shortHead} -> ${shortTarget}`);
