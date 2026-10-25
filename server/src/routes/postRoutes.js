const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getPosts,
  createPost,
  updatePost,
  toggleLike,
  toggleDislike,
  addComment,
  deleteComment,
  deletePost,
} = require('../controllers/postController');

// All post routes require authentication
router.use(authenticate);

router.get('/', getPosts);
router.post('/', createPost);
router.put('/:id', updatePost);
router.post('/:id/like', toggleLike);
router.post('/:id/dislike', toggleDislike);
router.post('/:id/comments', addComment);
router.delete('/:id/comments/:commentId', deleteComment);
router.delete('/:id', deletePost);

module.exports = router;
