const express = require('express');
const router = express.Router();
const { getChatHistory, markMessagesAsRead, sendMessage } = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:userId', getChatHistory);
router.put('/:userId/read', markMessagesAsRead);
router.post('/', sendMessage);

module.exports = router;
