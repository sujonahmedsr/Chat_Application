const express = require('express');
const router = express.Router();
const { getCallLogs, createCallLog, getIceServers } = require('../controllers/callController');
const { authenticate } = require('../middleware/auth');

// Public ICE servers endpoint for WebRTC STUN/TURN negotiation
router.get('/ice-servers', getIceServers);

router.use(authenticate);

router.get('/logs', getCallLogs);
router.post('/logs', createCallLog);

module.exports = router;
