// controllers/videos.controller.js
const Video = require('../models/Video');
const Schedule = require('../models/Schedule');
const cloudinary = require('../config/cloudinary');

// ... uploadVideo & listMyVideos tetap seperti sebelumnya

const uploadVideo = async (req, res) => {
  try {
    const user_id = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload ke Cloudinary
    const streamUpload = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder: process.env.CLOUDINARY_VIDEO_FOLDER || 'content-planner/videos',
          },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
      });

    const result = await streamUpload();

    // Simpan ke database
    const video = new Video({
      user_id,
      title: req.body.title || req.file.originalname,
      caption: req.body.caption || '',
      hashtags: req.body.hashtags || '',
      secure_url: result.secure_url,
      public_id: result.public_id,
      duration_sec: typeof result.duration === 'number' ? Math.round(result.duration) : 0,
    });

    await video.save();

    return res.status(201).json({
      message: 'Video uploaded successfully',
      video
    });
  } catch (err) {
    console.error('Error uploadVideo:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const listMyVideos = async (req, res) => {
  try {
    const user_id = req.user.id;

    const videos = await Video.find({ user_id }).sort({ createdAt: -1 });

    return res.json({ items: videos });
  } catch (err) {
    console.error('Error listMyVideos:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getVideo = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    const video = await Video.findOne({ _id: id, user_id });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    return res.json({ video });
  } catch (err) {
    console.error('Error getVideo:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateVideo = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    // Cari video milik user
    const doc = await Video.findOne({ _id: id, user_id });
    if (!doc) return res.status(404).json({ error: 'Video not found' });

    // Update metadata jika ada
    const { caption, hashtags, title } = req.body;
    if (typeof caption === 'string') doc.caption = caption;
    if (typeof hashtags === 'string') doc.hashtags = hashtags;
    if (typeof title === 'string') doc.title = title;

    // Jika ada file baru => upload ke Cloudinary, opsional hapus yang lama
    if (req.file) {
      // upload baru
      const streamUpload = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'video',
              folder: process.env.CLOUDINARY_VIDEO_FOLDER || 'content-planner/videos',
            },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(req.file.buffer);
        });

      const result = await streamUpload();

      const oldPublicId = doc.public_id;
      // set data baru
      doc.secure_url = result.secure_url;
      doc.public_id = result.public_id;
      doc.duration_sec = typeof result.duration === 'number' ? Math.round(result.duration) : doc.duration_sec;

      // Optional: hapus file lama jika diminta
      const deleteOld = (req.query.deleteOld || '').toString().toLowerCase() === 'true';
      if (deleteOld && oldPublicId) {
        try {
          await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'video' });
        } catch (e) {
          // jangan gagalkan seluruh update jika gagal hapus lama
          console.warn('Cloudinary delete old error:', e?.message || e);
        }
      }
    }

    await doc.save();
    return res.json({ message: 'Video updated successfully', video: doc });
  } catch (err) {
    console.error('Error updateVideo:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    const doc = await Video.findOne({ _id: id, user_id });
    if (!doc) return res.status(404).json({ error: 'Video not found' });

    // Hapus di Cloudinary bila ada public_id
    if (doc.public_id) {
      try {
        await cloudinary.uploader.destroy(doc.public_id, { resource_type: 'video' });
      } catch (e) {
        console.warn('Cloudinary destroy error:', e?.message || e);
        // lanjut hapus DB meski cloudinary gagal (pilihan desain)
      }
    }

    await doc.deleteOne();
    return res.json({ message: 'Video deleted successfully' });
  } catch (err) {
    console.error('Error deleteVideo:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get recent scheduled videos with schedule status - mixed approach
const getRecentScheduledVideos = async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log('=== DEBUG: getRecentScheduledVideos started for user:', user_id);

    // Get recent schedules with populated video data, sorted by creation date
    const recentSchedules = await Schedule.find({ 
      user_id: user_id,
      video_id: { $ne: null } // Only get schedules that have valid video_id
    })
    .populate('video_id') // Populate the video data
    .sort({ createdAt: -1 }) // Sort by schedule creation date, newest first
    .limit(10) // Get more schedules to account for any invalid references
    .lean();

    console.log('=== DEBUG: Found schedules:', recentSchedules.length);
    console.log('=== DEBUG: Schedule data:', recentSchedules.map(s => ({
      scheduleId: s._id,
      videoId: s.video_id?._id || 'null',
      caption: s.caption,
      status: s.status,
      createdAt: s.createdAt
    })));
    
    // Filter out schedules where video population failed
    const validSchedules = recentSchedules.filter(schedule => 
      schedule.video_id && schedule.video_id._id
    );
    
    console.log('=== DEBUG: Valid schedules with videos:', validSchedules.length);

    // Take only the first 3 valid schedules
    const topSchedules = validSchedules.slice(0, 3);
    console.log('=== DEBUG: Top 3 schedules for dashboard:', topSchedules.map(s => ({
      scheduleId: s._id,
      videoId: s.video_id._id,
      caption: s.caption,
      status: s.status
    })));

    // Transform the scheduled videos
    const transformedSchedules = topSchedules.map(schedule => {
      const video = schedule.video_id;
      
      // Calculate days from now for scheduled_at
      const scheduledDate = new Date(schedule.scheduled_at);
      const now = new Date();
      const diffTime = scheduledDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let daysFromNow;
      if (diffDays === 0) {
        daysFromNow = "Today";
      } else if (diffDays === 1) {
        daysFromNow = "Tomorrow";
      } else if (diffDays > 1) {
        daysFromNow = `${diffDays} days from now`;
      } else {
        daysFromNow = `${Math.abs(diffDays)} days ago`;
      }

      console.log('=== DEBUG: Processed schedule-video:', {
        title: schedule.caption,
        status: schedule.status,
        platform: schedule.platform,
        videoId: video._id
      });

      return {
        _id: video._id,
        title: schedule.caption, // Use schedule caption as title
        status: schedule.status, // Include schedule status
        platform: schedule.platform,
        daysFromNow: daysFromNow,
        duration_sec: video.duration_sec,
        secure_url: video.secure_url,
        createdAt: schedule.createdAt
      };
    });

    // If we have less than 3 scheduled videos, supplement with recent videos
    let finalResults = [...transformedSchedules];
    
    if (finalResults.length < 3) {
      console.log('=== DEBUG: Need more videos, supplementing with recent videos');
      
      // Get recent videos that aren't already included
      const excludeVideoIds = finalResults.map(item => item._id.toString());
      
      const recentVideos = await Video.find({ 
        user_id: user_id,
        _id: { $nin: excludeVideoIds }
      })
      .sort({ createdAt: -1 })
      .limit(3 - finalResults.length)
      .lean();

      console.log('=== DEBUG: Found additional recent videos:', recentVideos.length);

      // Transform recent videos to match the expected format
      const transformedRecentVideos = recentVideos.map(video => {
        // Calculate days since creation
        const createdDate = new Date(video.createdAt);
        const now = new Date();
        const diffTime = now - createdDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let daysFromNow;
        if (diffDays === 0) {
          daysFromNow = "Today";
        } else if (diffDays === 1) {
          daysFromNow = "1 day ago";
        } else {
          daysFromNow = `${diffDays} days ago`;
        }

        return {
          _id: video._id,
          title: `Video ${video._id.toString().slice(-6)}`, // Generate a title from video ID
          status: 'posted', // Recent videos are considered posted/analyzed
          platform: 'general',
          daysFromNow: daysFromNow,
          duration_sec: video.duration_sec,
          secure_url: video.secure_url,
          createdAt: video.createdAt
        };
      });
      
      finalResults = [...finalResults, ...transformedRecentVideos];
    }

    console.log('=== DEBUG: Final result count:', finalResults.length);

    res.json({
      success: true,
      data: finalResults,
      debug: {
        totalSchedules: recentSchedules.length,
        validSchedules: validSchedules.length,
        supplementedVideos: finalResults.length - transformedSchedules.length,
        returnedCount: finalResults.length
      }
    });

  } catch (error) {
    console.error('Error in getRecentScheduledVideos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent scheduled videos'
    });
  }
};

module.exports = {
  // export yang lama:
  uploadVideo,
  listMyVideos,
  getVideo,
  // export baru:
  updateVideo,
  deleteVideo,
  getRecentScheduledVideos,
};
