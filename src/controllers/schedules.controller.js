const Schedule = require('../models/Schedule');
const VendorAccount = require('../models/VendorAccount');

const createSchedule = async (req, res) => {
  try {
    const { video_id, platform, caption, hashtags, cover_time, scheduled_at } = req.body;
    const user_id = req.user.id; // Assuming JWT payload has id

    // Validate required fields
    if (!video_id || !platform || !caption || !cover_time || !scheduled_at) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if platform is valid
    if (!['instagram', 'tiktok'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Lookup vendor_profile_id
    const vendorAccount = await VendorAccount.findOne({ user_id, platform, connected: true });
    if (!vendorAccount) {
      return res.status(400).json({ error: 'Platform not connected' });
    }

    // Create schedule
    const schedule = new Schedule({
      user_id,
      video_id,
      platform,
      caption,
      hashtags: hashtags || '',
      cover_time,
      scheduled_at: new Date(scheduled_at),
      vendor_profile_id: vendorAccount.vendor_profile_id,
      status: 'pending'
    });

    await schedule.save();

    res.status(201).json({ message: 'Schedule created successfully', schedule });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createSchedule
};
