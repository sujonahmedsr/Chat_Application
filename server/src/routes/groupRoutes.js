const express = require('express');
const router = express.Router();
const {
  createGroup,
  getUserGroups,
  getGroupMessages,
  clearGroupMessages,
  deleteGroup,
  addGroupMembers,
  removeGroupMember,
} = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/', createGroup);
router.get('/', getUserGroups);
router.get('/:groupId/messages', getGroupMessages);
router.post('/:groupId/clear-messages', clearGroupMessages);
router.delete('/:groupId', deleteGroup);
router.post('/:groupId/members', addGroupMembers);
router.delete('/:groupId/members/:userId', removeGroupMember);

module.exports = router;
