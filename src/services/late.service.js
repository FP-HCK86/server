const axios = require('axios');

// BASE_URL domain-only (tanpa /api/v1), hapus trailing slash jika ada
const BASE_URL = (process.env.LATE_BASE_URL || 'https://getlate.dev/api/v1').replace(/\/+$/, '');
// Path endpoint dipisah agar tidak double
const PUBLISH_PATH = process.env.LATE_PUBLISH_PATH || '/api/v1/posts';

class LateService {
  static async publishNow({ profileId, platform, mediaItems, content, timezone, scheduledFor = null }) {
    try {
      // Validasi parameter yang dibutuhkan
      if (!profileId || !platform || !content || !mediaItems) {
        throw new Error("Missing required parameters: profileId, platform, mediaItems, and content are required.");
      }

      const apiKey = process.env.LATE_API_KEY;
      const client = axios.create({
        baseURL: BASE_URL,
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      // Payload untuk posting konten
      const payload = {
        content,  // Konten untuk posting
        publishNow: !scheduledFor,  // Jika tidak ada waktu penjadwalan, publish segera
        scheduledFor,  // Jika ada waktu penjadwalan, atur waktu posting
        timezone,  // Zona waktu untuk penjadwalan
        platforms: [
          {
            platform,  // Platform yang akan digunakan, misalnya "instagram" atau "tiktok"
            accountId: profileId,  // Account ID yang sudah terhubung
            mediaItems,  // Media yang akan diposting (gambar/video)
          },
        ],
      };

      // Melakukan request ke API getlate.dev untuk posting
      const { data } = await client.post(PUBLISH_PATH, payload);

      // Mengembalikan data hasil response dari API
      return data;
    } catch (err) {
      // Menangani kesalahan dan menambahkan informasi debug yang lebih lengkap
      console.error('[LateService] request failed', {
        code: err.code,
        message: err.message,
        stack: err.stack, // Menambahkan stack trace untuk mempermudah debugging
        url: err.config?.baseURL + err.config?.url,
        status: err.response?.status,
        data: err.response?.data,
      });

      // Menghasilkan error dengan informasi BadGateway
      const e = new Error('Failed to publish via Late API');
      e.name = 'BadGateway';
      e.statusCode = 502;
      throw e;
    }
  }

  // Fungsi untuk memverifikasi dan mengonversi mediaItems ke format yang valid
  static validateMediaItems(mediaItems) {
    if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
      throw new Error("mediaItems should be a non-empty array.");
    }

    // Cek tiap item di mediaItems, pastikan mereka memiliki format yang valid
    for (const item of mediaItems) {
      if (!item.type || !item.url) {
        throw new Error("Each media item must have 'type' and 'url' properties.");
      }
      // Bisa menambahkan validasi lebih lanjut untuk URL atau jenis media lainnya jika diperlukan
    }
  }
}

module.exports = LateService;
