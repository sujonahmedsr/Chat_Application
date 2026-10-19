const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./testHelper');
const { createTestApp } = require('./appFactory');
const SystemSetting = require('../src/models/SystemSetting');
const Message = require('../src/models/Message');

let serverInstance;
let baseUrl;
let userAToken, userBToken, userCToken;
let userAId, userBId, userCId;

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

  // Create User A
  const resA = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User A', email: 'userA@test.com', password: 'password123' }),
  });
  const dataA = await resA.json();
  userAToken = dataA.token;
  userAId = dataA.user.id || dataA.user._id;

  // Create User B
  const resB = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User B', email: 'userB@test.com', password: 'password123' }),
  });
  const dataB = await resB.json();
  userBToken = dataB.token;
  userBId = dataB.user.id || dataB.user._id;

  // Create User C (Attacker / Unauthorized)
  const resC = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User C', email: 'userC@test.com', password: 'password123' }),
  });
  const dataC = await resC.json();
  userCToken = dataC.token;
  userCId = dataC.user.id || dataC.user._id;
});

test('Messaging: Send message from User A to User B and verify persistence', async () => {
  const sendRes = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userAToken}`,
    },
    body: JSON.stringify({
      receiverId: userBId,
      content: 'Hello User B!',
      messageType: 'text',
    }),
  });

  assert.equal(sendRes.status, 201);
  const sendData = await sendRes.json();
  assert.equal(sendData.message.content, 'Hello User B!');
  assert.equal(String(sendData.message.senderId), String(userAId));
  assert.equal(String(sendData.message.receiverId), String(userBId));

  // Verify in MongoDB directly
  const msgId = sendData.message.id || sendData.message._id;
  const savedMsg = await Message.findById(msgId);
  assert.ok(savedMsg, 'Message should exist in DB');
});

test('Messaging: Fetch chat history between User A and User B', async () => {
  // Send 2 messages
  await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({ receiverId: userBId, content: 'Message 1' }),
  });
  await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userBToken}` },
    body: JSON.stringify({ receiverId: userAId, content: 'Message 2' }),
  });

  // Fetch as User A
  const historyRes = await fetch(`${baseUrl}/messages/${userBId}`, {
    headers: { Authorization: `Bearer ${userAToken}` },
  });

  assert.equal(historyRes.status, 200);
  const data = await historyRes.json();
  assert.equal(data.messages.length, 2);
  assert.equal(data.messages[0].content, 'Message 1');
  assert.equal(data.messages[1].content, 'Message 2');
});

test('Messaging: Mark messages as read updates status', async () => {
  // User A sends message to User B
  const sendRes = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({ receiverId: userBId, content: 'Please read me' }),
  });
  const { message } = await sendRes.json();
  const msgId = message.id || message._id;

  // User B marks messages from User A as read
  const readRes = await fetch(`${baseUrl}/messages/${userAId}/read`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${userBToken}` },
  });

  assert.equal(readRes.status, 200);
  const readData = await readRes.json();
  assert.equal(readData.success, true);

  // Verify message status is 'read' in DB
  const updatedMsg = await Message.findById(msgId);
  assert.equal(updatedMsg.status, 'read');
});

test('Messaging: Edit message allows author and rejects unauthorized user', async () => {
  // User A sends message
  const sendRes = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({ receiverId: userBId, content: 'Original content' }),
  });
  const { message } = await sendRes.json();
  const msgId = message.id || message._id;

  // User C (unauthorized) attempts to edit User A's message
  const hackRes = await fetch(`${baseUrl}/messages/${msgId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userCToken}` },
    body: JSON.stringify({ content: 'Tampered by Hacker' }),
  });
  assert.equal(hackRes.status, 403, 'Unauthorized user should be rejected with 403');

  // User A (author) edits their own message
  const editRes = await fetch(`${baseUrl}/messages/${msgId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({ content: 'Corrected content' }),
  });
  assert.equal(editRes.status, 200);
  const editData = await editRes.json();
  assert.equal(editData.content, 'Corrected content');
  assert.equal(editData.isEdited, true);
});

test('Messaging: Delete message allows author and rejects non-author', async () => {
  // User A sends message
  const sendRes = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({ receiverId: userBId, content: 'Delete me soon' }),
  });
  const { message } = await sendRes.json();
  const msgId = message.id || message._id;

  // User B (receiver, but NOT author) attempts to delete User A's message
  const unauthDelRes = await fetch(`${baseUrl}/messages/${msgId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userBToken}` },
  });
  assert.equal(unauthDelRes.status, 403, 'Receiver cannot delete sender message');

  // User A (author) deletes their own message
  const authDelRes = await fetch(`${baseUrl}/messages/${msgId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  assert.equal(authDelRes.status, 200);

  // Verify message is removed from DB
  const deletedMsg = await Message.findById(msgId);
  assert.equal(deletedMsg, null, 'Message should be deleted from DB');
});

test('Messaging: Clear chat history removes all messages between two users', async () => {
  await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({ receiverId: userBId, content: 'Msg 1' }),
  });
  await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userBToken}` },
    body: JSON.stringify({ receiverId: userAId, content: 'Msg 2' }),
  });

  const clearRes = await fetch(`${baseUrl}/messages/clear-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({ peerId: userBId }),
  });
  assert.equal(clearRes.status, 200);

  // Verify chat history is now empty
  const historyRes = await fetch(`${baseUrl}/messages/${userBId}`, {
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  const data = await historyRes.json();
  assert.equal(data.messages.length, 0);
});
