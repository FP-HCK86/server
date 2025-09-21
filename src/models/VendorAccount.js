const mongoose = require('mongoose');

const vendorAccountSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: ['instagram', 'tiktok'], required: true },
  vendor_profile_id: { type: String, required: true }, // Late profileId
  vendor_account_id: { type: String },                 // Late account _id
  username: { type: String },
  display_name: { type: String },
  profile_picture: { type: String },
  token_expires_at: { type: Date },
  permissions: { type: [String], default: [] },
  is_active: { type: Boolean, default: true },
  connected: { type: Boolean, default: true }
}, { timestamps: true });

// Index for lookup
vendorAccountSchema.index({ user_id: 1, platform: 1 });
vendorAccountSchema.index({ vendor_account_id: 1 });

module.exports = mongoose.model('VendorAccount', vendorAccountSchema);
