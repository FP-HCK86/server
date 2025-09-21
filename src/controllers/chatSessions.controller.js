const ChatSession = require('../models/ChatSession');
const Persona = require('../models/Persona');
const { chatWithAI } = require('../services/ai.service');

/**
 * Save a new chat session
 * POST /chat-sessions
 */
const saveChatSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, messages, persona, generatedContent } = req.body;

    // Validation
    if (!title || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: 'Title and messages array are required'
      });
    }

    if (messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one message is required'
      });
    }

    // Validate message format
    const isValidMessages = messages.every(msg => 
      msg && 
      typeof msg === 'object' && 
      typeof msg.role === 'string' && 
      typeof msg.content === 'string' &&
      ['user', 'assistant', 'system'].includes(msg.role)
    );

    if (!isValidMessages) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message format'
      });
    }

    // Create new chat session
    const chatSession = new ChatSession({
      userId,
      title: title.trim(),
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
      })),
      persona: persona ? persona._id || persona : null,
      generatedContent
    });

    await chatSession.save();

    // Populate persona data for response
    await chatSession.populate('persona', 'name contentNiche');

    return res.status(201).json({
      success: true,
      message: 'Chat session saved successfully',
      data: {
        session: chatSession
      }
    });

  } catch (error) {
    console.error('Save Chat Session Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save chat session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's chat sessions
 * GET /chat-sessions
 */
const getChatSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, page = 1 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const sessions = await ChatSession.find({ userId })
      .populate('persona', 'name contentNiche')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ChatSession.countDocuments({ userId });

    return res.status(200).json({
      success: true,
      message: 'Chat sessions retrieved successfully',
      data: {
        sessions,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get Chat Sessions Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get specific chat session
 * GET /chat-sessions/:id
 */
const getChatSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const session = await ChatSession.findOne({ _id: id, userId })
      .populate('persona', 'name contentNiche platformPriority brandVoice');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Chat session retrieved successfully',
      data: {
        session
      }
    });

  } catch (error) {
    console.error('Get Chat Session Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update chat session
 * PUT /chat-sessions/:id
 */
const updateChatSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, messages, generatedContent } = req.body;

    const session = await ChatSession.findOne({ _id: id, userId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    // Update fields if provided
    if (title) session.title = title.trim();
    if (messages && Array.isArray(messages)) {
      session.messages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
      }));
    }
    if (generatedContent !== undefined) session.generatedContent = generatedContent;

    await session.save();
    await session.populate('persona', 'name contentNiche');

    return res.status(200).json({
      success: true,
      message: 'Chat session updated successfully',
      data: {
        session
      }
    });

  } catch (error) {
    console.error('Update Chat Session Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update chat session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete chat session
 * DELETE /chat-sessions/:id
 */
const deleteChatSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const session = await ChatSession.findOneAndDelete({ _id: id, userId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Chat session deleted successfully'
    });

  } catch (error) {
    console.error('Delete Chat Session Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete chat session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Generate AI title for chat session
 * POST /chat-sessions/generate-title
 */
const generateChatTitle = async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Messages array is required'
      });
    }

    // Get first few user messages to generate title
    const userMessages = messages
      .filter(msg => msg.role === 'user')
      .slice(0, 3)
      .map(msg => msg.content)
      .join(' ');

    if (!userMessages.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No user messages found'
      });
    }

    // Use AI to generate a concise title
    const titlePrompt = `Generate a short, descriptive title (max 10 words) for this conversation topic: "${userMessages.substring(0, 200)}"`;
    
    const result = await chatWithAI([
      { role: 'user', content: titlePrompt }
    ]);

    let title = result.response || 'New Chat';
    
    // Clean up the title
    title = title.replace(/['"]/g, '').trim();
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }

    return res.status(200).json({
      success: true,
      message: 'Title generated successfully',
      data: {
        title
      }
    });

  } catch (error) {
    console.error('Generate Chat Title Error:', error);
    
    // Fallback title generation
    const { messages } = req.body;
    let fallbackTitle = 'New Chat';
    
    if (messages && messages.length > 0) {
      const firstUserMessage = messages.find(msg => msg.role === 'user');
      if (firstUserMessage) {
        fallbackTitle = firstUserMessage.content.substring(0, 30).trim();
        if (firstUserMessage.content.length > 30) fallbackTitle += '...';
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Title generated with fallback',
      data: {
        title: fallbackTitle
      }
    });
  }
};

module.exports = {
  saveChatSession,
  getChatSessions,
  getChatSession,
  updateChatSession,
  deleteChatSession,
  generateChatTitle
};
