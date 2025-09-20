// services/accountStore.js
// Sederhana: simpan mapping userId -> { instagramAccountId, tiktokAccountId, profileId }
const store = new Map();

function upsertUserAccounts(userId, data) {
  const cur = store.get(userId) || {};
  const next = { ...cur, ...data };
  store.set(userId, next);
  return next;
}

function getUserAccounts(userId) {
  return store.get(userId) || null;
}

module.exports = { upsertUserAccounts, getUserAccounts };
