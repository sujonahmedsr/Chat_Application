const express = require('express');
const router = express.Router();
const {
  createGroup,
  getUserGroups,
  getGroupMessages,
  clearGroupMessages,
  deleteGroup,
} = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/', createGroup);
router.get('/', getUserGroups);
router.get('/:groupId/messages', getGroupMessages);
router.post('/:groupId/clear-messages', clearGroupMessages);
router.delete('/:groupId', deleteGroup);

module.exports = router;
