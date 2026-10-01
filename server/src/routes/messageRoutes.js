const express = require('express');
const router = express.Router();
const {
  getChatHistory,
  markMessagesAsRead,
  sendMessage,
  deleteMessage,
  updateMessage,
  clearChatHistory,
} = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:userId', getChatHistory);
router.put('/:userId/read', markMessagesAsRead);
router.post('/', sendMessage);
router.put('/:id', updateMessage);
router.delete('/:id', deleteMessage);
router.post('/clear-history', clearChatHistory);

module.exports = router;
