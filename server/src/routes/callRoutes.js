const express = require('express');
const router = express.Router();
const { getCallLogs, createCallLog } = require('../controllers/callController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/logs', getCallLogs);
router.post('/logs', createCallLog);

module.exports = router;
