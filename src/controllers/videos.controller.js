// controllers/videos.controller.js
const Video = require('../models/Video');
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

    return res.json({ videos });
  } catch (err) {
    console.error('Error listMyVideos:', err);
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

module.exports = {
  // export yang lama:
  uploadVideo,
  listMyVideos,
  // export baru:
  updateVideo,
  deleteVideo,
};
