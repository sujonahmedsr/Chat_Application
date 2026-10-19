const test = require('node:test');
const assert = require('node:assert/strict');
const ioClient = require('../../client/node_modules/socket.io-client');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./testHelper');
const { createTestApp } = require('./appFactory');
const SystemSetting = require('../src/models/SystemSetting');

let serverInstance;
let baseUrl;
let socketUrl;
let userAToken, userBToken;
let userAId, userBId;

test.before(async () => {
  await setupTestDB();
  const { server } = createTestApp();
  await new Promise((resolve) => {
    serverInstance = server.listen(0, () => {
      const port = serverInstance.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      socketUrl = `http://127.0.0.1:${port}`;
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
  await SystemSetting.create({ key: 'allowDummyUsers', value: true });

  const resA = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User A', email: 'socketA@test.com', password: 'password123' }),
  });
  const dataA = await resA.json();
  userAToken = dataA.token;
  userAId = dataA.user.id || dataA.user._id;

  const resB = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User B', email: 'socketB@test.com', password: 'password123' }),
  });
  const dataB = await resB.json();
  userBToken = dataB.token;
  userBId = dataB.user.id || dataB.user._id;
});

test('Socket: Valid JWT token connects successfully', async () => {
  const socket = ioClient(socketUrl, {
    auth: { token: userAToken },
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      assert.ok(socket.id);
      socket.disconnect();
      resolve();
    });
    socket.on('connect_error', reject);
  });
});

test('Security Audit: Socket auth bypass via raw userId without token', async () => {
  // Attacker connects passing ONLY userId: userAId (victim's ID), without any token!
  const socket = ioClient(socketUrl, {
    auth: { userId: userAId },
    transports: ['websocket'],
  });

  let connectedWithoutToken = false;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), 2000);
      socket.on('connect', () => {
        connectedWithoutToken = true;
        clearTimeout(timer);
        socket.disconnect();
        resolve();
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        resolve();
      });
    });
  } catch (e) {}

  console.log('Socket Auth Bypass audit result - connectedWithoutToken:', connectedWithoutToken);
  // If connectedWithoutToken is true, ANYONE can impersonate ANY user over WebSocket!
  assert.equal(
    connectedWithoutToken,
    false,
    'CRITICAL VULNERABILITY: Socket connection MUST NOT be accepted with arbitrary userId without valid JWT token'
  );
});

test('Socket: Typing indicator exchange between two users', async () => {
  const socketA = ioClient(socketUrl, { auth: { token: userAToken }, transports: ['websocket'] });
  const socketB = ioClient(socketUrl, { auth: { token: userBToken }, transports: ['websocket'] });

  await Promise.all([
    new Promise((resolve) => socketA.on('connect', resolve)),
    new Promise((resolve) => socketB.on('connect', resolve)),
  ]);

  const typingPromise = new Promise((resolve) => {
    socketB.on('typing:start', (payload) => {
      assert.equal(String(payload.senderId), String(userAId));
      resolve();
    });
  });

  socketA.emit('typing:start', { receiverId: userBId });
  await typingPromise;

  socketA.disconnect();
  socketB.disconnect();
});
