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
}


const getSchedules = async (req, res) => {
  try {
    const { day, month, week, backdate } = req.query;
    const user_id = req.user.id;

    // Build filter
    const filter = { user_id };
    const now = new Date();

    if (backdate) {
      // Filter backdate: scheduled_at < now
      filter.scheduled_at = { $lt: now };
    } else if (day) {
      // Filter hari ini
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      filter.scheduled_at = { $gte: startOfDay, $lt: endOfDay };
    } else if (month) {
      // Filter bulan ini
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      filter.scheduled_at = { $gte: startOfMonth, $lt: endOfMonth };
    } else if (week) {
      // Filter minggu ini (Senin - Minggu)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);  // Senin
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      filter.scheduled_at = { $gte: startOfWeek, $lt: endOfWeek };
    }

    // Query schedules
    const schedules = await Schedule.find(filter).sort({ scheduled_at: -1 });

    res.status(200).json({ schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const schedule = await Schedule.findOne({ _id: id, user_id });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.status(200).json({ schedule });
  } catch (error) {
    console.error('Error fetching schedule by ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById
};
