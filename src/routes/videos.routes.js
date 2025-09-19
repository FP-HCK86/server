// routes/videos.routes.js
const express = require('express');
const router = express.Router();

const { uploadVideo } = require('../middlewares/upload');
const { authenticateToken } = require('../middlewares/auth');
const {
    uploadVideo: uploadVideoCtrl,
    listMyVideos,
    updateVideo,
    deleteVideo,
} = require('../controllers/videos.controller');

// JWT Authentication middleware
// All routes now use proper JWT authentication instead of mock auth

// CREATE (upload)
router.post('/', authenticateToken, uploadVideo.single('file'), uploadVideoCtrl);

// READ (list milik user)
router.get('/', authenticateToken, listMyVideos);

// UPDATE (metadata saja ATAU ganti file + metadata)
// - Metadata: kirim JSON body (caption/hashtags/title)
// - Ganti file: kirim multipart form-data (field "file") + optional ?deleteOld=true
router.patch('/:id', authenticateToken, uploadVideo.single('file'), updateVideo);

// DELETE (hapus DB + (coba) hapus Cloudinary)
router.delete('/:id', authenticateToken, deleteVideo);

module.exports = router;
