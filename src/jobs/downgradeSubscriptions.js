const cron = require('node-cron');
const User = require('../models/User');

// Run daily at 00:05 server time
cron.schedule('5 0 * * *', async () => {
  try {
    const now = new Date();
    const res = await User.updateMany(
      { subscriptionExpiry: { $lte: now }, subscription: { $ne: 'free' } },
      { $set: { subscription: 'free', isPremium: false, subscriptionExpiry: null } }
    );
    console.log('[downgradeSubscriptions] downgraded count:', res.modifiedCount ?? res.nModified ?? res);
  } catch (e) {
    console.error('[downgradeSubscriptions] error', e && e.message);
  }
});

module.exports = {};
