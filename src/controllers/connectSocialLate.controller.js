// controllers/connectController.js
require('dotenv').config();
const axios = require('axios');
const axiosClient = require('../config/axiosClient');
const { upsertUserAccounts, getUserAccounts } = require('../services/accountStore');

const { APP_BASE_URL = 'http://localhost:3000', CONNECT_CALLBACK_PATH = '/connect/callback' } = process.env;

// Utility untuk bangun redirect_url agar state (userId) ikut balik
function buildRedirectUrl(userId) {
    // Kita tambahkan userId di query supaya ikut kembali saat callback
    const url = new URL(APP_BASE_URL + CONNECT_CALLBACK_PATH);
    if (userId) url.searchParams.set('userId', userId);
    return url.toString();
}

// FE memanggil: GET /connect/:platform?profileId=...&userId=...
// Server akan memanggil Late: /v1/connect/{platform}?profileId=...&redirect_url=...
// lalu ambil header Location dan redirect user ke sana.
exports.startConnect = async (req, res) => {
    const { platform } = req.params; // 'instagram' | 'tiktok'
    const { profileId, userId } = req.query;

    if (!profileId) return res.status(400).json({ error: 'profileId is required' });
    if (!platform || !['instagram', 'tiktok'].includes(platform)) {
        return res.status(400).json({ error: 'platform must be instagram or tiktok' });
    }

    try {
        const connectUrl = `https://getlate.dev/api/v1/connect/${platform}`;
        const redirect_url = buildRedirectUrl(userId);

        // Pakai axios manual redirect=0
        const resp = await axios.get(connectUrl, {
            params: { profileId, redirect_url },
            headers: { Authorization: `Bearer ${process.env.LATE_API_KEY}` },
            maxRedirects: 0, // penting: kita ingin baca Location
            validateStatus: (s) => s >= 200 && s < 400 // 302 dianggap OK
        });

        const loc = resp.headers.location;
        if (!loc) {
            return res.status(500).json({ error: 'Failed to initiate connect (no redirect location)' });
        }

        // Simpan profileId sementara (opsional)
        if (userId) {
            upsertUserAccounts(userId, { profileId });
        }

        // Redirect user ke halaman izin platform
        return res.redirect(loc);
    } catch (err) {
        console.error('startConnect error:', err.response?.status, err.response?.data || err.message);
        return res.status(500).json({ error: 'Failed to start connect', detail: err.response?.data || err.message });
    }
};

// Callback dari Late setelah OAuth platform selesai.
// Late akan menambahkan query ?connected={platform}&profileId=...&username=... (&error=... jika gagal)
// Kita ambil akun terbaru via GET /v1/accounts dan simpan accountId per userId.
exports.connectCallback = async (req, res) => {
    const { connected, profileId, username, error, userId } = req.query;

    if (error) {
        return res.status(400).send(`Connect failed: ${error}`);
    }
    if (!connected || !profileId) {
        return res.status(400).send('Invalid callback params');
    }

    try {
        // Ambil daftar akun untuk profil ini
        const r = await axiosClient.get('/accounts', { params: { profileId } });
        const accounts = r.data.accounts || r.data || [];
        const account = accounts.find(a => a.platform === connected);

        if (!account) {
            return res.status(404).send(`No ${connected} account found on profile.`);
        }

        // Simpan ke mock store (ganti dengan DB Anda)
        if (userId) {
            if (connected === 'instagram') {
                upsertUserAccounts(userId, { instagramAccountId: account._id, profileId });
            } else if (connected === 'tiktok') {
                upsertUserAccounts(userId, { tiktokAccountId: account._id, profileId });
            }
        }

        // Redirect ke UI Anda (dashboard FE) dengan status
        const ui = new URL(APP_BASE_URL);
        ui.pathname = '/'; // ganti ke path dashboard FE Anda
        ui.searchParams.set('connected', connected);
        ui.searchParams.set('username', username || '');
        ui.searchParams.set('profileId', profileId);
        if (userId) ui.searchParams.set('userId', userId);

        return res.redirect(ui.toString());
    } catch (err) {
        console.error('connectCallback error:', err.response?.status, err.response?.data || err.message);
        return res.status(500).send('Failed to finalize connect');
    }
};

// FE bisa panggil untuk render status tombol (Connected / Connect)
// GET /connect/status?userId=...&profileId=...
exports.getConnectionStatus = async (req, res) => {
    const { userId, profileId } = req.query;
    if (!userId || !profileId) return res.status(400).json({ error: 'userId & profileId are required' });

    try {
        const saved = getUserAccounts(userId) || {};
        // juga tarik status fresh dari Late:
        const r = await axiosClient.get('/accounts', { params: { profileId } });
        const accounts = r.data.accounts || r.data || [];

        const ig = accounts.find(a => a.platform === 'instagram');
        const tk = accounts.find(a => a.platform === 'tiktok');

        return res.json({
            userId,
            profileId,
            instagram: ig ? { connected: true, isActive: !!ig.isActive, accountId: ig._id, username: ig.username } : { connected: false },
            tiktok: tk ? { connected: true, isActive: !!tk.isActive, accountId: tk._id, username: tk.username } : { connected: false },
            saved      // apa yang tersimpan di mock store
        });
    } catch (err) {
        console.error('getConnectionStatus error:', err.response?.status, err.response?.data || err.message);
        return res.status(500).json({ error: 'Failed to fetch status' });
    }
};
