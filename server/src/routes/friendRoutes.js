const express = require('express');
const router = express.Router();
const {
  getFriends,
  getPendingRequests,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriendUser,
  blockUser,
  unblockUser,
  getBlockedUsers,
} = require('../controllers/friendController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getFriends);
router.get('/requests', getPendingRequests);
router.get('/search', searchUsers);
router.get('/blocked', getBlockedUsers);
router.post('/request/:userId', sendFriendRequest);
router.post('/accept/:userId', acceptFriendRequest);
router.post('/reject/:userId', rejectFriendRequest);
router.post('/unfriend/:userId', unfriendUser);
router.post('/block/:userId', blockUser);
router.post('/unblock/:userId', unblockUser);

module.exports = router;
