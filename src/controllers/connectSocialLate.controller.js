const config = require('../config/late');
const lateService = require('../services/lateService');
const VendorAccount = require('../models/VendorAccount');
const axios = require("axios");

exports.startConnect = async (req, res) => {
  try {
    const { platform } = req.params;
    const userId = req.user._id;

    console.log('startConnect called with:', {
      platform,
      userId,
      params: req.params,
      url: req.url,
      originalUrl: req.originalUrl
    });

    // Validate platform
    if (!platform || !['instagram', 'tiktok'].includes(platform)) {
      console.log('Invalid platform validation failed:', platform);
      return res.status(400).json({ error: 'Invalid platform. Must be instagram or tiktok' });
    }

    // Validate Late API configuration
    if (!config.LATE_API_KEY) {
      console.error('LATE_API_KEY is not configured');
      return res.status(500).json({ error: 'Server configuration error: Late API key missing' });
    }

    if (!config.LATE_BASE_URL) {
      console.error('LATE_BASE_URL is not configured');
      return res.status(500).json({ error: 'Server configuration error: Late base URL missing' });
    }

    // 1. Cek apakah user sudah punya profil Late untuk platform apa pun
    let vendorAccount = await VendorAccount.findOne({ user_id: userId, platform });
    let profileId = vendorAccount?.vendor_profile_id;
    
    if (!profileId) {
      // Cek apakah user sudah punya vendor account untuk platform lain
      const existingAccount = await VendorAccount.findOne({ user_id: userId });
      
      if (existingAccount && existingAccount.vendor_profile_id) {
        // Gunakan profileId yang sudah ada
        profileId = existingAccount.vendor_profile_id;
        console.log('Using existing profileId:', profileId);
      } else {
        // Buat profile baru jika belum ada sama sekali
        try {
          console.log('Creating new Late profile for user:', userId);
          const profile = await lateService.createProfile(`user-${userId}`);
          profileId = profile._id;
          console.log('Profile created successfully:', profileId);
        } catch (createError) {
          console.log('Profile creation error:', createError.message);
          console.log('Error details:', createError.response?.data || createError);
          // If profile already exists, try with timestamp
          if (createError.message && createError.message.includes('already exists')) {
            const timestamp = Date.now();
            console.log('Retrying with timestamp:', timestamp);
            const profile = await lateService.createProfile(`user-${userId}-${timestamp}`);
            profileId = profile._id;
            console.log('Profile created with timestamp:', profileId);
          } else {
            throw createError;
          }
        }
      }
      
      // Buat VendorAccount baru untuk platform ini
      vendorAccount = new VendorAccount({ 
        user_id: userId, 
        platform, 
        vendor_profile_id: profileId,
        connected: false
      });
      await vendorAccount.save();
    }

    const redirectUrl = `${req.protocol}://${req.get("host")}/connect/callback/${platform}`;

    console.log('Calling Late API:', {
      url: `${config.LATE_BASE_URL}/connect/${platform}`,
      profileId,
      redirectUrl,
      hasApiKey: !!config.LATE_API_KEY,
      apiKeyLength: config.LATE_API_KEY ? config.LATE_API_KEY.length : 0,
      apiKeyStart: config.LATE_API_KEY ? config.LATE_API_KEY.substring(0, 10) + '...' : 'missing'
    });

    const resp = await axios.get(
      `${config.LATE_BASE_URL}/connect/${platform}`,
      {
        params: { profileId, redirect_url: redirectUrl },
        headers: { Authorization: `Bearer ${config.LATE_API_KEY}` },
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
      }
    );
    
    console.log('Late API response:', {
      status: resp.status,
      hasLocation: !!resp.headers.location,
      location: resp.headers.location
    });
    // Modern behaviour: Late returns JSON { authUrl, state } without 302
    if (!resp.headers.location) {
      const authUrl = resp.data?.authUrl || resp.data?.url;
      if (authUrl) {
        console.log('Late API provided authUrl (JSON mode). Returning JSON to FE to perform redirect.', {
          authUrlStart: authUrl.substring(0,80) + '...',
          hasState: !!resp.data?.state,
        });

        // Persist state for potential later validation (optional enhancement)
        // TODO: Save resp.data.state associated with user/profile if security validation required on callback.

        return res.status(200).json({
          redirectUrl: authUrl,
          state: resp.data?.state,
          profileId,
          platform,
          mode: 'json-auth-url'
        });
      }
      // Fallback legacy body fields
      const bodyLocation = resp.data?.location || resp.data?.redirect_url || resp.data?.redirectUrl;
      if (bodyLocation) {
        console.log('Late API fallback body redirect detected. Redirecting.', { bodyLocation });
        return res.redirect(bodyLocation);
      }
      console.error('Late API did not provide redirect location nor authUrl.', {
        status: resp.status,
        dataKeys: resp.data ? Object.keys(resp.data) : null,
      });
      return res.status(502).json({
        error: 'Late API did not return redirect/auth URL',
        platform,
        profileId,
      });
    }

    // Legacy behaviour: Location header present
    return res.redirect(resp.headers.location);
  } catch (err) {
    console.error("startConnect error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to start connect" });
  }
};


