const moment = require('moment-timezone');
const lateService = require('../services/lateService');
const VendorAccount = require('../models/VendorAccount');
const Schedule = require('../models/Schedule');

/**
 * Controller to schedule or immediately publish a social post via Late.
 *
 * It constructs the appropriate payload for Late based on the supplied
 * parameters, resolves the user's connected accounts for each platform,
 * invokes Late and persists a Schedule record. The request body should
 * include:
 *   - content: string (required)
 *   - mediaUrls: array of strings (optional)
 *   - platforms: array of platform strings (optional). If omitted or
 *                contains 'all', all connected platforms will be used.
 *   - scheduledTime: ISO 8601 date/time (optional). If omitted the post
 *                    will be published immediately.
 *
 * This endpoint assumes that req.user has been populated via an
 * authentication middleware.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.schedulePost = async function schedulePost(req, res) {
  try {
    const userId = req.user._id;
    const { content, mediaUrls = [], platforms = [], scheduledTime } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Retrieve all vendor accounts for the user
    let connectedAccounts = await VendorAccount.find({ user_id: userId, connected: true });
    if (!connectedAccounts.length) {
      return res.status(400).json({ error: 'No connected social accounts found' });
    }

    // Filter accounts by requested platforms if provided
    let accountsToUse;
    if (platforms.length && !platforms.includes('all')) {
      accountsToUse = connectedAccounts.filter((acc) => platforms.includes(acc.platform));
      if (!accountsToUse.length) {
        return res.status(400).json({ error: 'No connected accounts match the specified platforms' });
      }
    } else {
      accountsToUse = connectedAccounts;
    }

    // Build Late platforms array: { platform, accountId }
    const latePlatforms = accountsToUse.map((acc) => ({
      platform: acc.platform,
      accountId: acc.vendor_account_id,
    }));

    // Derive profileId from the first account (all accounts share the same profile)
    const profileId = accountsToUse[0].vendor_profile_id;

    // Build mediaItems from mediaUrls. Determine type by file extension.
    const mediaItems = mediaUrls.map((url) => {
      const lower = url.toLowerCase();
      const isVideo = /\.(mp4|mov|m4v|avi|wmv)$/i.test(lower);
      return { type: isVideo ? 'video' : 'image', url };
    });

    let lateResponse;
    let scheduledAt;
    if (scheduledTime) {
      // Convert scheduledTime (assumed ISO string or local time) to UTC ISO for Late
      // Use moment-timezone to handle Asia/Jakarta timezone properly
      const tzTime = moment.tz(scheduledTime, 'Asia/Jakarta');
      scheduledAt = tzTime.toDate();
      lateResponse = await lateService.schedulePost({
        content,
        mediaItems,
        platforms: latePlatforms,
        scheduledFor: tzTime.toISOString(),
        timezone: 'Asia/Jakarta',
      });
    } else {
      // Publish immediately
      lateResponse = await lateService.publishNow({
        content,
        mediaItems,
        platforms: latePlatforms,
      });
      scheduledAt = new Date();
    }

    // Persist the schedule in our database
    const newSchedule = new Schedule({
      user_id: userId,
      content,
      media_urls: mediaUrls,
      platforms: accountsToUse.map((acc) => acc.platform),
      scheduled_at: scheduledAt,
      vendor_profile_id: profileId,
      vendor_job_id: lateResponse.id,
      status: scheduledTime ? 'scheduled' : 'posted',
    });
    await newSchedule.save();

    return res.json({
      message: scheduledTime ? 'Post scheduled successfully' : 'Post published successfully',
      latePostId: lateResponse.id,
      scheduledFor: scheduledAt,
    });
  } catch (err) {
    console.error('Error scheduling/publishing post:', err);
    return res.status(500).json({ error: 'Failed to schedule or publish post' });
  }
};