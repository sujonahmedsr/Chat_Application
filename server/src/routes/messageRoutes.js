const express = require('express');
const router = express.Router();
const {
  getChatHistory,
  markMessagesAsRead,
  sendMessage,
  deleteMessage,
  clearChatHistory,
} = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:userId', getChatHistory);
router.put('/:userId/read', markMessagesAsRead);
router.post('/', sendMessage);
router.delete('/:id', deleteMessage);
router.post('/clear-history', clearChatHistory);

module.exports = router;
