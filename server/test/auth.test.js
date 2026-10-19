const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./testHelper');
const { createTestApp } = require('./appFactory');
const SystemSetting = require('../src/models/SystemSetting');
const User = require('../src/models/User');

let serverInstance;
let baseUrl;

test.before(async () => {
  await setupTestDB();
  const { server } = createTestApp();
  await new Promise((resolve) => {
    serverInstance = server.listen(0, () => {
      const port = serverInstance.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
});

test.after(async () => {
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
  }
  await teardownTestDB();
});

test.beforeEach(async () => {
  await clearTestDB();
  // Set allowDummyUsers to true for test suite
  await SystemSetting.create({ key: 'allowDummyUsers', value: true });
});

test('Auth: Register new user successfully with valid credentials', async () => {
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Tester',
      email: 'alice.test@example.com',
      password: 'password123',
    }),
  });

  const data = await res.json();
  assert.equal(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(data)}`);
  assert.ok(data.token, 'Should return JWT token');
  assert.equal(data.user.email, 'alice.test@example.com');
  assert.equal(data.user.role, 'user');
});

test('Auth: Reject registration if password is less than 6 characters', async () => {
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Short Pass',
      email: 'short@example.com',
      password: '123',
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.message, /at least 6 characters/i);
});

test('Auth: Reject duplicate email registration with 409 Conflict', async () => {
  await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'User One',
      email: 'dup@example.com',
      password: 'password123',
    }),
  });

  const res2 = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'User Two',
      email: 'dup@example.com',
      password: 'password456',
    }),
  });

  assert.equal(res2.status, 409);
});

test('Auth: Reject registration if allowDummyUsers is false and user is not super admin', async () => {
  await SystemSetting.findOneAndUpdate({ key: 'allowDummyUsers' }, { value: false });

  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Regular User',
      email: 'regular@example.com',
      password: 'password123',
    }),
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.message, /Google Authentication only/i);
});

test('Auth: Login successfully with correct credentials', async () => {
  await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bob Tester',
      email: 'bob.test@example.com',
      password: 'secretpassword',
    }),
  });

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'bob.test@example.com',
      password: 'secretpassword',
    }),
  });

  assert.equal(loginRes.status, 200);
  const data = await loginRes.json();
  assert.ok(data.token);
  assert.equal(data.user.email, 'bob.test@example.com');
});

test('Auth: Fail login with incorrect password', async () => {
  await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Charlie Tester',
      email: 'charlie.test@example.com',
      password: 'correctpassword',
    }),
  });

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'charlie.test@example.com',
      password: 'WRONGpassword',
    }),
  });

  assert.equal(loginRes.status, 401);
  const data = await loginRes.json();
  assert.match(data.message, /Invalid email or password/i);
});

test('Auth: Reject login if user account is blocked by admin', async () => {
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Blocked User',
      email: 'blocked@example.com',
      password: 'password123',
    }),
  });
  const { user } = await regRes.json();

  await User.findByIdAndUpdate(user.id || user._id, { isBlockedByAdmin: true });

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'blocked@example.com',
      password: 'password123',
    }),
  });

  assert.equal(loginRes.status, 403);
  const data = await loginRes.json();
  assert.match(data.message, /suspended by an administrator/i);
});

test('Auth: /auth/me returns current user profile when valid token provided', async () => {
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Profile Tester',
      email: 'profile@example.com',
      password: 'password123',
    }),
  });
  const { token, user } = await regRes.json();

  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.user.email, 'profile@example.com');
});
