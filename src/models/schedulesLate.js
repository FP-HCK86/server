const mongoose = require('mongoose');

/**
 * Represents a scheduled social post within our application. Each
 * Schedule document stores metadata about the post content, target
 * platforms, scheduled publish time, and references to Late job IDs.
 */
const ScheduleSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /**
     * The textual content of the post. This may include hashtags and
     * mentions. Do not include media URLs here; store them separately
     * in media_urls.
     */
    content: { type: String, required: true },
    /**
     * Array of media URLs associated with this post. These should
     * correspond to objects uploaded to Late via the /media endpoint.
     */
    media_urls: [String],
    /**
     * Array of target platform names (e.g. ['instagram','tiktok']). When
     * scheduling a post via Late you must also specify the Late account
     * identifier for each platform; those are stored in VendorAccount.
     */
    platforms: [String],
    /**
     * The time (in UTC) when the post should be published. If null
     * then the post should be published immediately.
     */
    scheduled_at: { type: Date, required: true },
    /**
     * The Late profile identifier associated with this post. Used to
     * correlate schedules with a specific Late profile.
     */
    vendor_profile_id: { type: String, required: true },
    /**
     * The job identifier returned from Late when scheduling or publishing a
     * post. Use this to query Late for post status updates.
     */
    vendor_job_id: { type: String },
    /**
     * The publication status of the post within our application. Possible
     * values are 'scheduled' (default), 'posted' or 'failed'. Status
     * should be updated based on Late webhook events or polling.
     */
    status: {
      type: String,
      enum: ['scheduled', 'posted', 'failed'],
      default: 'scheduled',
    },
    /**
     * Optional error message if publishing fails. Useful for debugging
     * when Late returns an error or if our cron job encounters issues.
     */
    error: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Schedule', ScheduleSchema);