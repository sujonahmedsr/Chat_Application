const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getPosts,
  createPost,
  toggleLike,
  toggleDislike,
  deletePost,
} = require('../controllers/postController');

// All post routes require authentication
router.use(authenticate);

router.get('/', getPosts);
router.post('/', createPost);
router.post('/:id/like', toggleLike);
router.post('/:id/dislike', toggleDislike);
router.delete('/:id', deletePost);

module.exports = router;
