const axiosClient = require('../config/axiosClient');

exports.schedulePost = async (req, res) => {
    const { content, mediaUrl, scheduledFor, instagramAccountId, tiktokAccountId, profileId } = req.body;

    const platforms = [];
    if (instagramAccountId) platforms.push({ platform: 'instagram', accountId: instagramAccountId });
    if (tiktokAccountId) platforms.push({ platform: 'tiktok', accountId: tiktokAccountId });

    if (!platforms.length) return res.status(400).json({ error: 'At least one platform accountId is required' });

    const postData = {
        content,
        platforms,
        mediaItems: mediaUrl ? [{ type: /\.mp4|\.mov|\.avi$/i.test(mediaUrl) ? 'video' : 'image', url: mediaUrl }] : []
    };

    if (scheduledFor) postData.scheduledFor = scheduledFor;
    else postData.publishNow = true;

    try {
        // 1) Create / schedule
        const createResp = await axiosClient.post('/posts', postData);
        const created = createResp.data;

        // 2) Jika publishNow, verifikasi cepat via GET /v1/posts
        let verify = null;
        if (postData.publishNow && profileId) {
            // Buat jendela waktu 5 menit ke belakang & depan
            const now = new Date();
            const from = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
            const to = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

            // Cek per platform (IG/TikTok) — boleh disederhanakan juga
            const platformNames = platforms.map(p => p.platform);

            const verifyResp = await axiosClient.get('/posts', {
                params: {
                    status: 'published',
                    platform: platformNames.join(','), // beberapa API menerima koma; kalau tidak, panggil per platform
                    profileId,
                    dateFrom: from,
                    dateTo: to,
                    limit: 10
                }
            });
            verify = verifyResp.data;
        }

        return res.status(201).json({
            ok: true,
            message: scheduledFor ? 'Post scheduled' : 'Post published',
            created,   // respons dari POST /v1/posts
            verify     // hasil polling /v1/posts (hanya untuk publishNow)
        });
    } catch (err) {
        console.error('schedulePost error:', err.response?.data || err.message);
        return res.status(500).json({ error: 'Failed to create/publish post', detail: err.response?.data });
    }
};
