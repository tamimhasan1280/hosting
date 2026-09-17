const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const storageService = require('./src/services/storageService');
const bandwidthService = require('./src/services/bandwidthService');
const resourceUsageService = require('./src/services/resourceUsageService');

const BASE_URL = 'http://localhost:5000/api';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('====================================================');
  console.log('AUDIT: FEATURE #34 - RESOURCE USAGE IMPLEMENTATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    return fn()
      .then(() => {
        console.log(`  [PASS] Test ${total}: ${name}`);
        passed++;
      })
      .catch(err => {
        console.error(`  [FAIL] Test ${total}: ${name}`);
        console.error(`         Error: ${err.message}`);
      });
  }

  // TEST 1: Capability Discovery
  await test('GET /api/resource-usage/capabilities returns truthful host detection', async () => {
    const res = await request('GET', '/resource-usage/capabilities');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.platform, 'Platform must be present');
    assert.strictEqual(typeof res.data.lveInstalled, 'boolean');
    assert.ok(Array.isArray(res.data.availableMetrics), 'availableMetrics must be an array');
    assert.ok(res.data.availableMetrics.includes('cpu'), 'CPU metric must be supported');
    assert.ok(res.data.availableMetrics.includes('memory'), 'Memory metric must be supported');
    assert.ok(res.data.availableMetrics.includes('disk'), 'Disk metric must be supported');
    assert.ok(res.data.availableMetrics.includes('bandwidth'), 'Bandwidth metric must be supported');
    if (res.data.platform === 'win32') {
      assert.strictEqual(res.data.lveInstalled, false, 'CloudLinux LVE must be false on Windows');
      assert.strictEqual(res.data.source, 'os_systeminformation');
    }
  });

  // TEST 2: Real-Time Current Usage
  await test('GET /api/resource-usage/current returns authentic metrics for cpanel_user', async () => {
    const res = await request('GET', '/resource-usage/current?user=cpanel_user');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user, 'cpanel_user');
    assert.strictEqual(res.data.domain, 'example.com');
    assert.ok(res.data.metrics, 'Metrics object must be returned');

    const m = res.data.metrics;
    assert.ok(typeof m.cpu.usedPercent === 'number', 'CPU used % must be number');
    assert.ok(m.cpu.limitPercent >= 100, 'CPU limit must be at least 100%');
    assert.ok(typeof m.memory.usedMb === 'number', 'Memory usedMb must be number');
    assert.strictEqual(m.memory.limitMb, 1024, 'cpanel_user pMEM limit must be 1024 MB');
    assert.strictEqual(m.vMem.limitMb, 2048, 'cpanel_user vMEM limit must be 2048 MB');
    assert.ok(m.entryProcesses.limit === 20, 'cpanel_user EP limit must be 20');
    assert.ok(m.totalProcesses.limit === 100, 'cpanel_user NPROC limit must be 100');
  });

  // TEST 3: Consistency with Authoritative Storage & Bandwidth Services
  await test('Disk and Bandwidth metrics match storageService and bandwidthService exactly', async () => {
    const res = await request('GET', '/resource-usage/current?user=cpanel_user');
    assert.strictEqual(res.status, 200);

    const authDisk = storageService.getDiskUsage('cpanel_user');
    const authBw = await bandwidthService.getAccountBandwidthSummary('cpanel_user');

    assert.strictEqual(res.data.metrics.disk.usedMb, authDisk.mb, 'Disk MB must match storageService');
    assert.strictEqual(res.data.metrics.disk.files, authDisk.files, 'Disk files must match storageService');
    assert.ok(Math.abs(res.data.metrics.bandwidth.usedMb - authBw.usedMb) <= 0.05, 'Bandwidth MB must match bandwidthService within request overhead');
  });

  // TEST 4: Plan Quotas Resolution across Tiers
  await test('Plan quotas correctly scale between Standard, Gold Cloud, and Enterprise Cloud', async () => {
    const stdRes = await request('GET', '/resource-usage/current?user=cpanel_user');
    assert.strictEqual(stdRes.data.plan, 'Standard Shared Hosting');
    assert.strictEqual(stdRes.data.metrics.cpu.limitPercent, 100);
    assert.strictEqual(stdRes.data.metrics.memory.limitMb, 1024);
    assert.strictEqual(stdRes.data.metrics.entryProcesses.limit, 20);

    const goldRes = await request('GET', '/resource-usage/current?user=client_auto1');
    assert.strictEqual(goldRes.data.plan, 'Gold Cloud');
    assert.strictEqual(goldRes.data.metrics.cpu.limitPercent, 200);
    assert.strictEqual(goldRes.data.metrics.memory.limitMb, 2048);
    assert.strictEqual(goldRes.data.metrics.entryProcesses.limit, 40);

    const entRes = await request('GET', '/resource-usage/current?user=audit_1977');
    assert.strictEqual(entRes.data.plan, 'Enterprise Cloud');
    assert.strictEqual(entRes.data.metrics.cpu.limitPercent, 400);
    assert.strictEqual(entRes.data.metrics.memory.limitMb, 4096);
    assert.strictEqual(entRes.data.metrics.entryProcesses.limit, 80);
  });

  // TEST 5: Truthful Handling of Unsupported Metrics (No Fake Data)
  await test('Disk I/O & IOPS truthfully report Not available when underlying blkio is absent', async () => {
    const res = await request('GET', '/resource-usage/current?user=cpanel_user');
    assert.strictEqual(res.status, 200);
    const io = res.data.metrics.io;
    const iops = res.data.metrics.iops;

    if (res.data.capabilities.platform === 'win32' && !res.data.capabilities.diskIoSupported) {
      assert.strictEqual(io.throughputKbps, null);
      assert.strictEqual(io.status, 'Not available');
      assert.strictEqual(iops.currentIops, null);
      assert.strictEqual(iops.status, 'Not available');
    }
  });

  // TEST 6: Snapshot Recording & Persistence
  await test('POST /api/resource-usage/snapshot persists reading to history file', async () => {
    const res = await request('POST', '/resource-usage/snapshot', { cpanelUser: 'cpanel_user' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.snapshot, 'Snapshot object must be returned');
    assert.ok(res.data.snapshot.id.startsWith('snap_'));
    assert.strictEqual(res.data.snapshot.user, 'cpanel_user');
    assert.ok(typeof res.data.snapshot.cpuPercent === 'number');
    assert.ok(typeof res.data.snapshot.memoryMb === 'number');

    // Verify history file contains this snapshot
    const historyFile = path.resolve(__dirname, 'data/resource_usage_history.json');
    assert.ok(fs.existsSync(historyFile));
    const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    const found = history.find(s => s.id === res.data.snapshot.id);
    assert.ok(found, 'Recorded snapshot must exist in history file');
  });

  // TEST 7: Historical Query & Aggregation
  await test('GET /api/resource-usage/history returns filtered snapshots and summary stats', async () => {
    const res = await request('GET', '/resource-usage/history?user=cpanel_user&range=24h');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.range, '24h');
    assert.ok(Array.isArray(res.data.snapshots));
    assert.ok(res.data.count >= 1);
    assert.ok(res.data.summary, 'Summary stats object must be present');
    assert.ok(typeof res.data.summary.peakCpuPercent === 'number');
    assert.ok(typeof res.data.summary.avgCpuPercent === 'number');
    assert.ok(typeof res.data.summary.peakMemoryMb === 'number');
  });

  // TEST 8: Faults & Incidents Query
  await test('GET /api/resource-usage/faults returns fault events log', async () => {
    const res = await request('GET', '/resource-usage/faults?user=cpanel_user&hours=24');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.faults));
  });

  // TEST 9: Multi-Tenant Isolation
  await test('Account isolation: User A snapshots and metrics are isolated from User B', async () => {
    // Record a snapshot for client_auto1
    await request('POST', '/resource-usage/snapshot', { cpanelUser: 'client_auto1' });

    const histUserA = await request('GET', '/resource-usage/history?user=cpanel_user&range=24h');
    const histUserB = await request('GET', '/resource-usage/history?user=client_auto1&range=24h');

    assert.ok(histUserA.data.snapshots.every(s => s.user === 'cpanel_user'), 'User A history must contain only User A');
    assert.ok(histUserB.data.snapshots.every(s => s.user === 'client_auto1'), 'User B history must contain only User B');
  });

  // TEST 10: Consistency with cPanel Statistics Panel
  await test('Resource usage disk and bandwidth match GET /api/metrics/system', async () => {
    const [ruRes, sysRes] = await Promise.all([
      request('GET', '/resource-usage/current?user=cpanel_user'),
      request('GET', '/metrics/system?user=cpanel_user')
    ]);

    assert.strictEqual(ruRes.status, 200);
    assert.strictEqual(sysRes.status, 200);

    assert.strictEqual(
      ruRes.data.metrics.disk.usedMb,
      sysRes.data.resources.disk.homeUsedMb,
      'Disk MB must match system stats'
    );
    assert.strictEqual(
      ruRes.data.metrics.bandwidth.usedMb,
      sysRes.data.resources.bandwidth.usedMb,
      'Bandwidth MB must match system stats'
    );
  });

  console.log(`\nAUDIT COMPLETE: ${passed}/${total} tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
