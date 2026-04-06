#!/usr/bin/env node
/**
 * cleanup-reports.js — 30일 이상 된 리포트 자동 정리
 * Usage: node scripts/cleanup-reports.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const MAX_AGE_DAYS = 30;
const DRY_RUN = process.argv.includes('--dry-run');

const now = Date.now();
let deleted = 0;
let kept = 0;
let totalSize = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      // Remove empty dirs
      if (fs.readdirSync(full).length === 0) {
        if (!DRY_RUN) fs.rmdirSync(full);
      }
    } else {
      const stat = fs.statSync(full);
      const ageDays = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);
      if (ageDays > MAX_AGE_DAYS) {
        totalSize += stat.size;
        deleted++;
        if (!DRY_RUN) fs.unlinkSync(full);
      } else {
        kept++;
      }
    }
  }
}

walk(REPORTS_DIR);

console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Reports cleanup:`);
console.log(`  Deleted: ${deleted} files (${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
console.log(`  Kept: ${kept} files (< ${MAX_AGE_DAYS} days old)`);
if (DRY_RUN) console.log('  Run without --dry-run to actually delete.');
