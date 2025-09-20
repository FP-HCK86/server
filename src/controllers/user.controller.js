const { getUserAccounts } = require('../services/connectSocialLate.service');
const VendorAccount = require('../models/VendorAccount');

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Coba ambil dari connectSocialLate service dulu
    let userAccounts = getUserAccounts(userId);
    if (userAccounts?.profileId) {
      return res.json({ profileId: userAccounts.profileId });
    }

    // Fallback: ambil dari VendorAccount (asumsikan sama untuk semua platform)
    const vendorAccount = await VendorAccount.findOne({ user_id: userId });
    if (vendorAccount?.vendor_profile_id) {
      return res.json({ profileId: vendorAccount.vendor_profile_id });
    }

    // Fallback ke environment (untuk development)
    const defaultProfileId = process.env.GETLATE_PROFILE_ID;
    if (defaultProfileId) {
      return res.json({ profileId: defaultProfileId });
    }

    return res.status(404).json({ error: 'Profile ID not found. Please connect your account first.' });
  } catch (error) {
    console.error('getUserProfile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};