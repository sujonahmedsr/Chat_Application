const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    passwordHash: {
      type: String,
      default: '',
    },
    username: {
      type: String,
      trim: true,
      default: '',
    },
    googleId: {
      type: String,
      default: '',
      sparse: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    settings: {
      saveChatHistory: {
        type: Boolean,
        default: true,
      },
      chatRetentionDays: {
        type: Number,
        default: 15,
      },
      hasCompletedSetup: {
        type: Boolean,
        default: false,
      },
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    // Friend Request & Contacts System
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    friendRequests: [
      {
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    sentRequests: [
      {
        to: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Blocked users
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Admin Controls
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isBlockedByAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

userSchema.index({ isOnline: 1 });
userSchema.index({ friends: 1 });

userSchema.pre('save', function (next) {
  if (this.email) {
    this.username = this.email.split('@')[0];
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
