const express = require('express');
const multer = require('multer');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authentication = require('../middlewares/authentication');

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// AUTH ROUTES
router.post('/google-login', authController.googleLogin);
router.post('/register', authController.register);
router.post('/login', authController.login);

// PROTECTED ROUTES
router.get('/profile', authentication, authController.getProfile);
router.patch('/profile', authentication, authController.updateProfile);
router.post('/upload-avatar', authentication, upload.single('avatar'), authController.uploadAvatar);
router.get('/dashboard', authentication, (req, res) => {
  res.json({ user: req.user });
});


module.exports = router;