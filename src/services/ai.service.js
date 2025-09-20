const { openai } = require('../config/openai');

/**
 * Generate comprehensive video content from user prompt
 * Returns: script, storyboard, hooks, tags, caption, thumbnailIdeas, targetAudience, contentPillars
 */
const generateContent = async (prompt) => {
  try {
    const systemPrompt = `You are an expert video content creator and social media strategist. 
    Create comprehensive video content based on user prompts that's optimized for social media platforms (Instagram, TikTok, YouTube Shorts).
    
    Always respond with a valid JSON object containing ALL these fields:
    {
      "script": "Detailed video script with clear narrative flow",
      "storyboard": "Scene-by-scene breakdown with visual descriptions",
      "hooks": ["3 engaging hooks to capture attention"],
      "tags": ["10 relevant hashtags without # symbol"],
      "caption": "Engaging social media caption with emojis",
      "thumbnailIdeas": ["3 thumbnail concept ideas"],
      "targetAudience": "Primary audience description",
      "contentPillars": ["3 main themes/topics this content covers"],
      "callToAction": "Clear CTA for audience engagement",
      "estimatedDuration": "Estimated video length (30s, 60s, etc.)",
      "difficulty": "Content creation difficulty (Beginner/Intermediate/Advanced)",
      "props": ["Required props or materials"],
      "locations": ["Suggested filming locations"],
      "musicSuggestion": "Type of background music recommended"
    }
    
    Make content engaging, actionable, and optimized for high engagement rates.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    const content = JSON.parse(completion.choices[0].message.content);
    
    return {
      content,
      usage: {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      }
    };

  } catch (error) {
    console.error('AI Generate Content Error:', error);
    throw new Error(`AI content generation error: ${error.message}`);
  }
};

/**
 * Interactive chat for brainstorming and content refinement
 * Enhanced with context awareness and creative suggestions
 */
const chatWithAI = async (messages) => {
  try {
    const systemPrompt = `You are a highly creative video content strategist and brainstorming partner. 
    Help users develop engaging video content ideas with specific, actionable advice.
    
    Focus on:
    - Creative video concepts and storytelling techniques
    - Audience engagement strategies
    - Platform-specific optimization (Instagram, TikTok, YouTube)
    - Trending topics and viral content patterns
    - Production tips and techniques
    - Content series and campaign ideas
    
    Be enthusiastic, creative, and provide detailed, actionable suggestions. 
    Ask follow-up questions to better understand their vision and goals.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      temperature: 0.9,
      max_tokens: 800
    });

    return {
      response: completion.choices[0].message.content,
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

/**
 * Analyze existing content and provide improvement suggestions
 * For Canvas Mode 2: Discuss existing content
 */
const analyzeContent = async (contentData) => {
  try {
    const { title, description, currentScript, targetAudience, platform } = contentData;
    
    const systemPrompt = `You are an expert content analyst and improvement strategist.
    Analyze the provided content and give comprehensive feedback and suggestions.
    
    Always respond with a valid JSON object containing:
    {
      "analysis": "Detailed analysis of current content strengths and weaknesses",
      "improvements": ["5 specific improvement suggestions"],
      "hooks": ["3 better hook alternatives"],
      "engagement": ["3 engagement optimization tips"],
      "trending": ["3 ways to align with current trends"],
      "audience": "Refined target audience insights",
      "competition": "Competitive analysis insights",
      "nextSteps": ["3 actionable next steps"]
    }`;

    const userPrompt = `Analyze this content:
    Title: ${title || 'Not provided'}
    Description: ${description || 'Not provided'}
    Current Script: ${currentScript || 'Not provided'}
    Target Audience: ${targetAudience || 'Not specified'}
    Platform: ${platform || 'Not specified'}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1200,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(completion.choices[0].message.content);
    
    return {
      analysis,
      usage: {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      }
    };

  } catch (error) {
    console.error('AI Analyze Content Error:', error);
    throw new Error(`AI content analysis error: ${error.message}`);
  }
};

/**
 * Generate trending content ideas based on current trends
 */
const generateTrendingIdeas = async (niche, platform = 'instagram') => {
  try {
    const systemPrompt = `You are a trend-savvy content strategist who stays updated with the latest social media trends.
    Generate trending video content ideas for the specified niche and platform.
    
    Always respond with a valid JSON object containing:
    {
      "trendingIdeas": [
        {
          "title": "Catchy video title",
          "concept": "Detailed concept description",
          "hook": "Attention-grabbing opening line",
          "trendElement": "What trending element it uses",
          "difficulty": "Easy/Medium/Hard",
          "engagement": "Expected engagement level (High/Medium/Low)"
        }
      ],
      "currentTrends": ["5 current trends in this niche"],
      "hashtags": ["10 trending hashtags"],
      "tips": ["3 tips for viral potential"]
    }
    
    Generate 5 trending ideas that have high viral potential.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate trending content ideas for ${niche} niche on ${platform}` }
      ],
      temperature: 0.9,
      max_tokens: 1200,
      response_format: { type: "json_object" }
    });

    const trends = JSON.parse(completion.choices[0].message.content);
    
    return {
      trends,
      usage: {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      }
    };

  } catch (error) {
    console.error('AI Trending Ideas Error:', error);
    throw new Error(`AI trending ideas error: ${error.message}`);
  }
};

module.exports = {
  generateContent,
  chatWithAI,
  analyzeContent,
  generateTrendingIdeas
};
