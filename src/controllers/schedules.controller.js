const Schedule = require("../models/Schedule");
const VendorAccount = require("../models/VendorAccount");
const mongoose = require("mongoose");
const { sendEmail } = require("../helpers/email");
const LateService = require("../services/lateService");
const { downgradeIfExpired } = require('../helpers/subscription');

class SchedulesController {
  static async createSchedule(req, res, next) {
    try {
      // Enforce free-tier schedule limit using atomic update to avoid races
      const User = require("../models/User");
      let incremented = false;
      let updatedUser = null;
      const userId = req.user.id;
      // ensure user's subscription is up-to-date (auto-downgrade if expiry passed)
      try {
        await downgradeIfExpired(userId);
      } catch (e) {
        console.warn('[createSchedule] downgradeIfExpired failed', e && e.message);
      }
      const userDoc = await User.findById(userId);
      if (userDoc && userDoc.subscription === "free") {
        // Try to atomically increment scheduleCount only if < 3
        updatedUser = await User.findOneAndUpdate(
          { _id: userId, subscription: "free", scheduleCount: { $lt: 2 } },
          { $inc: { scheduleCount: 1 } },
          { new: true }
        );
        if (!updatedUser) {
          // Could not increment (limit reached) — return localized message (Indonesian)
          return res
            .status(403)
            .json({
              error:
                "Anda telah mencapai batas 2 schedule. Upgrade untuk akses unlimited.",
              redirectTo: "/upgrade",
            });
        }
        incremented = true;
      }
      const {
        video_id,
        platform,
        caption,
        hashtags,
        cover_time,
        scheduled_at,
      } = req.body;
      let user_id, videoId;
      try {
        user_id = new mongoose.Types.ObjectId(req.user.id);
        videoId = new mongoose.Types.ObjectId(video_id);
      } catch (e) {
        const error = new Error("Invalid ID format");
        error.statusCode = 400;
        return next(error);
      }

      // Validate required fields
      if (
        !video_id ||
        !platform ||
        !caption ||
        cover_time == null ||
        !scheduled_at
      ) {
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
      console.log("Looking for vendor account", { user_id, platform });
      let vendorAccount = await VendorAccount.findOne({
        user_id,
        platform,
        connected: true,
      });

      if (!vendorAccount) {
        return res.status(400).json({
          success: false,
          message: `No connected ${platform} account found. Please connect your ${platform} account first.`,
          error: "ACCOUNT_NOT_CONNECTED",
        });
      }

      // Create schedule
      console.log("Creating schedule with", {
        user_id,
        videoId,
        platform,
        caption,
        cover_time,
        scheduled_at,
        vendor_profile_id: vendorAccount.vendor_profile_id,
      });

      // FE already sends scheduled_at as an ISO string in UTC (it builds local +07:00 then .toISOString())
      // Previously we subtracted 7h again, resulting in past times and immediate publish.
      // Now: trust incoming timestamp and just parse it.
      const scheduledAtUTC = new Date(scheduled_at);
      if (isNaN(scheduledAtUTC.getTime())) {
        const error = new Error("Invalid scheduled_at date");
        error.statusCode = 400;
        return next(error);
      }
      // Must be at least 60s in the future to allow Late to schedule properly
      if (scheduledAtUTC.getTime() < Date.now() + 60 * 1000) {
        const error = new Error(
          "Waktu schedule harus minimal 1 menit di depan waktu sekarang"
        );
        error.statusCode = 400;
        return next(error);
      }
      const scheduledDate = scheduledAtUTC; // already UTC
      console.log(
        "[ScheduleCreate] scheduled_at(raw)=",
        scheduled_at,
        "storedUTC=",
        scheduledDate.toISOString()
      );

      const schedule = new Schedule({
        user_id,
        video_id: videoId,
        platform,
        caption,
        hashtags: hashtags || "",
        cover_time,
        scheduled_at: scheduledDate, // already UTC
        vendor_profile_id: vendorAccount.vendor_profile_id,
        status: "pending",
      });

      // Ambil video secure_url (butuh populate atau query manual)
      const Video = require("../models/Video");
      const videoDoc = await Video.findOne({ _id: videoId, user_id });
      let mediaItems = [];
      if (videoDoc?.secure_url) {
        mediaItems.push({ type: "video", url: videoDoc.secure_url });
      }

      // Ambil Late accountId untuk platform ini (pasca callback update)
      const accountRecord = await VendorAccount.findOne({
        user_id,
        platform,
        connected: true,
        vendor_profile_id: vendorAccount.vendor_profile_id,
      });
      let accountId = accountRecord?.vendor_account_id; // may be undefined first time

      if (!accountId) {
        // Coba sync ulang akun dari Late jika belum ada
        try {
          const accounts = await LateService.getAccounts(
            vendorAccount.vendor_profile_id
          );
          const match = accounts.find((a) => a.platform === platform);
          if (match?._id) {
            accountId = match._id;
            await VendorAccount.findOneAndUpdate(
              { _id: accountRecord?._id || undefined, platform, user_id },
              { vendor_account_id: accountId },
              { upsert: true }
            );
          }
        } catch (syncErr) {
          console.warn(
            "Account sync failed during schedule create:",
            syncErr.message
          );
        }
      }

      // Bangun payload Late
      let lateResponse = null;
      try {
        const latePayload = {
          content: caption + (hashtags ? `\n${hashtags}` : ""),
          mediaItems,
          platforms: accountId ? [{ platform, accountId }] : undefined,
          scheduledFor: scheduledDate.toISOString(),
          timezone: "UTC",
        };
        console.log("[ScheduleCreate] Late schedulePost payload:", latePayload);
        lateResponse = await LateService.schedulePost(latePayload);
        // Simpan vendor_job_id / post id jika tersedia
        if (lateResponse?.post?._id) {
          schedule.vendor_job_id = lateResponse.post._id; // treat as job/post id
        } else if (lateResponse?.postId) {
          schedule.vendor_job_id = lateResponse.postId;
        }
      } catch (lateErr) {
        console.error(
          "Late schedulePost error:",
          lateErr.response?.data || lateErr.message
        );
        // Lanjutkan simpan schedule lokal agar user masih lihat (status pending_failed?)
        schedule.status = "pending";
        schedule.error = "late_schedule_failed";
      }

      try {
        await schedule.save();
      } catch (saveErr) {
        // rollback increment if we previously incremented scheduleCount
        if (incremented) {
          try {
            await User.findByIdAndUpdate(userId, {
              $inc: { scheduleCount: -1 },
            });
          } catch (rbErr) {
            console.error(
              "Failed to rollback scheduleCount after save error",
              rbErr
            );
          }
        }
        throw saveErr;
      }

      // Kirim email konfirmasi ke user (tanpa reminder 5 menit, sistem akan auto publish)
      try {
        await sendEmail(
          req.user.email,
          "Schedule Posting Dibuat - Planoria",
          `Halo, Schedule posting ke ${platform} berhasil dibuat untuk ${scheduled_at}. Sistem akan otomatis mem-publish pada waktu tersebut dan kamu akan menerima email berhasil atau gagal setelah proses.`
        );
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
      }

      res.status(201).json({
        message: "Schedule created successfully",
        schedule,
        late: lateResponse
          ? {
              mode: "scheduled",
              hasPost: !!lateResponse.post,
              postId: lateResponse.post?._id || lateResponse.postId,
            }
          : null,
      });
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

      const schedule = await Schedule.findOne({ _id: id, user_id }).populate(
        "video_id"
      );
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

      // Set processing (idempotent, jika sudah processing, skip)
      if (schedule.status === "processing") {
        return res.status(200).json({ message: "Already processing" });
      }
      await Schedule.findByIdAndUpdate(id, {
        status: "processing",
        locked_at: new Date(),
      });

      // Ambil video untuk mediaItems
      const Video = require("../models/Video");
      const videoDoc = await Video.findOne({ _id: schedule.video_id, user_id });
      const mediaItems = [];
      if (videoDoc?.secure_url) {
        mediaItems.push({ type: "video", url: videoDoc.secure_url });
      }

      // Pastikan punya accountId
      const VendorAccount = require("../models/VendorAccount");
      let accountRecord = await VendorAccount.findOne({
        user_id,
        platform: schedule.platform,
        vendor_profile_id: schedule.vendor_profile_id,
      });
      let accountId = accountRecord?.vendor_account_id;
      if (!accountId) {
        try {
          const accounts = await LateService.getAccounts(
            schedule.vendor_profile_id
          );
          const match = accounts.find((a) => a.platform === schedule.platform);
          if (match?._id) {
            accountId = match._id;
            await VendorAccount.findOneAndUpdate(
              {
                _id: accountRecord?._id || undefined,
                platform: schedule.platform,
                user_id,
              },
              { vendor_account_id: accountId },
              { upsert: true }
            );
          }
        } catch (e) {
          console.warn("Failed to sync accounts in runNow:", e.message);
        }
      }

      if (!accountId) {
        return res
          .status(400)
          .json({ error: "Unable to resolve Late accountId for platform" });
      }

      // Publish now via Late
      let publishResp;
      try {
        publishResp = await LateService.publishNow({
          content:
            schedule.caption +
            (schedule.hashtags ? `\n${schedule.hashtags}` : ""),
          mediaItems,
          platforms: [{ platform: schedule.platform, accountId }],
        });
      } catch (pubErr) {
        console.error(
          "Late publishNow error:",
          pubErr.response?.data || pubErr.message
        );
        await Schedule.findByIdAndUpdate(id, {
          status: "failed",
          error: "late_publish_failed",
        });
        return res.status(500).json({ error: "Late publish failed" });
      }

      const postId = publishResp?.post?._id || publishResp?.postId;
      if (postId) {
        await Schedule.findByIdAndUpdate(id, { vendor_job_id: postId });
      }

      res.status(200).json({ message: "Publish initiated", postId });
    } catch (error) {
      next(error);
    }
  }

  static async getUpcomingSchedules(req, res, next) {
    try {
      const user_id = req.user.id;
      const now = new Date();

      console.log('=== DEBUG: getUpcomingSchedules started for user:', user_id);
      console.log('=== DEBUG: Current time:', now.toISOString());

      // Get upcoming schedules (scheduled_at > now) sorted by scheduled_at ascending
      const upcomingSchedules = await Schedule.find({
        user_id: user_id,
        scheduled_at: { $gt: now }, // Only future schedules
        status: { $in: ['pending', 'processing'] } // Only active schedules
      })
      .sort({ scheduled_at: 1 }) // Earliest first
      .limit(4) // Only 4 schedules
      .lean();

      console.log('=== DEBUG: Found upcoming schedules:', upcomingSchedules.length);

      // Format the schedules for frontend
      const formattedSchedules = upcomingSchedules.map(schedule => {
        const scheduledAt = new Date(schedule.scheduled_at);
        console.log(`=== DEBUG: Processing schedule ${schedule._id}:`);
        console.log(`    Scheduled at: ${scheduledAt.toISOString()}`);
        console.log(`    Current time: ${now.toISOString()}`);

        // Calculate time difference in milliseconds
        const timeDiffMs = scheduledAt.getTime() - now.getTime();
        
        // Convert to hours (decimal)
        const exactHours = timeDiffMs / (1000 * 60 * 60);
        console.log(`    Exact hours difference: ${exactHours}`);
        
        // Get minutes part only (remainder after full hours)
        const totalMinutes = timeDiffMs / (1000 * 60);
        const minutesRemainder = totalMinutes % 60;
        console.log(`    Minutes remainder: ${minutesRemainder}`);
        
        // Apply rounding logic: < 30 minutes = Math.floor, >= 30 minutes = Math.ceil
        let hoursFromNow;
        if (minutesRemainder < 30) {
          hoursFromNow = Math.floor(exactHours);
          console.log(`    Using Math.floor (${minutesRemainder} < 30): ${hoursFromNow}`);
        } else {
          hoursFromNow = Math.ceil(exactHours);
          console.log(`    Using Math.ceil (${minutesRemainder} >= 30): ${hoursFromNow}`);
        }

        // Ensure minimum of 1 hour display if it's less than 1
        if (hoursFromNow < 1) {
          hoursFromNow = 1;
          console.log(`    Adjusted to minimum 1 hour`);
        }

        // Format platform names
        const platformName = schedule.platform === 'instagram' ? 'Instagram' : 'TikTok';
        const platformPrefix = schedule.platform === 'instagram' ? 'IG Reels' : 'TikTok';

        // Determine date badge logic
        const hoursUntilScheduled = timeDiffMs / (1000 * 60 * 60);
        let dateBadge;
        
        if (hoursUntilScheduled < 24) {
          dateBadge = 'Today';
        } else {
          // Check if it's tomorrow (24-48 hours)
          if (hoursUntilScheduled < 48) {
            dateBadge = 'Tomorrow';
          } else {
            // Format as DD-MM-YYYY for dates beyond tomorrow
            dateBadge = scheduledAt.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric'
            });
          }
        }

        console.log(`    Hours until scheduled: ${hoursUntilScheduled}`);
        console.log(`    Date badge: ${dateBadge}`);

        return {
          id: schedule._id,
          title: `${platformPrefix}: ${schedule.caption}`,
          date: `${hoursFromNow} hours from now`,
          platform: platformName,
          dateBadge: dateBadge,
          scheduled_at: schedule.scheduled_at
        };
      });

      console.log('=== DEBUG: Formatted upcoming schedules:', formattedSchedules);

      res.status(200).json({
        success: true,
        data: formattedSchedules
      });
    } catch (error) {
      console.error('Error fetching upcoming schedules:', error);
      next(error);
    }
  }

  static async getDashboardStats(req, res, next) {
    try {
      const user_id = req.user.id;

      console.log('=== DEBUG: getDashboardStats started for user:', user_id);

      // Count total unique videos from schedules (distinct video_ids)
      const totalVideosResult = await Schedule.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(user_id) } },
        { $group: { _id: "$video_id" } },
        { $count: "total" }
      ]);
      const totalVideos = totalVideosResult.length > 0 ? totalVideosResult[0].total : 0;

      console.log('=== DEBUG: Total unique videos:', totalVideos);

      // Count scheduled (pending or processing status)
      const scheduledCount = await Schedule.countDocuments({
        user_id: user_id,
        status: { $in: ['pending', 'processing'] }
      });

      console.log('=== DEBUG: Scheduled count:', scheduledCount);

      // Count posted schedules
      const postedCount = await Schedule.countDocuments({
        user_id: user_id,
        status: 'posted'
      });

      console.log('=== DEBUG: Posted count:', postedCount);

      // Count failed schedules
      const failedCount = await Schedule.countDocuments({
        user_id: user_id,
        status: 'failed'
      });

      console.log('=== DEBUG: Failed count:', failedCount);

      const stats = {
        totalVideos,
        scheduled: scheduledCount,
        posted7d: postedCount,
        failed7d: failedCount
      };

      console.log('=== DEBUG: Dashboard stats result:', stats);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      next(error);
    }
  }

  static async getContentAnalytics(req, res, next) {
    try {
      console.log('=== DEBUG: Starting content analytics...');
      
      // Get content style analytics
      const contentStyleAnalytics = await Schedule.aggregate([
        {
          $match: {
            status: 'posted'
          }
        },
        {
          $lookup: {
            from: 'personas',
            localField: 'persona_id',
            foreignField: '_id',
            as: 'persona'
          }
        },
        {
          $unwind: '$persona'
        },
        {
          $group: {
            _id: '$persona.contentStyle',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      // Get brand voice analytics
      const brandVoiceAnalytics = await Schedule.aggregate([
        {
          $match: {
            status: 'posted'
          }
        },
        {
          $lookup: {
            from: 'personas',
            localField: 'persona_id',
            foreignField: '_id',
            as: 'persona'
          }
        },
        {
          $unwind: '$persona'
        },
        {
          $group: {
            _id: '$persona.brandVoice',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      console.log('=== DEBUG: Content style analytics:', contentStyleAnalytics);
      console.log('=== DEBUG: Brand voice analytics:', brandVoiceAnalytics);

      // Format data for radar charts
      const contentStyleFormatted = contentStyleAnalytics.map(item => ({
        label: item._id,
        value: item.count
      }));

      const brandVoiceFormatted = brandVoiceAnalytics.map(item => ({
        label: item._id,
        value: item.count
      }));

      res.status(200).json({
        success: true,
        data: {
          contentStyle: contentStyleFormatted,
          brandVoice: brandVoiceFormatted
        }
      });
    } catch (error) {
      console.error('Error fetching content analytics:', error);
      next(error);
    }
  }
}

module.exports = SchedulesController;
