const env = require('../config/env')
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { hashPassword, generateToken } = require('../helpers/auth');
const nodemailer = require ('nodemailer')

const client = new OAuth2Client(env.google.clientId);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.EMAIL_USER,  
    pass: env.EMAIL_PASS,  
  }
})

class AuthController {
    static async googleLogin(req, res, next) {

    const { id_token } = req.headers;

    try {
      const ticket = await client.verifyIdToken({
        idToken: id_token,
        audience: env.google.clientId,
      });

      const payload = ticket.getPayload();
      const { email, name, sub: userid } = payload;

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name,
          email,
          password: hashPassword(userid),
        });
      }

      const access_token = generateToken({ id: user.id, email: user.email });

      res.status(200).json({ access_token });

    } catch (error) {
      console.error(error);
      next(error);
    }
  }
}

module.exports = AuthController;
