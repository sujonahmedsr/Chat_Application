const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  toggleBlockUser,
  deleteUser,
  updateSystemSettings,
} = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

router.use(authenticate, requireAdmin);

router.get('/users', getAllUsers);
router.post('/users/:userId/toggle-block', toggleBlockUser);
router.delete('/users/:userId', deleteUser);
router.post('/settings', updateSystemSettings);

module.exports = router;
