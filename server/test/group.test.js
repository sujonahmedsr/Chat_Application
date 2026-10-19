const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./testHelper');
const { createTestApp } = require('./appFactory');
const SystemSetting = require('../src/models/SystemSetting');
const Group = require('../src/models/Group');

let serverInstance;
let baseUrl;
let creatorToken, memberToken, outsiderToken;
let creatorId, memberId, outsiderId;

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
  await SystemSetting.create({ key: 'allowDummyUsers', value: true });

  const res1 = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Creator', email: 'creator@test.com', password: 'password123' }),
  });
  const data1 = await res1.json();
  creatorToken = data1.token;
  creatorId = data1.user.id || data1.user._id;

  const res2 = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Member', email: 'member@test.com', password: 'password123' }),
  });
  const data2 = await res2.json();
  memberToken = data2.token;
  memberId = data2.user.id || data2.user._id;

  const res3 = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Outsider', email: 'outsider@test.com', password: 'password123' }),
  });
  const data3 = await res3.json();
  outsiderToken = data3.token;
  outsiderId = data3.user.id || data3.user._id;
});

test('Group: Create group successfully with creator and members', async () => {
  const res = await fetch(`${baseUrl}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({
      name: 'Engineering Team',
      description: 'Tech talk',
      memberIds: [memberId],
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.group.name, 'Engineering Team');
  assert.equal(data.group.members.length, 2);
});

test('Group: Member sees group in /api/groups list', async () => {
  await fetch(`${baseUrl}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({
      name: 'Design Team',
      memberIds: [memberId],
    }),
  });

  const res = await fetch(`${baseUrl}/groups`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.groups.length, 1);
  assert.equal(data.groups[0].name, 'Design Team');

  // Outsider should NOT see Design Team
  const outRes = await fetch(`${baseUrl}/groups`, {
    headers: { Authorization: `Bearer ${outsiderToken}` },
  });
  const outData = await outRes.json();
  assert.equal(outData.groups.length, 0);
});

test('Group: Add members allowed for creator and rejected for regular member', async () => {
  const grpRes = await fetch(`${baseUrl}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({ name: 'Dev Ops', memberIds: [] }),
  });
  const { group } = await grpRes.json();
  const groupId = group.id || group._id;

  // Regular member tries to add outsider -> should 403
  const rejectRes = await fetch(`${baseUrl}/groups/${groupId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
    body: JSON.stringify({ memberIds: [outsiderId] }),
  });
  assert.equal(rejectRes.status, 403);

  // Creator adds outsider -> should 200
  const allowRes = await fetch(`${baseUrl}/groups/${groupId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({ memberIds: [outsiderId] }),
  });
  assert.equal(allowRes.status, 200);
});

test('Group: Delete group allowed for creator and rejected for non-creator', async () => {
  const grpRes = await fetch(`${baseUrl}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({ name: 'Secret Group', memberIds: [memberId] }),
  });
  const { group } = await grpRes.json();
  const groupId = group.id || group._id;

  // Non-creator tries to delete
  const delFail = await fetch(`${baseUrl}/groups/${groupId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  assert.equal(delFail.status, 403);

  // Creator deletes
  const delOk = await fetch(`${baseUrl}/groups/${groupId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${creatorToken}` },
  });
  assert.equal(delOk.status, 200);
});

test('Security Audit: Group message BOLA/IDOR - Non-member reading private group messages', async () => {
  const grpRes = await fetch(`${baseUrl}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({ name: 'Confidential Executive Group', memberIds: [] }),
  });
  const { group } = await grpRes.json();
  const groupId = group.id || group._id;

  // Outsider requests private group messages
  const leakRes = await fetch(`${baseUrl}/groups/${groupId}/messages`, {
    headers: { Authorization: `Bearer ${outsiderToken}` },
  });

  // If the server returns 200, it is vulnerable to BOLA / IDOR!
  // Secure design MUST return 403 Forbidden!
  const isVulnerable = leakRes.status === 200;
  console.log('Group message BOLA audit result - status:', leakRes.status, 'isVulnerable:', isVulnerable);
  assert.equal(leakRes.status, 403, 'Non-members MUST NOT be permitted to read group messages (BOLA/IDOR vulnerability)');
});
