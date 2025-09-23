const User = require('../models/User');

async function downgradeIfExpired(userId) {
  if (!userId) return null;
  const user = await User.findById(userId);
  if (!user) return null;

  try {
    if (user.subscriptionExpiry && user.subscriptionExpiry.getTime() <= Date.now()) {
      // downgrade to free
      user.subscription = 'free';
      user.isPremium = false;
      user.subscriptionExpiry = null;
      await user.save();
      console.log('[subscription] downgraded user due to expiry', userId);
    }
  } catch (e) {
    console.error('[subscription] downgradeIfExpired error', e && e.message);
  }

  return user;
}

module.exports = { downgradeIfExpired };
