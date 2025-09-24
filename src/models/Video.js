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
    caption: { type: String, required: true},
    hashtags: { type: String, default: "" }, // simpan sebagai string "#a #b"
    secure_url: { type: String, required: true }, // URL Cloudinary
    public_id: { type: String }, // berguna kalau butuh hapus/rename
    duration_sec: { type: Number }, // diisi dari respon Cloudinary jika ada
  },
  { timestamps: true }
);

videoSchema.index({ user_id: 1, createdAt: -1 }); // list milik user, terbaru dulu

module.exports = mongoose.model("Video", videoSchema);
