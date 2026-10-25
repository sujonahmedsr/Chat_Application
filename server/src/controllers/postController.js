const Post = require('../models/Post');
const User = require('../models/User');
const { uploadFeedImage } = require('../utils/imageUpload');
const { isSuperAdminEmail } = require('../utils/superAdmin');

const formatPostForUser = (post, currentUserId) => {
  const json = post.toJSON ? post.toJSON() : { ...post };
  const uidStr = String(currentUserId || '');

  const likesArray = json.likes || [];
  const dislikesArray = json.dislikes || [];

  return {
    ...json,
    likesCount: likesArray.length,
    dislikesCount: dislikesArray.length,
    isLiked: likesArray.some((id) => String(id) === uidStr),
    isDisliked: dislikesArray.some((id) => String(id) === uidStr),
  };
};

// GET /api/posts - Fetch public news feed
const getPosts = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user._id : null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate('author', 'name email avatar bio isOnline lastSeen role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments();
    const formatted = posts.map((p) => formatPostForUser(p, currentUserId));

    return res.status(200).json({
      success: true,
      posts: formatted,
      total: totalPosts,
      hasMore: skip + posts.length < totalPosts,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/posts - Create a new feed post
const createPost = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { content, image } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Post content cannot be empty' });
    }

    let imageUrl = '';
    if (image && typeof image === 'string') {
      imageUrl = await uploadFeedImage(image, 'shofi_chat_feed');
    }

    const post = await Post.create({
      author: currentUserId,
      content: content.trim(),
      imageUrl,
      likes: [],
      dislikes: [],
    });

    const populated = await Post.findById(post._id).populate(
      'author',
      'name email avatar bio isOnline lastSeen role'
    );

    const formatted = formatPostForUser(populated, currentUserId);

    // Broadcast new post in real-time to all connected users
    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().emit('post:created', formatted);
    } catch (e) {
      // socket might be off in tests
    }

    return res.status(201).json({
      success: true,
      post: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/posts/:id/like - Toggle Like on a post
const toggleLike = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id: postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const hasLiked = post.likes.some((id) => String(id) === String(currentUserId));

    if (hasLiked) {
      // Remove like
      post.likes = post.likes.filter((id) => String(id) !== String(currentUserId));
    } else {
      // Add like and remove dislike if present
      post.likes.addToSet(currentUserId);
      post.dislikes = post.dislikes.filter((id) => String(id) !== String(currentUserId));
    }

    await post.save();

    const populated = await Post.findById(post._id).populate(
      'author',
      'name email avatar bio isOnline lastSeen role'
    );
    const formatted = formatPostForUser(populated, currentUserId);

    // Broadcast reaction update
    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().emit('post:reacted', {
        postId: String(post._id),
        likesCount: post.likes.length,
        dislikesCount: post.dislikes.length,
        action: hasLiked ? 'unliked' : 'liked',
        userId: String(currentUserId),
      });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      post: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/posts/:id/dislike - Toggle Dislike on a post
const toggleDislike = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id: postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const hasDisliked = post.dislikes.some((id) => String(id) === String(currentUserId));

    if (hasDisliked) {
      // Remove dislike
      post.dislikes = post.dislikes.filter((id) => String(id) !== String(currentUserId));
    } else {
      // Add dislike and remove like if present
      post.dislikes.addToSet(currentUserId);
      post.likes = post.likes.filter((id) => String(id) !== String(currentUserId));
    }

    await post.save();

    const populated = await Post.findById(post._id).populate(
      'author',
      'name email avatar bio isOnline lastSeen role'
    );
    const formatted = formatPostForUser(populated, currentUserId);

    // Broadcast reaction update
    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().emit('post:reacted', {
        postId: String(post._id),
        likesCount: post.likes.length,
        dislikesCount: post.dislikes.length,
        action: hasDisliked ? 'undisliked' : 'disliked',
        userId: String(currentUserId),
      });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      post: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/posts/:id - Delete a post (Author or Super Admin only)
const deletePost = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id: postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const isAuthor = String(post.author) === String(currentUserId);
    const isSuper = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';

    if (!isAuthor && !isSuper) {
      return res.status(403).json({ message: 'Unauthorized to delete this post' });
    }

    await Post.findByIdAndDelete(postId);

    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().emit('post:deleted', { postId: String(postId) });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
      postId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPosts,
  createPost,
  toggleLike,
  toggleDislike,
  deletePost,
};
