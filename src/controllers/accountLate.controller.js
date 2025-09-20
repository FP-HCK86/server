const axiosClient = require('../config/axiosClient');

// Helper untuk merapikan hasil
function mapAccount(a) {
  return {
    id: a._id || a.id,
    platform: a.platform,
    username: a.username || a.displayName,
    isActive: a.isActive,            // true jika token valid & siap dipakai
  };
}

exports.checkConnections = async (req, res) => {
  const { profileId } = req.query;
  if (!profileId) return res.status(400).json({ error: 'profileId is required' });

  try {
    const resp = await axiosClient.get('/accounts', { params: { profileId } });
    const accounts = (resp.data.accounts || resp.data || []).map(mapAccount);

    // status ringkas untuk IG & TikTok
    const ig = accounts.find(a => a.platform === 'instagram');
    const tk = accounts.find(a => a.platform === 'tiktok');

    return res.json({
      ok: true,
      profileId,
      instagram: ig ? { connected: !!ig, isActive: !!ig.isActive, username: ig.username, accountId: ig.id } : { connected: false },
      tiktok:    tk ? { connected: !!tk, isActive: !!tk.isActive, username: tk.username, accountId: tk.id } : { connected: false },
      raw: accounts
    });
  } catch (err) {
    console.error('checkConnections error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};
