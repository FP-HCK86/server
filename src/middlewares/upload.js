// middlewares/upload.js
const multer = require('multer');

// Simpel: memoryStorage + filter mime video/*
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (file.mimetype && file.mimetype.startsWith('video/')) return cb(null, true);
  cb(new Error('Only video files are allowed'), false);
}

const uploadVideo = multer({ storage, fileFilter });

module.exports = { uploadVideo };
