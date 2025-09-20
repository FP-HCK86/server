const { 
  generateContent, 
  chatWithAI, 
  analyzeContent, 
  generateTrendingIdeas,
  chatWithPersona,
  analyzeContentWithPersona,
  generateTrendingIdeasWithPersona
} = require('../services/ai.service');
const Persona = require('../models/Persona');

/**
 * Generate content from user prompt (Mode 1: Create content from scratch)
 * POST /ai/generate-content
 */
const generateContentController = async (req, res) => {
  try {
    const { prompt, usePersona = false, userId } = req.body;
    const userIdFromAuth = req.userId || userId; // From auth middleware or request body

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

    // Get persona if requested
    let persona = null;
    if (usePersona && userIdFromAuth) {
      persona = await Persona.getActivePersona(userIdFromAuth);
      if (!persona) {
        return res.status(404).json({
          success: false,
          message: 'No active persona found. Please create and activate a persona first.'
        });
      }
    }

        // Generate content using AI service (with persona if available)
    const result = await generateContent(prompt, persona);

    // Update persona usage if used
    if (persona) {
      await persona.incrementUsage();
    }

    return res.status(200).json({
      success: true,
      message: `Content generated successfully${persona ? ' with persona' : ''}`,
      data: {
        content: result.content,
        prompt: prompt.trim(),
        persona: persona ? {
          name: persona.name,
          niche: persona.contentNiche,
          platform: persona.platformPriority,
          brandVoice: persona.brandVoice
        } : null,
        usage: result.usage,
        generatedAt: new Date().toISOString()
      }
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
    console.log('[Chat Controller] Request received:', {
      body: req.body,
      headers: req.headers['content-type']
    });
    
    const { messages, usePersona = false, userId: requestUserId } = req.body;
    const userId = req.userId || requestUserId; // From auth middleware or request body

    // Validation
    if (!messages || !Array.isArray(messages)) {
      console.log('[Chat Controller] Validation failed: messages not array');
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
      ['user', 'assistant', 'system'].includes(msg.role)
    );

    if (!isValidMessages) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message format. Each message must have role (user/assistant/system) and content (string)'
      });
    }

    // Limit conversation length
    if (messages.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Conversation too long. Maximum 20 messages allowed.'
      });
    }

    // Get persona if requested
    let persona = null;
    if (usePersona && userId) {
      persona = await Persona.getActivePersona(userId);
      if (!persona) {
        return res.status(404).json({
          success: false,
          message: 'No active persona found. Please create and activate a persona first.'
        });
      }
    }

    // Chat with AI (with persona if available)
    console.log('[Chat Controller] Calling AI service with messages:', messages.length);
    const result = persona 
      ? await chatWithPersona(messages, persona)
      : await chatWithAI(messages);

    console.log('[Chat Controller] AI service response received:', {
      responseLength: result.response?.length,
      usage: result.usage
    });

    // Update persona usage if used
    if (persona) {
      await persona.incrementUsage();
    }

    const responseData = {
      success: true,
      message: `Chat response generated successfully${persona ? ' with persona' : ''}`,
      data: {
        response: result.response,
        persona: persona ? {
          name: persona.name,
          niche: persona.contentNiche,
          platform: persona.platformPriority,
          brandVoice: persona.brandVoice
        } : null,
        usage: result.usage
      }
    };

    console.log('[Chat Controller] Sending response:', {
      success: responseData.success,
      dataKeys: Object.keys(responseData.data)
    });

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('[Chat Controller] Error occurred:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process chat',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Analyze existing content and provide improvement suggestions
 * POST /ai/analyze-content
 */
const analyzeContentController = async (req, res) => {
  try {
    const { title, description, currentScript, targetAudience, platform, usePersona = false, userId: requestUserId } = req.body;
    const userId = req.userId || requestUserId; // From auth middleware or request body

    // Validation
    if (!title && !description && !currentScript) {
      return res.status(400).json({
        success: false,
        message: 'At least one of title, description, or currentScript is required'
      });
    }

    // Get persona if requested
    let persona = null;
    if (usePersona && userId) {
      persona = await Persona.getActivePersona(userId);
      if (!persona) {
        return res.status(404).json({
          success: false,
          message: 'No active persona found. Please create and activate a persona first.'
        });
      }
    }

    const contentData = { title, description, currentScript, targetAudience, platform };
    
    // Analyze content (with persona if available)
    const result = persona 
      ? await analyzeContentWithPersona(contentData, persona)
      : await analyzeContent(contentData);

    // Update persona usage if used
    if (persona) {
      await persona.incrementUsage();
    }

    return res.status(200).json({
      success: true,
      message: `Content analyzed successfully${persona ? ' with persona' : ''}`,
      data: {
        analysis: result.analysis,
        persona: persona ? {
          name: persona.name,
          niche: persona.contentNiche,
          platform: persona.platformPriority,
          brandVoice: persona.brandVoice
        } : null,
        usage: result.usage,
        analyzedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analyze Content Error:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to analyze content',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Generate trending content ideas
 * POST /ai/trending-ideas
 */
const trendingIdeasController = async (req, res) => {
  try {
    const { niche, platform = 'instagram', usePersona = false, userId: requestUserId } = req.body;
    const userId = req.userId || requestUserId; // From auth middleware or request body

    // Get persona if requested (persona takes priority over manual niche/platform)
    let persona = null;
    if (usePersona && userId) {
      persona = await Persona.getActivePersona(userId);
      if (!persona) {
        return res.status(404).json({
          success: false,
          message: 'No active persona found. Please create and activate a persona first.'
        });
      }
    }

    // Generate trending ideas
    const result = persona 
      ? await generateTrendingIdeasWithPersona(persona)
      : await generateTrendingIdeas(niche || 'general', platform);

    // Update persona usage if used
    if (persona) {
      await persona.incrementUsage();
    }

    return res.status(200).json({
      success: true,
      message: `Trending ideas generated successfully${persona ? ' with persona' : ''}`,
      data: {
        trends: result.trends,
        persona: persona ? {
          name: persona.name,
          niche: persona.contentNiche,
          platform: persona.platformPriority,
          brandVoice: persona.brandVoice
        } : null,
        usage: result.usage,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Trending Ideas Error:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate trending ideas',
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
  analyzeContentController,
  trendingIdeasController,
  healthCheckController
};
