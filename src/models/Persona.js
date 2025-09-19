const mongoose = require('mongoose');

const personaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  isActive: {
    type: Boolean,
    default: false
  },
  // Content Details
  contentNiche: {
    type: String,
    required: true,
    enum: [
      'food', 'fashion', 'tech', 'lifestyle', 'comedy', 'education', 
      'dance', 'beauty', 'fitness', 'travel', 'music', 'art', 
      'business', 'motivation', 'gaming', 'diy', 'pets', 'other'
    ]
  },
  platformPriority: {
    type: String,
    required: true,
    enum: ['instagram_reels', 'tiktok', 'both_equally']
  },
  contentStyle: {
    type: String,
    required: true,
    enum: [
      'trendy_viral', 'educational', 'behind_scenes', 'product_showcase',
      'storytelling', 'tutorial', 'entertainment', 'inspirational'
    ]
  },
  videoDurationPreference: {
    type: String,
    required: true,
    enum: ['15s', '30s', '60s', 'mixed']
  },
  
  // Audience Details
  targetAudience: {
    ageGroup: {
      type: String,
      required: true,
      enum: ['gen_z_16_24', 'millennial_25_40', 'mixed_16_40']
    },
    interests: [{
      type: String,
      maxlength: 30
    }],
    location: {
      type: String,
      default: 'indonesia'
    }
  },
  
  // Brand Voice & Goals
  brandVoice: {
    type: String,
    required: true,
    enum: ['fun_energetic', 'professional', 'relatable', 'inspirational', 'humorous']
  },
  contentGoals: [{
    type: String,
    enum: ['viral_reach', 'brand_awareness', 'product_sales', 'community_building', 'education', 'entertainment']
  }],
  
  // Platform Specific Settings
  instagramSettings: {
    hashtagStrategy: {
      type: String,
      enum: ['trending_focused', 'niche_specific', 'mixed_approach'],
      default: 'mixed_approach'
    },
    musicPreference: {
      type: String,
      enum: ['trending_songs', 'original_sounds', 'no_preference'],
      default: 'trending_songs'
    }
  },
  tiktokSettings: {
    challengeParticipation: {
      type: Boolean,
      default: true
    },
    duetFriendly: {
      type: Boolean,
      default: true
    },
    trendingHashtags: {
      type: Boolean,
      default: true
    }
  },
  
  // Additional Context
  description: {
    type: String,
    maxlength: 200,
    trim: true
  },
  keyTopics: [{
    type: String,
    maxlength: 30
  }],
  
  // Usage Statistics
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
personaSchema.index({ userId: 1, isActive: 1 });
personaSchema.index({ userId: 1, createdAt: -1 });

// Ensure only one active persona per user
personaSchema.pre('save', async function(next) {
  if (this.isActive && this.isModified('isActive')) {
    // Deactivate other personas for this user
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isActive: false }
    );
  }
  next();
});

// Virtual for formatted age group
personaSchema.virtual('formattedAgeGroup').get(function() {
  const ageGroupMap = {
    'gen_z_16_24': 'Gen Z (16-24)',
    'millennial_25_40': 'Millennial (25-40)',
    'mixed_16_40': 'Mixed (16-40)'
  };
  return ageGroupMap[this.targetAudience.ageGroup] || this.targetAudience.ageGroup;
});

// Virtual for formatted platform
personaSchema.virtual('formattedPlatform').get(function() {
  const platformMap = {
    'instagram_reels': 'Instagram Reels',
    'tiktok': 'TikTok',
    'both_equally': 'Both Equally'
  };
  return platformMap[this.platformPriority] || this.platformPriority;
});

// Method to increment usage
personaSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

// Static method to get active persona for user
personaSchema.statics.getActivePersona = function(userId) {
  return this.findOne({ userId, isActive: true });
};

// Static method to get all personas for user
personaSchema.statics.getUserPersonas = function(userId) {
  return this.find({ userId }).sort({ isActive: -1, lastUsedAt: -1 });
};

module.exports = mongoose.model('Persona', personaSchema);
