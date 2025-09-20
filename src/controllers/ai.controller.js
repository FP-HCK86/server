const { generateContent, chatWithAI } = require('../services/ai.service');

/**
 * Generate content from user prompt (Mode 1: Create content from scratch)
 * POST /ai/generate-content
 */
const generateContentController = async (req, res) => {
  try {
    const { prompt } = req.body;

    // Validation
    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prompt must be a non-empty string'
      });
    }

    if (prompt.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Prompt must be less than 500 characters'
      });
    }

    // Generate content using AI service
    const result = await generateContent(prompt.trim());

    return res.status(200).json({
      success: true,
      message: 'Content generated successfully',
      data: result.data,
      usage: result.usage
    });

  } catch (error) {
    console.error('Generate Content Error:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate content',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Chat with AI for brainstorming and refinement
 * POST /ai/chat
 */
const chatController = async (req, res) => {
  try {
    const { messages } = req.body;

    // Validation
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: 'Messages array is required'
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
      ['user', 'assistant'].includes(msg.role)
    );

    if (!isValidMessages) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message format. Each message must have role (user/assistant) and content (string)'
      });
    }

    // Limit conversation length
    if (messages.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Conversation too long. Maximum 20 messages allowed.'
      });
    }

    // Chat with AI
    const result = await chatWithAI(messages);

    return res.status(200).json({
      success: true,
      message: 'Chat response generated successfully',
      data: {
        response: result.message,
        usage: result.usage
      }
    });

  } catch (error) {
    console.error('Chat Controller Error:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process chat',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Health check for AI service
 * GET /ai/health
 */
const healthCheckController = async (req, res) => {
  try {
    // Test AI service with a simple prompt
    const testResult = await chatWithAI([
      { role: 'user', content: 'Hello, are you working?' }
    ]);

    return res.status(200).json({
      success: true,
      message: 'AI service is healthy',
      data: {
        status: 'operational',
        timestamp: new Date().toISOString(),
        testResponse: testResult.message
      }
    });

  } catch (error) {
    console.error('AI Health Check Error:', error);
    
    return res.status(503).json({
      success: false,
      message: 'AI service is not available',
      error: error.message
    });
  }
};

module.exports = {
  generateContentController,
  chatController,
  healthCheckController
};
