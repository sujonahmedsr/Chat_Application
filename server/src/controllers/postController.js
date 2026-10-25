const Post = require('../models/Post');
const User = require('../models/User');
const { uploadFeedImage } = require('../utils/imageUpload');
const { isSuperAdminEmail } = require('../utils/superAdmin');

const extractHashtags = (text) => {
  if (!text) return [];
  const matches = text.match(/#([a-zA-Z0-9_\u0980-\u09FF]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
};

const formatPostForUser = (post, currentUserId) => {
  const json = post.toJSON ? post.toJSON() : { ...post };
  const uidStr = String(currentUserId || '');

  const likesArray = json.likes || [];
  const dislikesArray = json.dislikes || [];
  const commentsArray = json.comments || [];

  return {
    ...json,
    likesCount: likesArray.length,
    dislikesCount: dislikesArray.length,
    commentsCount: commentsArray.length,
    isLiked: likesArray.some((id) => String(id) === uidStr),
    isDisliked: dislikesArray.some((id) => String(id) === uidStr),
    privacy: json.privacy || 'public',
    comments: commentsArray.map((c) => {
      const cJson = c.toJSON ? c.toJSON() : { ...c };
      return {
        ...cJson,
        id: cJson.id || cJson._id,
      };
    }),
  };
};

// GET /api/posts - Fetch public news feed or filtered "My Posts" (Strict Privacy Enforced)
const getPosts = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user._id : null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filterQuery = {};
    if (req.query.filter === 'my' && currentUserId) {
      filterQuery.author = currentUserId;
    } else if (req.query.authorId) {
      filterQuery.author = req.query.authorId;
    }

    if (req.query.tag) {
      const tagQuery = req.query.tag.startsWith('#')
        ? req.query.tag.toLowerCase()
        : `#${req.query.tag.toLowerCase()}`;
      filterQuery.tags = tagQuery;
    }

    // PRIVACY ENFORCEMENT: Private posts can ONLY be seen by their author
    const privacyCondition = {
      $or: [
        { privacy: 'public' },
        { privacy: { $exists: false } },
        ...(currentUserId ? [{ author: currentUserId }] : []),
      ],
    };

    const finalQuery = {
      $and: [filterQuery, privacyCondition],
    };

    const posts = await Post.find(finalQuery)
      .populate('author', 'name email avatar bio isOnline lastSeen role')
      .populate('comments.user', 'name email avatar role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments(finalQuery);
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

// GET /api/posts/tags/trending - Real hashtags aggregated from actual posts (NO dummy data)
const getTrendingTags = async (req, res, next) => {
  try {
    const tags = await Post.aggregate([
      { $match: { tags: { $exists: true, $ne: [] }, privacy: { $ne: 'private' } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const formatted = tags.map((t) => ({
      tag: t._id,
      count: t.count,
    }));

    return res.status(200).json({
      success: true,
      tags: formatted,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/posts - Create a new feed post (Blog / Facebook style with Privacy)
const createPost = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { title, content, image, tags, privacy } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Post content cannot be empty' });
    }

    let imageUrl = '';
    if (image && typeof image === 'string') {
      imageUrl = await uploadFeedImage(image, 'shofi_chat_feed');
    }

    const postPrivacy = privacy === 'private' ? 'private' : 'public';

    // Combine explicit tags with extracted hashtags from content and title
    const contentTags = extractHashtags(`${title || ''} ${content}`);
    const inputTags = Array.isArray(tags)
      ? tags.map((t) => (t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`))
      : [];
    const mergedTags = [...new Set([...inputTags, ...contentTags])];

    const post = await Post.create({
      author: currentUserId,
      title: title ? title.trim() : '',
      content: content.trim(),
      tags: mergedTags,
      imageUrl,
      privacy: postPrivacy,
      likes: [],
      dislikes: [],
      comments: [],
    });

    const populated = await Post.findById(post._id)
      .populate('author', 'name email avatar bio isOnline lastSeen role')
      .populate('comments.user', 'name email avatar role');

    const formatted = formatPostForUser(populated, currentUserId);

    // Only broadcast to everyone if public! Private posts stay private to author
    if (postPrivacy === 'public') {
      try {
        const { getIO } = require('../sockets/socketManager');
        getIO().emit('post:created', formatted);
      } catch (e) {}
    }

    return res.status(201).json({
      success: true,
      post: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/posts/:id - Edit an existing post (Author only)
const updatePost = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id: postId } = req.params;
    const { title, content, image, tags, privacy } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Post content cannot be empty' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const isAuthor = String(post.author) === String(currentUserId);
    const isSuper = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';

    if (!isAuthor && !isSuper) {
      return res.status(403).json({ message: 'Unauthorized to edit this post' });
    }

    post.content = content.trim();
    if (title !== undefined) {
      post.title = title ? title.trim() : '';
    }

    if (privacy !== undefined) {
      post.privacy = privacy === 'private' ? 'private' : 'public';
    }

    const contentTags = extractHashtags(`${post.title} ${post.content}`);
    const inputTags = Array.isArray(tags)
      ? tags.map((t) => (t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`))
      : post.tags || [];
    post.tags = [...new Set([...inputTags, ...contentTags])];

    post.isEdited = true;
    post.editedAt = new Date();

    if (image !== undefined) {
      if (image && typeof image === 'string' && !image.startsWith('http')) {
        post.imageUrl = await uploadFeedImage(image, 'shofi_chat_feed');
      } else if (image === '') {
        post.imageUrl = '';
      }
    }

    await post.save();

    const populated = await Post.findById(post._id)
      .populate('author', 'name email avatar bio isOnline lastSeen role')
      .populate('comments.user', 'name email avatar role');

    const formatted = formatPostForUser(populated, currentUserId);

    // Broadcast edit in real-time if public
    if (formatted.privacy === 'public') {
      try {
        const { getIO } = require('../sockets/socketManager');
        getIO().emit('post:updated', formatted);
      } catch (e) {}
    }

    return res.status(200).json({
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
      post.likes = post.likes.filter((id) => String(id) !== String(currentUserId));
    } else {
      post.likes.addToSet(currentUserId);
      post.dislikes = post.dislikes.filter((id) => String(id) !== String(currentUserId));
    }

    await post.save();

    const populated = await Post.findById(post._id)
      .populate('author', 'name email avatar bio isOnline lastSeen role')
      .populate('comments.user', 'name email avatar role');
    const formatted = formatPostForUser(populated, currentUserId);

    if (post.privacy !== 'private') {
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
    }

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
      post.dislikes = post.dislikes.filter((id) => String(id) !== String(currentUserId));
    } else {
      post.dislikes.addToSet(currentUserId);
      post.likes = post.likes.filter((id) => String(id) !== String(currentUserId));
    }

    await post.save();

    const populated = await Post.findById(post._id)
      .populate('author', 'name email avatar bio isOnline lastSeen role')
      .populate('comments.user', 'name email avatar role');
    const formatted = formatPostForUser(populated, currentUserId);

    if (post.privacy !== 'private') {
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
    }

    return res.status(200).json({
      success: true,
      post: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/posts/:id/comments - Add a comment to a post
const addComment = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id: postId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content cannot be empty' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    post.comments.push({
      user: currentUserId,
      content: content.trim(),
    });

    await post.save();

    const populated = await Post.findById(post._id)
      .populate('author', 'name email avatar bio isOnline lastSeen role')
      .populate('comments.user', 'name email avatar role');

    const formatted = formatPostForUser(populated, currentUserId);
    const addedComment = formatted.comments[formatted.comments.length - 1];

    if (post.privacy !== 'private') {
      try {
        const { getIO } = require('../sockets/socketManager');
        getIO().emit('post:comment:added', {
          postId: String(post._id),
          comment: addedComment,
          commentsCount: formatted.commentsCount,
        });
      } catch (e) {}
    }

    return res.status(201).json({
      success: true,
      post: formatted,
      comment: addedComment,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/posts/:id/comments/:commentId - Delete a comment
const deleteComment = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id: postId, commentId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const isCommentAuthor = String(comment.user) === String(currentUserId);
    const isPostAuthor = String(post.author) === String(currentUserId);
    const isSuper = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';

    if (!isCommentAuthor && !isPostAuthor && !isSuper) {
      return res.status(403).json({ message: 'Unauthorized to delete this comment' });
    }

    post.comments.pull({ _id: commentId });
    await post.save();

    if (post.privacy !== 'private') {
      try {
        const { getIO } = require('../sockets/socketManager');
        getIO().emit('post:comment:deleted', {
          postId: String(post._id),
          commentId: String(commentId),
          commentsCount: post.comments.length,
        });
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
      commentId,
      commentsCount: post.comments.length,
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
  getTrendingTags,
  createPost,
  updatePost,
  toggleLike,
  toggleDislike,
  addComment,
  deleteComment,
  deletePost,
};
