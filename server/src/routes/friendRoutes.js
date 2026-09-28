const express = require('express');
const router = express.Router();
const {
  getFriends,
  getPendingRequests,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
} = require('../controllers/friendController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getFriends);
router.get('/requests', getPendingRequests);
router.get('/search', searchUsers);
router.post('/request/:userId', sendFriendRequest);
router.post('/accept/:userId', acceptFriendRequest);
router.post('/reject/:userId', rejectFriendRequest);

module.exports = router;
