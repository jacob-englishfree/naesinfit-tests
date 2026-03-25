#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — deploy.js
 * One-stop deployment: validate → build → git push → Supabase DB register
 *
 * Usage:
 *   node scripts/deploy.js data/모의고사/고1/3월/18번/단어.json
 *   node scripts/deploy.js all
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DIST_DIR = path.join(ROOT, 'dist');

// Supabase config
const SUPABASE_URL = 'https://enkewpvhaugcmyglifkc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVua2V3cHZoYXVnY215Z2xpZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTQzMjksImV4cCI6MjA4OTA3MDMyOX0.JJvDYNbxSnsaE30tMFl5x1Daqyx2Wk8bQv6s19tNrY8';
const BASE_URL = 'https://jacob-englishfree.github.io/naesinfit-tests';

const VALIDATE_PATH = path.join(ROOT, 'validate', 'validate.js');
const BUILD_PATH = path.join(ROOT, 'engine', 'build.js');

function findJsonFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

function getDistPath(jsonPath) {
  const relFromData = path.relative(DATA_DIR, jsonPath);
  const parsed = path.parse(relFromData);
  return path.join(DIST_DIR, parsed.dir, parsed.name + '테스트.html');
}

function getGitHubUrl(htmlPath) {
  const relFromRoot = path.relative(ROOT, htmlPath);
  // Encode each path segment
  const encoded = relFromRoot.split(path.sep).map(s => encodeURIComponent(s)).join('/');
  return `${BASE_URL}/${encoded}`;
}

function supabaseRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SUPABASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function buildContentId(data) {
  // Generate a deterministic content ID from the data
  const { ei, testType } = data;
  const parts = [ei.subject, ei.pub, ei.lesson, testType].map(s =>
    (s || '').replace(/\s+/g, '_').replace(/[^\w가-힣_]/g, '')
  );
  return parts.join('_');
}

function buildTestTypeKey(testType) {
  const map = { '단어': 'word', '워크북': 'workbook', '퀴즈': 'quiz' };
  return map[testType] || testType;
}

async function registerToSupabase(jsonPath, htmlUrl, data) {
  const { ei, testType } = data;

  // Check if content already exists by histKey
  const histKey = ei.histKey;
  const checkRes = await supabaseRequest('GET',
    `/rest/v1/test_app_deploy?histKey=eq.${encodeURIComponent(histKey)}&select=id,histKey`);

  if (checkRes.status === 200 && Array.isArray(checkRes.data) && checkRes.data.length > 0) {
    // Update existing
    const id = checkRes.data[0].id;
    const updateRes = await supabaseRequest('PATCH',
      `/rest/v1/test_app_deploy?id=eq.${id}`, {
        url: htmlUrl,
        testType: buildTestTypeKey(testType),
        subject: ei.subject,
        pub: ei.pub,
        lesson: ei.lesson,
        title: ei.title,
        updatedAt: new Date().toISOString()
      });
    return { action: 'updated', id, status: updateRes.status };
  } else {
    // Insert new
    const insertRes = await supabaseRequest('POST', '/rest/v1/test_app_deploy', {
      histKey: histKey,
      url: htmlUrl,
      testType: buildTestTypeKey(testType),
      subject: ei.subject,
      pub: ei.pub,
      lesson: ei.lesson,
      title: ei.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return { action: 'inserted', status: insertRes.status };
  }
}

async function deployFile(jsonPath) {
  const rel = path.relative(ROOT, jsonPath);
  console.log(`\n--- Deploying: ${rel} ---`);

  // Step 1: Validate
  console.log('  [1/4] Validating...');
  const { validate } = require(VALIDATE_PATH);
  const result = validate(jsonPath);
  if (!result.pass) {
    console.log('  [FAIL] Validation failed:');
    result.errors.forEach(e => console.log(`    [${e.sev}] ${e.id}: ${e.msg}`));
    return { file: rel, success: false, reason: 'validation failed' };
  }
  console.log('  [PASS] Validation OK');

  // Step 2: Build
  console.log('  [2/4] Building HTML...');
  try {
    execFileSync(process.execPath, [BUILD_PATH, jsonPath], {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 30000
    });
  } catch (e) {
    const errMsg = (e.stderr || '').toString().trim();
    console.log(`  [FAIL] Build failed: ${errMsg}`);
    return { file: rel, success: false, reason: 'build failed' };
  }

  const distPath = getDistPath(jsonPath);
  if (!fs.existsSync(distPath)) {
    console.log('  [FAIL] Build output not found');
    return { file: rel, success: false, reason: 'build output missing' };
  }
  console.log(`  [OK] Built: ${path.relative(ROOT, distPath)}`);

  // Step 3: Git add + commit + push
  console.log('  [3/4] Git push...');
  try {
    execSync(`git add "${distPath}"`, { cwd: ROOT, stdio: 'pipe' });
    // Also add the JSON source
    execSync(`git add "${jsonPath}"`, { cwd: ROOT, stdio: 'pipe' });

    // Check if there are changes to commit
    const status = execSync('git status --porcelain', { cwd: ROOT, stdio: 'pipe' }).toString().trim();
    if (status) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const commitMsg = `deploy: ${data.ei.subject} ${data.ei.pub} ${data.testType}테스트`;
      execSync(`git commit -m "${commitMsg}"`, { cwd: ROOT, stdio: 'pipe' });
      console.log('  [OK] Committed');
    } else {
      console.log('  [SKIP] No changes to commit');
    }
  } catch (e) {
    // Git errors are non-fatal for the deploy process
    console.log(`  [WARN] Git: ${(e.stderr || e.message || '').toString().trim().split('\n')[0]}`);
  }

  // Step 4: Register to Supabase
  console.log('  [4/4] Registering to Supabase...');
  const htmlUrl = getGitHubUrl(distPath);
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  try {
    const dbResult = await registerToSupabase(jsonPath, htmlUrl, data);
    console.log(`  [OK] DB ${dbResult.action} (status: ${dbResult.status})`);
  } catch (e) {
    console.log(`  [WARN] DB registration failed: ${e.message}`);
    // Non-fatal — the HTML is still deployed via git
  }

  console.log(`  [URL] ${htmlUrl}`);
  return { file: rel, success: true, url: htmlUrl };
}

async function gitPushAll() {
  console.log('\nPushing to remote...');
  try {
    execSync('git push', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    console.log('[OK] Pushed to remote');
  } catch (e) {
    console.log(`[WARN] Git push failed: ${(e.stderr || e.message || '').toString().trim().split('\n')[0]}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/deploy.js <json-file>');
    console.error('       node scripts/deploy.js all');
    process.exit(1);
  }

  let files;
  if (args[0] === 'all') {
    files = findJsonFiles(DATA_DIR);
    console.log(`Found ${files.length} JSON files to deploy`);
  } else {
    const filePath = path.resolve(args[0]);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    files = [filePath];
  }

  const results = [];
  for (const f of files) {
    const r = await deployFile(f);
    results.push(r);
  }

  // Push all at once
  await gitPushAll();

  // Summary
  const success = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('\n' + '='.repeat(60));
  console.log('Deploy Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${results.length} | Success: ${success.length} | Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed:');
    failed.forEach(f => console.log(`  ${f.file}: ${f.reason}`));
  }

  if (success.length > 0) {
    console.log('\nDeployed URLs:');
    success.forEach(s => console.log(`  ${s.url}`));
  }

  console.log('='.repeat(60));
  process.exit(failed.length > 0 ? 1 : 0);
}

if (require.main === module) main();
