const axios = require('axios');

/**
 * Seedreams AI Image Generation Service (BytePlus ModelArk)
 * Integrates with BytePlus's Seedreams API for visual content generation
 */

class SeedreamsService {
  constructor() {
    this.apiKey = process.env.ARK_API_KEY;
    this.baseURL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
    this.model = 'seedream-4-0-250828';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 seconds timeout for image generation
    });
  }

  /**
   * Generate image illustration for storyboard scene
   * @param {string} sceneDescription - Detailed description of the scene
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Generated image result
   */
  async generateSceneIllustration(sceneDescription, options = {}) {
    try {
            // Use real API if key is available
      if (!this.apiKey) {
        console.log(`⚠️ Seedreams API key not found - using mock data`);
        console.log(`🎨 [MOCK] Generating image for scene: ${prompt.substring(0, 50)}...`);
        
        return {
          success: true,
          imageUrl: `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`,
          mockGenerated: true
        };
      }

      const {
        size = '2K',
        watermark = true,
        sequential_image_generation = 'disabled'
      } = options;

      const payload = {
        model: this.model,
        prompt: sceneDescription,
        sequential_image_generation,
        response_format: 'url',
        size,
        stream: false,
        watermark
      };

      console.log('Generating scene illustration with Seedreams:', { 
        prompt: sceneDescription.substring(0, 100) + '...', 
        model: this.model 
      });

      const response = await this.client.post('/images/generations', payload);

      if (response.data.data && response.data.data.length > 0) {
        const imageData = response.data.data[0];
        
        return {
          success: true,
          imageUrl: imageData.url,
          imageId: `seedreams_${response.data.created}`,
          size: imageData.size,
          metadata: {
            prompt: sceneDescription,
            model: this.model,
            generatedAt: new Date().toISOString(),
            usage: response.data.usage
          }
        };
      }

      throw new Error('No images generated from Seedreams API');

    } catch (error) {
      console.error('Seedreams Image Generation Error:', error.response?.data || error.message);
      
      // Return fallback placeholder
      return {
        success: false,
        error: error.message,
        fallbackUrl: this.generatePlaceholderImage(sceneDescription)
      };
    }
  }

  /**
   * Generate multiple scene illustrations for storyboard
   * @param {Array} scenes - Array of scene objects with descriptions
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} - Array of generated image results
   */
  async generateStoryboardIllustrations(scenes, options = {}) {
    try {
      console.log(`Generating ${scenes.length} storyboard illustrations with Seedreams...`);
      
      const illustrationPromises = scenes.map(async (scene, index) => {
        // Use OpenAI illustration prompt directly if useDirectPrompts is true
        const seedreamsPrompt = options.useDirectPrompts 
          ? scene.illustration  // OpenAI sudah generate prompt yang optimal
          : this.enhanceSceneDescription(scene.illustration, scene.description, options);
        
        console.log(`Scene ${index + 1} - Using prompt: ${seedreamsPrompt.substring(0, 100)}...`);
        
        const result = await this.generateSceneIllustration(seedreamsPrompt, {
          ...options,
          scene_number: index + 1,
          timestamp: scene.timestamp
        });

        return {
          ...scene,
          illustrationImage: result.success ? result.imageUrl : result.fallbackUrl,
          imageMetadata: result.metadata || null,
          generationSuccess: result.success,
          imageSize: result.size || null,
          seedreamsPrompt: seedreamsPrompt // Store the actual prompt used for Seedreams
        };
      });

      const results = await Promise.all(illustrationPromises);
      
      console.log(`Generated ${results.length} storyboard illustrations`);
      
      return results;

    } catch (error) {
      console.error('Batch Storyboard Generation Error:', error);
      throw error;
    }
  }

  /**
   * Enhance scene description with context for better image generation
   * @param {string} illustration - Original illustration description
   * @param {string} description - Scene description/action
   * @param {Object} options - Additional context
   * @returns {string} - Enhanced prompt for image generation
   */
  enhanceSceneDescription(illustration, description, options = {}) {
    const {
      videoStyle = 'social media content',
      contentNiche = 'general',
      mood = 'engaging'
    } = options;

    // Create enhanced prompt for better image generation
    let enhancedPrompt = `${illustration}. ${description}. `;
    
    // Add style context for better visual generation
    enhancedPrompt += `Professional ${videoStyle} style, `;
    enhancedPrompt += `${contentNiche} content theme, `;
    enhancedPrompt += `${mood} mood, `;
    
    // Add technical specifications for quality
    enhancedPrompt += 'high quality, cinematic lighting, clear composition, suitable for video production, ';
    enhancedPrompt += 'realistic textures, vibrant colors, professional photography style.';

    return enhancedPrompt;
  }

  /**
   * Generate mock image for development/testing
   * @param {string} description - Scene description
   * @param {Object} options - Generation options
   * @returns {string} - Mock image URL
   */
  generateMockImage(description, options = {}) {
    // Use placeholder image service with scene description
    const encodedDescription = encodeURIComponent(description.substring(0, 50));
    const size = options.size === '2K' ? '1760x2368' : '1024x576';
    
    // Using picsum for realistic mock images
    const imageId = Math.floor(Math.random() * 1000) + 1;
    return `https://picsum.photos/${size.replace('x', '/')}?random=${imageId}&blur=1`;
  }

  /**
   * Generate placeholder image when generation fails
   * @param {string} description - Scene description for placeholder
   * @returns {string} - Placeholder image data URL
   */
  generatePlaceholderImage(description) {
    const placeholderText = description.substring(0, 30) + '...';
    
    // Create simple SVG placeholder
    const svgPlaceholder = `data:image/svg+xml;base64,${Buffer.from(`
      <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f3f4f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect x="10" y="10" width="300" height="160" fill="white" stroke="#d1d5db" stroke-width="2" rx="8" opacity="0.8"/>
        <text x="160" y="70" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6b7280" font-weight="bold">
          🎬 Scene Placeholder
        </text>
        <text x="160" y="90" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#9ca3af">
          ${placeholderText}
        </text>
        <text x="160" y="110" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#d1d5db">
          Image generation unavailable
        </text>
        <circle cx="160" cy="130" r="12" fill="#e5e7eb"/>
        <polygon points="156,125 156,135 164,130" fill="#9ca3af"/>
      </svg>
    `).toString('base64')}`;

    return svgPlaceholder;
  }

  /**
   * Check Seedreams API health/connection
   * @returns {Promise<boolean>} - API availability status
   */
  async checkConnection() {
    try {
      if (!this.apiKey) {
        console.warn('Seedreams API key not configured');
        return false;
      }

      // Test with a simple generation request
      const testPayload = {
        model: this.model,
        prompt: 'test image generation',
        size: '1K',
        stream: false,
        watermark: true
      };

      const response = await this.client.post('/images/generations', testPayload);
      return response.status === 200;

    } catch (error) {
      console.error('Seedreams connection check failed:', error.message);
      return false;
    }
  }
}

module.exports = new SeedreamsService();
