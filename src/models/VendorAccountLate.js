const mongoose = require('mongoose');

/**
 * Represents a social account connected via Late for a specific user.
 *
 * Each document corresponds to a single social media account (e.g. an
 * Instagram account or TikTok account) that has been authorised via
 * Late. The combination of user_id and platform must be unique; if a user
 * reconnects the same platform the document will be updated rather than
 * creating a duplicate.
 */
const VendorAccountSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /**
     * The social media platform this account belongs to. Supported
     * platforms include 'tiktok', 'instagram', 'facebook', etc. See
     * Late documentation for full list.
     */
    platform: { type: String, required: true },
    /**
     * The identifier of the Late profile that owns this account. A profile
     * groups multiple social accounts under one umbrella.
     */
    vendor_profile_id: { type: String, required: true },
    /**
     * The identifier of the account within Late (returned from
     * GET /accounts). This ID is used when scheduling or publishing posts.
     */
    vendor_account_id: { type: String },
    /**
     * Username of the social account (e.g. @exampleuser). Stored for display
     * purposes and to make it easy to target specific accounts.
     */
    username: { type: String },
    /**
     * Optional display name of the account (if provided by Late), such as
     * the channel name on TikTok.
     */
    display_name: { type: String },
    /**
     * When the token provided to Late expires. Useful to determine when
     * reauthorisation is required.
     */
    token_expires_at: { type: Date },
    /**
     * Whether the account is currently active according to Late (i.e. the
     * token has not yet expired and the account is still authorised).
     */
    is_active: { type: Boolean, default: false },
    /**
     * Flag indicating whether the account has been connected by the user.
     */
    connected: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Ensure a user cannot have duplicate records for the same platform.
VendorAccountSchema.index({ user_id: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model('VendorAccount', VendorAccountSchema);