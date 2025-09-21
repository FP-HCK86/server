const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

module.exports = async function authentication(req, res, next) {
  try {
    const { authorization } = req.headers;
    if (!authorization) throw { status: 401, message: "Missing token" };
    
    const token = authorization.split(" ")[1];
    const payload = jwt.verify(token, env.jwtSecret);
    
    // Use Mongoose instead of Sequelize
    const user = await User.findById(payload.id);
    if (!user) throw { status: 401, message: "Invalid user" };
    
    req.user = {
      id: user._id,
      email: user.email,
      username: user.username,
    
    };
    next();
  } catch (err) {
    next(err);
  }
};