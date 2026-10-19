const { setupTestDB, teardownTestDB, clearTestDB } = require('./testHelper');
const { createTestApp } = require('./appFactory');
const SystemSetting = require('../src/models/SystemSetting');
const User = require('../src/models/User');
const cacheService = require('../src/services/cacheService');

const calculatePercentiles = (latencies) => {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = (sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return {
    p50: Number(p50.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    p99: Number(p99.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    avg: Number(avg.toFixed(2)),
  };
};

async function runBenchmark() {
  console.log('=== Performance & Latency Benchmark Starting ===');
  await setupTestDB();
  const { server } = createTestApp();

  const serverInstance = await new Promise((resolve) => {
    const s = server.listen(0, () => resolve(s));
  });
  const port = serverInstance.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  await clearTestDB();
  await SystemSetting.create({ key: 'allowDummyUsers', value: true });

  const initialMem = process.memoryUsage();

  // Register benchmark user
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bench User',
      email: 'bench@test.com',
      password: 'password123',
    }),
  });
  const { token, user } = await regRes.json();
  const userId = user.id || user._id;

  // 1. Auth Login Latency (bcrypt comparison overhead)
  console.log('\n[1/4] Benchmarking Auth Login (50 requests)...');
  const loginLatencies = [];
  for (let i = 0; i < 50; i++) {
    const start = performance.now();
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bench@test.com', password: 'password123' }),
    });
    const dur = performance.now() - start;
    if (res.ok) loginLatencies.push(dur);
  }

  // 2. Auth /me with Cache (User Profile)
  console.log('[2/4] Benchmarking /auth/me profile lookups (100 requests)...');
  const meLatencies = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dur = performance.now() - start;
    if (res.ok) meLatencies.push(dur);
  }

  // 3. Friends List Query with In-Memory / Redis Cache
  console.log('[3/4] Benchmarking Friends List /friends (100 requests)...');
  const friendsLatencies = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    const res = await fetch(`${baseUrl}/friends`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dur = performance.now() - start;
    if (res.ok) friendsLatencies.push(dur);
  }

  // 4. Cache Hit vs Cache Miss Latency on Message Cache
  console.log('[4/4] Benchmarking Cache Hit vs Miss...');
  const cacheMissStart = performance.now();
  await cacheService.get('messages:direct:dummy1:dummy2');
  const cacheMissDur = performance.now() - cacheMissStart;

  await cacheService.set('messages:direct:dummy1:dummy2', [{ id: '1', content: 'test message' }], 60);
  const cacheHitStart = performance.now();
  await cacheService.get('messages:direct:dummy1:dummy2');
  const cacheHitDur = performance.now() - cacheHitStart;

  const finalMem = process.memoryUsage();

  const results = {
    authLogin: calculatePercentiles(loginLatencies),
    authMeProfile: calculatePercentiles(meLatencies),
    friendsList: calculatePercentiles(friendsLatencies),
    cache: {
      cacheMissMs: Number(cacheMissDur.toFixed(3)),
      cacheHitMs: Number(cacheHitDur.toFixed(3)),
    },
    memory: {
      initialHeapUsedMB: Number((initialMem.heapUsed / 1024 / 1024).toFixed(2)),
      finalHeapUsedMB: Number((finalMem.heapUsed / 1024 / 1024).toFixed(2)),
      heapDeltaMB: Number(((finalMem.heapUsed - initialMem.heapUsed) / 1024 / 1024).toFixed(2)),
      rssMB: Number((finalMem.rss / 1024 / 1024).toFixed(2)),
    },
  };

  console.log('\n=== Benchmark Results Summary ===');
  console.log(JSON.stringify(results, null, 2));

  await new Promise((resolve) => serverInstance.close(resolve));
  await teardownTestDB();
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
