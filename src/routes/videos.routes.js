// routes/videos.routes.js
const express = require("express");
const router = express.Router();

const { uploadVideo } = require("../middlewares/upload");
const authentication = require("../middlewares/authentication");
const {
  uploadVideo: uploadVideoCtrl,
  listMyVideos,
  getVideo,
  updateVideo,
  deleteVideo,
  analyzeVideo,
  getVideoTranscript,
  chatWithVideo,
  deleteVideoAnalysis,
  updateVideoAnalysis,
} = require("../controllers/videos.controller");

// Apply authentication middleware to all routes
router.use(authentication);

// CREATE (upload)
router.post(
  "/",
  uploadVideo.single("file"),
  uploadVideoCtrl
);

// READ (list milik user)
router.get("/", listMyVideos);

// READ (detail video milik user)
router.get("/:id", getVideo);

// UPDATE (metadata saja ATAU ganti file + metadata)
// - Metadata: kirim JSON body (caption/hashtags/title)
// - Ganti file: kirim multipart form-data (field "file") + optional ?deleteOld=true
router.patch(
  "/:id",
  uploadVideo.single("file"),
  updateVideo
);

// DELETE (hapus DB + (coba) hapus Cloudinary)
router.delete("/:id", deleteVideo);

// ANALYZE (start transcript extraction)
router.post("/:id/analyze", analyzeVideo);

// TRANSCRIPT (get transcript status and result)
router.get("/:id/transcript", getVideoTranscript);

// CHAT (chat with AI about video)
router.post("/:id/chat", chatWithVideo);

// DELETE ANALYSIS (remove AI analysis from video)
router.delete("/:id/analysis", deleteVideoAnalysis);

// UPDATE ANALYSIS (save AI analysis results to video)
router.patch("/:id/analysis", updateVideoAnalysis);

module.exports = router;
