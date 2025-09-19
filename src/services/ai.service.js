const { openai } = require('../config/openai');

/**
 * Generate content from AI based on user prompt
 * @param {string} prompt - User's creative prompt
 * @returns {Object} - Generated content with script, storyboard, hooks, tags, and caption
 */
const generateContent = async (prompt) => {
  try {
    const systemPrompt = `You are a professional video content creator AI assistant for Planoria platform. 
Your task is to help users create engaging video content by generating comprehensive content packages based on their ideas.

When given a user prompt, you must respond with a JSON object containing exactly these 5 components:
1. script - A detailed video script with narration and actions
2. storyboard - Visual scene descriptions for each part of the video  
3. hooks - 3 engaging opening lines to capture viewer attention
4. tags - Relevant hashtags for social media (without # symbol)
5. caption - An engaging social media caption

Format your response as a valid JSON object with these exact keys. Make content suitable for social media platforms like Instagram, TikTok, and YouTube Shorts.

Example format:
{
  "script": "Detailed video script here...",
  "storyboard": "Scene 1: Description... Scene 2: Description...",
  "hooks": ["Hook 1", "Hook 2", "Hook 3"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "caption": "Engaging caption with call to action..."
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const aiResponse = completion.choices[0].message.content;
    
    // Parse JSON response from AI
    let contentData;
    try {
      contentData = JSON.parse(aiResponse);
    } catch (parseError) {
      // If JSON parsing fails, create a structured response
      contentData = {
        script: aiResponse,
        storyboard: "AI response was not in expected format. Please provide a more specific prompt.",
        hooks: ["Engaging hook 1", "Engaging hook 2", "Engaging hook 3"],
        tags: ["content", "video", "creative"],
        caption: "Check out this amazing content! What do you think?"
      };
    }

    // Validate required fields
    const requiredFields = ['script', 'storyboard', 'hooks', 'tags', 'caption'];
    const missingFields = requiredFields.filter(field => !contentData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    return {
      success: true,
      data: contentData,
      usage: {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      }
    };

  } catch (error) {
    console.error('AI Service Error:', error);
    
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded. Please check your billing.');
    }
    
    if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    }

    throw new Error(`AI service error: ${error.message}`);
  }
};

/**
 * Chat with AI for iterative content creation
 * @param {Array} messages - Conversation history
 * @returns {Object} - AI response
 */
const chatWithAI = async (messages) => {
  try {
    const systemMessage = {
      role: "system",
      content: `You are a professional video content creator AI assistant for Planoria platform. 
Help users brainstorm, refine, and create engaging video content. Be creative, helpful, and provide actionable advice.
Focus on content that works well on social media platforms like Instagram, TikTok, and YouTube Shorts.`
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [systemMessage, ...messages],
      temperature: 0.8,
      max_tokens: 800
    });

    return {
      success: true,
      message: completion.choices[0].message.content,
      usage: {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      }
    };

  } catch (error) {
    console.error('AI Chat Error:', error);
    throw new Error(`AI chat error: ${error.message}`);
  }
};

module.exports = {
  generateContent,
  chatWithAI
};
