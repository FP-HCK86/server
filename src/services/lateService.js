const axiosClient = require('../config/axiosClient');

/**
 * Service wrapper around the Late (GetLate) API.
 *
 * This service exposes helper methods for interacting with the Late API
 * such as creating profiles, retrieving connected social accounts, scheduling
 * posts and publishing immediately. By centralising these calls you avoid
 * duplicating axios configuration and make it easier to mock in tests.
 *
 * All requests are made through the configured axiosClient instance which
 * automatically injects the Authorization header containing your Late API key.
 *
 * See https://getlate.dev/docs for detailed API reference.
 */
class LateService {
  /**
   * Create a new Late profile. A profile is a container for multiple
   * social media accounts (e.g. TikTok, Instagram) belonging to a single user.
   *
   * @param {string} name Human friendly name for the profile (e.g. user ID)
   * @returns {Promise<Object>} The created profile object
   */
  async createProfile(name) {
    const response = await axiosClient.post('/profiles', { name });
    return response.data.profile;
  }

  /**
   * Return all social accounts connected to a given Late profile.
   *
   * @param {string} profileId The Late profile identifier
   * @returns {Promise<Array>} Array of account objects
   */
  async getAccounts(profileId) {
    const response = await axiosClient.get('/accounts', { params: { profileId } });
    return response.data.accounts;
  }

  /**
   * Schedule a post for a future date/time.
   *
   * The platforms argument should be an array of objects with keys:
   * { platform: 'instagram' | 'tiktok', accountId: <Late account id> }.
   * The scheduledFor argument should be an ISO 8601 date string in UTC or
   * a local date/time string accompanied by a timezone in the options.
   *
   * @param {Object} options
   * @param {string} options.content The textual content of the post
   * @param {Array} [options.mediaItems] Array of media items with {type,url}
   * @param {Array} options.platforms Target platforms with accountId
   * @param {string} options.scheduledFor ISO 8601 date/time
   * @param {string} [options.timezone] Optional timezone (e.g. "Asia/Jakarta")
   * @returns {Promise<Object>} The created post object from Late
   */
  async schedulePost({ content, mediaItems = [], platforms, scheduledFor, timezone }) {
    const payload = {
      content,
      platforms,
    };
    if (mediaItems.length > 0) {
      payload.mediaItems = mediaItems;
    }
    if (scheduledFor) {
      payload.scheduledFor = scheduledFor;
    }
    if (timezone) {
      payload.timezone = timezone;
    }

    const response = await axiosClient.post('/posts', payload);
    return response.data;
  }

  /**
   * Immediately publish a post to the specified platforms.
   *
   * If you want the post to go out right away rather than at a scheduled time,
   * set the publishNow flag on the request body. The platforms argument
   * should be an array of { platform, accountId } objects.
   *
   * @param {Object} options
   * @param {string} options.content The textual content of the post
   * @param {Array} [options.mediaItems] Array of media items with {type,url}
   * @param {Array} options.platforms Target platforms with accountId
   * @returns {Promise<Object>} The created post object from Late
   */
  async publishNow({ content, mediaItems = [], platforms }) {
    const payload = {
      content,
      platforms,
      publishNow: true,
    };
    if (mediaItems.length > 0) {
      payload.mediaItems = mediaItems;
    }

    const response = await axiosClient.post('/posts', payload);
    return response.data;
  }
}

module.exports = new LateService();