const env = require('./env');

module.exports = {
  /**
   * Base URL for the Late (GetLate) API. You can override this via the
   * LATE_BASE_URL environment variable. Do not include a trailing slash.
   */
  LATE_BASE_URL: env.late.baseUrl,

  /**
   * API Key for Late service authentication
   */
  LATE_API_KEY: env.late.apiKey,

  /**
   * Optional callback URLs for TikTok and Instagram OAuth flows. When
   * constructing the connect URL you can override the automatically
   * computed callback with these variables. If not set, the controller
   * builds the callback URL from the incoming request context.
   */
  TIKTOK_CALLBACK_URL: env.late.tiktokCallbackUrl,
  INSTAGRAM_CALLBACK_URL: env.late.instagramCallbackUrl,

  /**
   * Webhook secret for Late callbacks
   */
  WEBHOOK_SECRET: env.late.webhookSecret,
};