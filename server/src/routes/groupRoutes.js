const express = require('express');
const router = express.Router();
const { createGroup, getUserGroups, getGroupMessages } = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/', createGroup);
router.get('/', getUserGroups);
router.get('/:groupId/messages', getGroupMessages);

module.exports = router;
