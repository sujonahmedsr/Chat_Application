const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const {
  getAllUsers,
  toggleBlockUser,
  deleteUser,
} = require('../controllers/adminController');

// All routes require authentication and Super Admin privileges
router.use(authenticate);
router.use(requireAdmin);

router.get('/users', getAllUsers);
router.post('/users/:userId/toggle-block', toggleBlockUser);
router.delete('/users/:userId', deleteUser);

module.exports = router;