/**
 * Handle the OAuth callback from Late.
 *
 * Late will redirect back to this endpoint with query parameters such as
 * `profileId`, `connected` (the platform) and `username` when the user has
 * successfully authorised the social account. This controller retrieves the
 * list of connected accounts for the profile and updates or creates a
 * VendorAccount record with the returned account information.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.connectCallback = async function connectCallback(req, res) {
  try {
    const { profileId, username, error: oauthError, connected } = req.query;
    const platform = connected || req.params.platform;
    
    // For callback, we might not have authenticated user, so handle gracefully
    // If we need userId, we can get it from profileId or make callback public
    console.log('Callback received:', { profileId, username, platform, oauthError });

    // Short-circuit on error returned by Late
    if (oauthError) {
      return res.status(400).json({ error: oauthError });
    }
    if (!profileId || !platform || !username) {
      return res.status(400).json({ error: 'Missing required OAuth parameters' });
    }

    // Find the VendorAccount by profileId to get userId
    const existingAccount = await VendorAccount.findOne({ 
      vendor_profile_id: profileId, 
      platform 
    });
    
    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found for this profile' });
    }
    
    const userId = existingAccount.user_id;

    // Retrieve all accounts for this profile from Late
    const accounts = await lateService.getAccounts(profileId);
    const accountInfo = accounts.find(
      (acc) => acc.platform === platform && acc.username === username
    );
    if (!accountInfo) {
      return res.status(404).json({ error: 'Connected account not found in Late response' });
    }

    // Upsert vendor account details in our database. We map Late fields to our
    // schema here. Note: Late returns tokenExpiresAt and isActive; convert
    // tokenExpiresAt to a Date instance and ensure fields are stored consistently.
    const updatedAccount = await VendorAccount.findOneAndUpdate(
      { user_id: userId, platform },
      {
        vendor_profile_id: profileId,
        vendor_account_id: accountInfo._id,
        username: accountInfo.username,
        display_name: accountInfo.displayName,
        token_expires_at: accountInfo.tokenExpiresAt
          ? new Date(accountInfo.tokenExpiresAt)
          : undefined,
        is_active: accountInfo.isActive,
        connected: true,
      },
      { upsert: true, new: true }
    );

    // Decide redirect target
    const env = require('../config/env');
    const clientBase = env.clientBaseUrl;
    const accountSettingsPath = '/account';
    const redirectTarget = `${clientBase}${accountSettingsPath}?connected=1&platform=${encodeURIComponent(platform || '')}`;

    // Sync all accounts for this profile from Late (ensures we capture accountId)
    let syncedAccounts = [];
    try {
      const accounts = await lateService.getAccounts(profileId);
      console.log('Late accounts fetched on callback:', { count: accounts.length });
      for (const acct of accounts) {
        if (!acct || !acct._id) continue;
        const up = await VendorAccount.findOneAndUpdate(
          { vendor_account_id: acct._id },
          {
            user_id: userId, // ensure we keep original user mapping
            platform: acct.platform,
            vendor_profile_id: acct.profileId,
            vendor_account_id: acct._id,
            username: acct.username,
            display_name: acct.displayName,
            profile_picture: acct.profilePicture,
            token_expires_at: acct.tokenExpiresAt ? new Date(acct.tokenExpiresAt) : undefined,
            permissions: acct.permissions || [],
            is_active: acct.isActive,
            connected: true,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        syncedAccounts.push(up);
      }
    } catch (syncErr) {
      console.error('Failed syncing Late accounts on callback:', syncErr?.response?.data || syncErr.message);
    }

    console.log('Connect callback success – redirecting user to client:', {
      redirectTarget,
      clientBase,
      platform,
      profileId,
      syncedAccounts: syncedAccounts.map(a => ({ platform: a.platform, accountId: a.vendor_account_id }))
    });

    // If request prefers JSON (API client) keep JSON mode
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('application/json') && !acceptHeader.includes('text/html')) {
      return res.json({
        message: `${platform} account connected successfully`,
        account: {
          profileId: updatedAccount.vendor_profile_id,
          accountId: updatedAccount.vendor_account_id,
          username: updatedAccount.username,
          displayName: updatedAccount.display_name,
          tokenExpiresAt: updatedAccount.token_expires_at,
          isActive: updatedAccount.is_active,
        },
        redirect: redirectTarget,
      });
    }

    return res.redirect(302, redirectTarget);
  } catch (err) {
    console.error('Error handling Late OAuth callback:', err);
    return res.status(500).json({ error: 'Failed to complete OAuth callback' });
  }
};

/**
 * Get the connection status for a user's social account.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getConnectionStatus = async function getConnectionStatus(req, res) {
  try {
    const { platform } = req.query;
    const userId = req.user._id;

    if (!platform) {
      return res.status(400).json({ error: 'Missing platform parameter' });
    }

    const vendorAccount = await VendorAccount.findOne({ user_id: userId, platform });

    if (!vendorAccount) {
      return res.json({ connected: false });
    }

    return res.json({
      connected: vendorAccount.connected,
      username: vendorAccount.username,
      displayName: vendorAccount.display_name,
      isActive: vendorAccount.is_active,
      tokenExpiresAt: vendorAccount.token_expires_at,
    });
  } catch (err) {
    console.error('Error getting connection status:', err);
    return res.status(500).json({ error: 'Failed to get connection status' });
  }
};

/**
 * Manually sync Late accounts for the authenticated user.
 * Useful if accountId fields missing in DB or after schema upgrade.
 */
