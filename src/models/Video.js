// models/Video.js
const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, default: "" }, // opsional, kalau mau simpan judul
    caption: { type: String, default: "" },
    hashtags: { type: String, default: "" }, // simpan sebagai string "#a #b"
    secure_url: { type: String, required: true }, // URL Cloudinary
    public_id: { type: String }, // berguna kalau butuh hapus/rename
    duration_sec: { type: Number }, // diisi dari respon Cloudinary jika ada
    
    // AI Analysis fields
    transcript: { type: String }, // Video transcript from Whisper
    transcript_status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    transcript_metadata: {
      started_at: Date,
      completed_at: Date,
      progress: { type: Number, default: 0 },
      processing_time_ms: Number,
      word_count: Number,
      confidence_score: Number
    },
    hasTranscript: { type: Boolean, default: false },
    
    analysis_status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    hasAIAnalysis: { type: Boolean, default: false },
    aiAnalysis: { type: String }, // Main AI analysis text
    aiSuggestions: {
      improvements: [String],
      captionFix: {
        current: String,
        suggested: String
      },
      tagsFix: {
        current: [String],
        suggested: [String]
      },
      hooks: [String],
      engagement: [String],
      trending: [String],
      audience: String,
      competition: String,
      nextSteps: [String]
    }
  },
  { timestamps: true }
);

videoSchema.index({ user_id: 1, createdAt: -1 }); // list milik user, terbaru dulu

module.exports = mongoose.model("Video", videoSchema);
