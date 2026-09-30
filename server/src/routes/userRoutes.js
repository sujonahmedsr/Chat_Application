const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, updateProfile, uploadAvatarOnly, deleteProfile } = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getAllUsers);
router.put('/profile', updateProfile);
router.delete('/profile', deleteProfile);
router.post('/avatar', uploadAvatarOnly);
router.get('/:id', getUserById);

module.exports = router;