exports.syncAccounts = async function syncAccounts(req, res) {
  try {
    const userId = req.user._id;
    // Find distinct profileIds for this user
    const profiles = await VendorAccount.distinct('vendor_profile_id', { user_id: userId });
    if (!profiles.length) {
      return res.status(400).json({ error: 'No vendor profiles found for user' });
    }
    const results = [];
    for (const profileId of profiles) {
      try {
        const accounts = await lateService.getAccounts(profileId);
        for (const acct of accounts) {
          const up = await VendorAccount.findOneAndUpdate(
            { vendor_account_id: acct._id },
            {
              user_id: userId,
              platform: acct.platform,
              vendor_profile_id: acct.profileId,
              vendor_account_id: acct._id,
              username: acct.username,
              display_name: acct.displayName,
              profile_picture: acct.profilePicture,
              token_expires_at: acct.tokenExpiresAt ? new Date(acct.tokenExpiresAt) : undefined,
              permissions: acct.permissions || [],
              is_active: acct.isActive,
              connected: true,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          results.push({ platform: up.platform, accountId: up.vendor_account_id });
        }
      } catch (e) {
        console.error('Sync profile failed:', profileId, e.message);
      }
    }
    return res.json({ synced: results });
  } catch (err) {
    console.error('syncAccounts error:', err.message);
    return res.status(500).json({ error: 'Failed to sync accounts' });
  }
};