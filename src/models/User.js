const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password not required if using Google auth
    },
  },
  googleId: {
    type: String,
    sparse: true, // Allows multiple null values
  },
  avatar: {
    type: String,
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.checkPassword = async function(password) {
  if (!this.password) return false;
  return await bcrypt.compare(password, this.password);
};

// Static method for Google OAuth
userSchema.statics.findOrCreateFromGoogle = async function(googleProfile) {
  const { sub: googleId, email, name, picture } = googleProfile;
  
  let user = await this.findOne({ 
    $or: [
      { googleId },
      { email }
    ]
  });
  
  if (!user) {
    user = await this.create({
      username: name, // Changed from 'name' to 'username'
      email,
      googleId,
      avatar: picture,
    });
  } else if (!user.googleId) {
    // Link existing email account with Google
    user.googleId = googleId;
    if (picture && !user.avatar) user.avatar = picture;
    await user.save();
  }
  
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;