const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { signToken } = require("../middlewares/jwt");
const env = require("../config/env");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Ensure this is set in .env

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
};
