const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });

// Method untuk hash password
userSchema.methods.hashPassword = function(password) {
  return bcrypt.hashSync(password, 10);
};

module.exports = mongoose.model('User', userSchema);