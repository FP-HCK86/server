const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { signToken } = require("../middlewares/jwt");
const env = require("../config/env");

const cloudinary = require("../config/cloudinary");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// used by nodemailer for posting schedule
const nodemailer = require('nodemailer')
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  }
})


module.exports = {
  async register(req, res, next) {
    try {
      const { username, email, password } = req.body;

      const user = await User.create({
        username,
        email,
        password,
      });

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user || !(await user.checkPassword(password))) {
        throw { status: 401, message: "Invalid email/password" };
      }

      const token = signToken({
        id: user._id,
        email: user.email,
      });

      res.json({
        access_token: token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async googleLogin(req, res, next) {
    try {
      // Handle both body and header methods for credential
      let credential = req.body.credential || req.headers.id_token;
      const testMode = req.body.testMode;

      let payload;

      if (testMode || credential === 'test_credential') {
        // For testing purposes only - remove in production
        payload = {
          sub: "test_google_id_123", // userID
          email: "smplanner86@gmail.com",
          name: "b86 hackt", // This will be mapped to username
          picture: "https://example.com/avatar.jpg",
        };
      } else {
        if (!credential) {
          throw { status: 400, message: "Missing Google credential" };
        }

        // For PRODUCTION
        const client = new OAuth2Client(env.google.clientId);
        const ticket = await client.verifyIdToken({
          idToken: credential, // Ensure credential is the id_token from OAuth response
          audience: env.google.clientId,
        });
        payload = ticket.getPayload();
      }

      // Use the static method to find or create user
      const user = await User.findOrCreateFromGoogle(payload);

      const token = signToken({
        id: user._id,
        email: user.email,
      });

      res.json({
        access_token: token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getProfile(req, res, next) {
    try {
      const user = await User.findById(req.user.id).select('-password');
      if (!user) {
        throw { status: 404, message: "User not found" };
      }

      res.json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          googleId: user.googleId,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        throw { status: 400, message: "No file uploaded" };
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "avatars",
        public_id: `user_${req.user.id}_${Date.now()}`,
        transformation: [
          { width: 200, height: 200, crop: "fill", gravity: "face" },
          { quality: "auto" },
          { format: "auto" }
        ]
      });

      // Update user avatar in database
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { avatar: result.secure_url },
        { new: true }
      ).select('-password');

      res.json({
        message: "Avatar uploaded successfully",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const { username } = req.body;

      // Validate username
      if (!username || username.trim().length === 0) {
        throw { status: 400, message: "Username is required" };
      }

      if (username.trim().length < 2) {
        throw { status: 400, message: "Username must be at least 2 characters" };
      }

      // Update user in database
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { username: username.trim() },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        throw { status: 404, message: "User not found" };
      }

      res.json({
        message: "Profile updated successfully",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
