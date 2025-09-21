const { getUserAccounts } = require('../services/connectSocialLate.service');
const VendorAccount = require('../models/VendorAccount');
const User = require('../models/User');

/**
 * Get user profile with both userId and profileId for social media integration
 */
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("Getting profile for userId:", userId);
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    let profileId = null;

    // 1. Check if profileId exists in database
    if (user.profileId) {
      profileId = user.profileId;
      console.log("Found profileId in database:", profileId);
    } else {
      console.log("No profileId in database, checking service...");
      
      // 2. Get profileId from connectSocialLate service
      try {
        const accounts = getUserAccounts(userId);
        console.log("Accounts from service:", accounts);
        
        if (accounts && accounts.profileId) {
          profileId = accounts.profileId;
          console.log("Found profileId in service:", profileId);
          
          // Save the profileId to user record for future use
          await User.findByIdAndUpdate(userId, { profileId });
        }
      } catch (error) {
        console.log("Failed to get profile from Late API:", error.message);
      }

      // 3. Fallback to environment variable
      if (!profileId) {
        profileId = process.env.LATE_PROFILE_ID;
        console.log("Using fallback profileId from env:", profileId);
      }
    }

    console.log("Final profileId:", profileId);

    res.json({
      status: "success",
      data: {
        userId,
        profileId: profileId || null, // Always include profileId, even if null
        user: {
          username: user.username,
          email: user.email,
          avatar: user.avatar
        }
      }
    });

  } catch (error) {
    console.error("Error getting user profile:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

/**
 * Get social media connection status for current user
 */
exports.getConnectionStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const connections = await VendorAccount.find({ user_id: userId });
    
    const connectionStatus = {
      instagram: connections.find(conn => conn.platform === 'instagram')?.connected || false,
      tiktok: connections.find(conn => conn.platform === 'tiktok')?.connected || false
    };

    res.json({
      status: "success",
      data: connectionStatus
    });

  } catch (error) {
    console.error("Error getting connection status:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};