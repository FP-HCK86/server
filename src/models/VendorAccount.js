const mongoose = require('mongoose');

const vendorAccountSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  platform: {
    type: String,
    enum: ['instagram', 'tiktok'],
    required: true
  },
  vendor_profile_id: {
    type: String,
    required: true
  },
  connected: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for lookup
vendorAccountSchema.index({ user_id: 1, platform: 1 });

module.exports = mongoose.model('VendorAccount', vendorAccountSchema);
