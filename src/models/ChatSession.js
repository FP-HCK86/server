const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant', 'system']
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const chatSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  messages: [messageSchema],
  persona: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Persona',
    default: null
  },
  generatedContent: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  preview: {
    type: String,
    maxlength: 200,
    default: ''
  },
  messageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for performance
chatSessionSchema.index({ userId: 1, createdAt: -1 });
chatSessionSchema.index({ userId: 1, persona: 1 });

// Update messageCount before saving
chatSessionSchema.pre('save', function(next) {
  this.messageCount = this.messages.length;
  
  // Set preview from first user message if not set
  if (!this.preview && this.messages.length > 0) {
    const firstUserMessage = this.messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      this.preview = firstUserMessage.content.substring(0, 100);
    }
  }
  
  next();
});

// Static method to get user's chat sessions
chatSessionSchema.statics.getUserSessions = function(userId, limit = 20) {
  return this.find({ userId })
    .populate('persona', 'name contentNiche')
    .sort({ updatedAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('ChatSession', chatSessionSchema);
