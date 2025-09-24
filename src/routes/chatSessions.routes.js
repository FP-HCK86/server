const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const {
  saveChatSession,
  getChatSessions,
  getChatSession,
  updateChatSession,
  deleteChatSession,
  generateChatTitle
} = require('../controllers/chatSessions.controller');

// Middleware for request logging
const requestLogger = (req, res, next) => {
  console.log(`[Chat Sessions API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
};

// Apply logging middleware
router.use(requestLogger);

// All routes require authentication
router.use(authenticateToken);

// Generate AI title for chat (helper endpoint)
router.post('/generate-title', generateChatTitle);

// CRUD operations for chat sessions
router.post('/', saveChatSession);           // Create new chat session
router.get('/', getChatSessions);            // Get user's chat sessions (with pagination)
router.get('/:id', getChatSession);          // Get specific chat session
router.put('/:id', updateChatSession);       // Update chat session
router.delete('/:id', deleteChatSession);    // Delete chat session

module.exports = router;
