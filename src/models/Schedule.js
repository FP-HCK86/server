const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  video_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  platform: {
    type: String,
    enum: ['instagram', 'tiktok'],
    required: true
  },
  caption: {
    type: String,
    required: true
  },
  hashtags: {
    type: String,
    default: ''
  },
  cover_time: {
    type: Number, // in seconds
    required: true
  },
  scheduled_at: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'posted', 'failed'],
    default: 'pending'
  },
  vendor: {
    type: String,
    default: 'late'
  },
  vendor_profile_id: {
    type: String,
    required: true
  },
  vendor_job_id: {
    type: String
  },
  external_post_id: {
    type: String
  },
  error: {
    type: String
  },
  locked_at: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
scheduleSchema.index({ status: 1, scheduled_at: 1 }); // Hot path for cron
scheduleSchema.index({ user_id: 1, scheduled_at: -1 }); // Calendar
scheduleSchema.index({ vendor_job_id: 1 }); // Webhook lookup

module.exports = mongoose.model('Schedule', scheduleSchema);
