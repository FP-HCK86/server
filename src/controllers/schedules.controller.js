const Schedule = require("../models/Schedule");
const VendorAccount = require("../models/VendorAccount");

class SchedulesController {
  static async createSchedule(req, res, next) {
    try {
      const {
        video_id,
        platform,
        caption,
        hashtags,
        cover_time,
        scheduled_at,
      } = req.body;
      const user_id = req.user.id; // Assuming JWT payload has id

      // Validate required fields
      if (!video_id || !platform || !caption || !cover_time || !scheduled_at) {
        const error = new Error("Missing required fields");
        error.statusCode = 400;
        return next(error);
      }

      // Check if platform is valid
      if (!["instagram", "tiktok"].includes(platform)) {
        const error = new Error("Invalid platform");
        error.statusCode = 400;
        return next(error);
      }

      // Lookup vendor_profile_id
      const vendorAccount = await VendorAccount.findOne({
        user_id,
        platform,
        connected: true,
      });
      if (!vendorAccount) {
        const error = new Error("Platform not connected");
        error.statusCode = 400;
        return next(error);
      }

      // Create schedule
      const schedule = new Schedule({
        user_id,
        video_id,
        platform,
        caption,
        hashtags: hashtags || "",
        cover_time,
        scheduled_at: new Date(scheduled_at),
        vendor_profile_id: vendorAccount.vendor_profile_id,
        status: "pending",
      });

      await schedule.save();

      res
        .status(201)
        .json({ message: "Schedule created successfully", schedule });
    } catch (error) {
      next(error);
    }
  }

  static async getSchedules(req, res, next) {
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
        const startOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const endOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1
        );
        filter.scheduled_at = { $gte: startOfDay, $lt: endOfDay };
      } else if (month) {
        // Filter bulan ini
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        filter.scheduled_at = { $gte: startOfMonth, $lt: endOfMonth };
      } else if (week) {
        // Filter minggu ini (Senin - Minggu)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Senin
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        filter.scheduled_at = { $gte: startOfWeek, $lt: endOfWeek };
      }

      // Query schedules
      const schedules = await Schedule.find(filter).sort({ scheduled_at: -1 });

      res.status(200).json({ schedules });
    } catch (error) {
      next(error);
    }
  }

  static async getScheduleById(req, res, next) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;

      const schedule = await Schedule.findOne({ _id: id, user_id });
      if (!schedule) {
        const error = new Error("Schedule not found");
        error.statusCode = 404;
        return next(error);
      }

      res.status(200).json({ schedule });
    } catch (error) {
      next(error);
    }
  }

  static async updateSchedule(req, res, next) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;
      const updates = req.body; // Expected fields: video_id, platform, caption, hashtags, cover_time, scheduled_at

      // Find schedule that is still pending and belongs to user
      const schedule = await Schedule.findOne({
        _id: id,
        user_id,
        status: "pending",
      });
      if (!schedule) {
        const error = new Error("Schedule not found or not pending");
        error.statusCode = 404;
        return next(error);
      }

      // Validate updates (similar to create, but only for changed fields)
      if (
        updates.platform &&
        !["instagram", "tiktok"].includes(updates.platform)
      ) {
        const error = new Error("Invalid platform");
        error.statusCode = 400;
        return next(error);
      }

      // If platform is updated, re-check vendor_account
      if (updates.platform) {
        const vendorAccount = await VendorAccount.findOne({
          user_id,
          platform: updates.platform,
          connected: true,
        });
        if (!vendorAccount) {
          const error = new Error("Platform not connected");
          error.statusCode = 400;
          return next(error);
        }
        schedule.vendor_profile_id = vendorAccount.vendor_profile_id; // Update if platform changed
      }

      // Apply updates (only allowed fields)
      const allowedFields = [
        "video_id",
        "platform",
        "caption",
        "hashtags",
        "cover_time",
        "scheduled_at",
      ];
      allowedFields.forEach((field) => {
        if (updates[field] !== undefined) {
          if (field === "scheduled_at") {
            schedule[field] = new Date(updates[field]);
          } else {
            schedule[field] = updates[field];
          }
        }
      });

      await schedule.save();

      res
        .status(200)
        .json({ message: "Schedule updated successfully", schedule });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSchedule(req, res, next) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;
      
      const schedule = await Schedule.findOneAndDelete({
        _id: id,
        user_id,
        status: "pending",
      });
      if (!schedule) {
        const error = new Error("Schedule not found or not pending");
        error.statusCode = 404;
        return next(error);
      }

      res.status(200).json({ message: "Schedule deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  // Tambahkan di class SchedulesController
static async runNow(req, res, next) {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        // Find schedule pending milik user
        const schedule = await Schedule.findOne({ _id: id, user_id, status: 'pending' });
        if (!schedule) {
            const error = new Error('Schedule not found or not pending');
            error.statusCode = 404;
            return next(error);
        }

        // Set processing (idempotent, jika sudah processing, skip)
        if (schedule.status === 'processing') {
            return res.status(200).json({ message: 'Already processing' });
        }
        await Schedule.findByIdAndUpdate(id, { status: 'processing', locked_at: new Date() });

        // Panggil LateService.publishNow
        const mediaUrl = 'https://res.cloudinary.com/...';  // Ganti dengan secure_url dari Video
        const result = await LateService.publishNow({
            vendor_profile_id: schedule.vendor_profile_id,
            platform: schedule.platform,
            mediaUrl,
            caption: schedule.caption,
            idempotencyKey: schedule._id.toString()
        });

        // Simpan vendor_job_id
        if (result.vendor_job_id) {
            await Schedule.findByIdAndUpdate(id, { vendor_job_id: result.vendor_job_id });
        }

        res.status(200).json({ message: 'Publish initiated', vendor_job_id: result.vendor_job_id });
    } catch (error) {
        next(error);
    }
}
}

module.exports = SchedulesController;
