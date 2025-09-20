const { openai } = require('../config/openai');
const seedreamsService = require('./seedreams.service');

/**
 * Generate persona-aware comprehensive video content from user prompt
 * Returns: script, storyboard, hooks, tags, caption, thumbnailIdeas, targetAudience, contentPillars
 */
const generateContent = async (prompt, persona = null) => {
  try {
    // Build persona-aware system prompt
    let systemPrompt = `Kamu adalah ahli pembuat konten video dan strategi media sosial. 
    Buat konten video yang komprehensif berdasarkan prompt pengguna yang dioptimalkan untuk platform media sosial (Instagram, TikTok, YouTube Shorts).
    
    PENTING: Berikan semua respon dalam bahasa Indonesia yang natural dan sesuai dengan budaya Indonesia.`;
    
    // Add persona context if available
    if (persona) {
      systemPrompt += `\n\nKONTEKS PERSONA KREATOR:
      - Niche Konten: ${persona.contentNiche}
      - Platform Utama: ${persona.platformPriority.replace('_', ' ').toUpperCase()}
      - Gaya Konten: ${persona.contentStyle.replace('_', ' ')}
      - Suara Brand: ${persona.brandVoice.replace('_', ' ')}
      - Target Audience: ${persona.targetAudience.ageGroup.replace('_', ' ')} (${persona.targetAudience.location})
      - Durasi Video: ${persona.videoDurationPreference}
      - Tujuan Konten: ${persona.contentGoals.join(', ')}
      
      PENTING: Sesuaikan SEMUA konten dengan persona, suara, dan preferensi audience kreator ini.`;
    }
    
    systemPrompt += `
    
    Selalu respond dengan JSON object yang valid berisi SEMUA field berikut:
    {
      "script": "Skrip video SANGAT DETAIL dengan dialog, narasi, dan instruksi akting yang lengkap. Format: [SCENE] Deskripsi setting. [DIALOG] 'Kata-kata yang diucapkan'. [ACTION] Deskripsi gerakan/aksi. Minimal 200 kata untuk script yang komprehensif.",
      "storyboard": [
        {
          "timestamp": "00:00-00:05",
          "illustration": "Deskripsi detail scene visual/ilustrasi adegan",
          "description": "Penjelasan aksi, dialog, atau elemen penting dalam scene"
        }
      ],
      "hooks": ["3 hook menarik untuk menarik perhatian dalam bahasa Indonesia"],
      "tags": ["10 hashtag relevan tanpa simbol # dalam bahasa Indonesia/Inggris"],
      "caption": "Caption media sosial yang engaging dengan emoji dalam bahasa Indonesia",
      "thumbnailIdeas": ["3 ide konsep thumbnail dalam bahasa Indonesia"],
      "targetAudience": "Deskripsi audience utama dalam bahasa Indonesia",
      "contentPillars": ["3 tema/topik utama yang dicakup konten ini dalam bahasa Indonesia"],
      "callToAction": "CTA yang jelas untuk engagement audience dalam bahasa Indonesia",
      "estimatedDuration": "Estimasi durasi video (30s, 60s, dll)",
      "difficulty": "Tingkat kesulitan pembuatan konten (Pemula/Menengah/Lanjutan)",
      "props": ["Props atau materi yang dibutuhkan dalam bahasa Indonesia"],
      "locations": ["Saran lokasi syuting dalam bahasa Indonesia"],
      "musicSuggestion": "Jenis musik latar yang direkomendasikan dalam bahasa Indonesia"
    }
    
    CRITICAL - STORYBOARD ILLUSTRATION REQUIREMENTS:
    - Buat minimal 4-6 scene dalam array storyboard
    - Setiap timestamp harus realistis sesuai durasi total video
    - ILLUSTRATION field HARUS berisi PROMPT untuk AI image generation dalam bahasa Inggris yang sangat detail dan spesifik
    - Format illustration: "A [detailed scene description], [camera angle], [lighting setup], [mood/atmosphere], [visual style], high quality, cinematic lighting"
    - Contoh illustration: "A young Indonesian person sitting in a bank queue looking extremely bored, medium shot from side angle, bright indoor fluorescent lighting, mundane everyday atmosphere, realistic social media content style, high quality, cinematic lighting"
    - DESCRIPTION field berisi penjelasan aksi/dialog dalam bahasa Indonesia untuk panduan creator
    - Pastikan illustration prompt dapat menghasilkan gambar yang realistis, sesuai budaya Indonesia, dan cocok untuk video content
    
    PENTING UNTUK SCRIPT:
    - Buat script DETAIL minimal 200-300 kata
    - Sertakan dialog lengkap yang akan diucapkan
    - Berikan instruksi akting dan gesture
    - Format dengan [OPENING] [DIALOG] [ACTION] [CLOSING]
    - Include hook pembuka, isi yang engaging, dan call-to-action
    - Sesuaikan dengan durasi video yang diminta
    
    Buat konten yang engaging, actionable, dan dioptimalkan untuk tingkat engagement tinggi. Gunakan bahasa Indonesia yang natural dan sesuai dengan budaya Indonesia.`;

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
    
    // Generate visual illustrations for storyboard using Seedreams
    // OpenAI sudah menghasilkan prompt yang optimal, langsung gunakan untuk Seedreams
    let enhancedContent = { ...content };
    
    try {
      if (content.storyboard && Array.isArray(content.storyboard)) {
        console.log('Generating visual storyboard with Seedreams...');
        
        // Use OpenAI illustration prompts directly without modification
        const visualStoryboard = await seedreamsService.generateStoryboardIllustrations(
          content.storyboard, 
          { 
            useDirectPrompts: true, // Flag to use OpenAI prompts directly
            contentNiche: persona?.contentNiche || 'general'
          }
        );
        
        enhancedContent.storyboard = visualStoryboard;
        enhancedContent.hasVisualStoryboard = true;
        
        console.log(`Generated ${visualStoryboard.length} visual illustrations from OpenAI prompts`);
      }
    } catch (error) {
      console.error('Seedreams integration error:', error);
      // Keep original text-based storyboard as fallback
      enhancedContent.hasVisualStoryboard = false;
      enhancedContent.visualError = 'Image generation unavailable, using text descriptions';
    }
    
    return {
      content: enhancedContent,
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
    const systemPrompt = `Kamu adalah strategi konten video yang sangat kreatif dan partner brainstorming. 
    Bantu pengguna mengembangkan ide konten video yang engaging dengan saran yang spesifik dan actionable.
    
    PENTING: Berikan semua respon dalam bahasa Indonesia yang natural dan sesuai dengan budaya Indonesia.
    
    Fokus pada:
    - Konsep video kreatif dan teknik storytelling
    - Strategi engagement audience
    - Optimisasi platform spesifik (Instagram, TikTok, YouTube)
    - Topik trending dan pola konten viral
    - Tips dan teknik produksi
    - Ide seri konten dan kampanye
    
    Jadilah antusias, kreatif, dan berikan saran yang detail dan actionable. 
    Ajukan pertanyaan lanjutan untuk lebih memahami visi dan tujuan mereka.`;

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
    
    const systemPrompt = `Kamu adalah ahli analisis konten dan strategi perbaikan.
    Analisis konten yang diberikan dan berikan feedback serta saran yang komprehensif.
    
    PENTING: Berikan semua respon dalam bahasa Indonesia yang natural dan sesuai dengan budaya Indonesia.
    
    Selalu respond dengan JSON object yang valid berisi:
    {
      "analysis": "Analisis detail tentang kekuatan dan kelemahan konten saat ini dalam bahasa Indonesia",
      "improvements": ["5 saran perbaikan spesifik dalam bahasa Indonesia"],
      "captionFix": {
        "current": "Caption saat ini yang terdeteksi",
        "suggested": "Caption yang disarankan untuk perbaikan"
      },
      "tagsFix": {
        "current": ["tag1", "tag2", "tag3"],
        "suggested": ["tag_baru1", "tag_baru2", "tag_baru3"]
      },
      "hooks": ["3 alternatif hook yang lebih baik dalam bahasa Indonesia"],
      "engagement": ["3 tips optimisasi engagement dalam bahasa Indonesia"],
      "trending": ["3 cara untuk sejalan dengan trend terkini dalam bahasa Indonesia"],
      "audience": "Insight target audience yang lebih tepat dalam bahasa Indonesia",
      "competition": "Insight analisis kompetitor dalam bahasa Indonesia",
      "nextSteps": ["3 langkah selanjutnya yang actionable dalam bahasa Indonesia"]
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
    const systemPrompt = `Kamu adalah strategi konten yang mengikuti trend terkini dan selalu update dengan trend media sosial terbaru.
    Generate ide konten video trending untuk niche dan platform yang ditentukan.
    
    PENTING: Berikan semua respon dalam bahasa Indonesia yang natural dan sesuai dengan budaya Indonesia.
    
    Selalu respond dengan JSON object yang valid berisi:
    {
      "trendingIdeas": [
        {
          "title": "Judul video yang menarik dalam bahasa Indonesia",
          "concept": "Deskripsi konsep detail dalam bahasa Indonesia",
          "hook": "Kalimat pembuka yang menarik perhatian dalam bahasa Indonesia",
          "trendElement": "Elemen trending apa yang digunakan dalam bahasa Indonesia",
          "difficulty": "Mudah/Sedang/Sulit",
          "engagement": "Level engagement yang diharapkan (Tinggi/Sedang/Rendah)"
        }
      ],
      "currentTrends": ["5 trend terkini dalam niche ini dalam bahasa Indonesia"],
      "hashtags": ["10 hashtag trending dalam bahasa Indonesia/Inggris"],
      "tips": ["3 tips untuk potensi viral dalam bahasa Indonesia"]
    }
    
    Generate 5 ide trending yang memiliki potensi viral tinggi. Gunakan bahasa Indonesia yang natural.`;

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

/**
 * Persona-aware chat for brainstorming and content refinement
 */
const chatWithPersona = async (messages, persona = null) => {
  try {
    let systemPrompt = `Kamu adalah strategi konten video yang sangat kreatif dan partner brainstorming. 
    Bantu pengguna mengembangkan ide konten video yang engaging dengan saran yang spesifik dan actionable.
    
    PENTING: Berikan semua respon dalam bahasa Indonesia yang natural dan sesuai dengan budaya Indonesia.`;
    
    // Add persona context if available
    if (persona) {
      systemPrompt += `\n\nKONTEKS PERSONA KREATOR:
      - Niche Konten: ${persona.contentNiche}
      - Platform Utama: ${persona.platformPriority.replace('_', ' ').toUpperCase()}
      - Gaya Konten: ${persona.contentStyle.replace('_', ' ')}
      - Suara Brand: ${persona.brandVoice.replace('_', ' ')}
      - Target Audience: ${persona.targetAudience.ageGroup.replace('_', ' ')} di ${persona.targetAudience.location}
      - Tujuan Konten: ${persona.contentGoals.join(', ')}
      
      PENTING: Berikan saran yang selaras dengan persona dan tujuan kreator ini.`;
    }
    
    systemPrompt += `
    
    Fokus pada:
    - Konsep video kreatif dan teknik storytelling
    - Strategi engagement audience
    - Optimisasi platform spesifik (Instagram, TikTok, YouTube)
    - Topik trending dan pola konten viral
    - Tips dan teknik produksi
    - Ide seri konten dan kampanye
    
    Jadilah antusias, kreatif, dan berikan saran yang detail dan actionable. 
    Ajukan pertanyaan lanjutan untuk lebih memahami visi dan tujuan mereka.`;

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
    console.error('AI Chat with Persona Error:', error);
    throw new Error(`AI persona chat error: ${error.message}`);
  }
};

/**
 * Persona-aware content analysis
 */
const analyzeContentWithPersona = async (contentData, persona = null) => {
  try {
    const { title, description, currentScript, targetAudience, platform } = contentData;
    
    let systemPrompt = `Kamu adalah ahli analisis konten dan strategi perbaikan.
    Analisis konten yang diberikan dan berikan feedback serta saran yang komprehensif.
    
    PENTING: Berikan semua respon dalam bahasa Indonesia yang natural dan sesuai dengan budaya Indonesia.`;
    
    // Add persona context if available
    if (persona) {
      systemPrompt += `\n\nKONTEKS PERSONA KREATOR:
      - Niche Konten: ${persona.contentNiche}
      - Platform Utama: ${persona.platformPriority.replace('_', ' ').toUpperCase()}
      - Gaya Konten: ${persona.contentStyle.replace('_', ' ')}
      - Suara Brand: ${persona.brandVoice.replace('_', ' ')}
      - Target Audience: ${persona.targetAudience.ageGroup.replace('_', ' ')} di ${persona.targetAudience.location}
      - Tujuan Konten: ${persona.contentGoals.join(', ')}
      
      PENTING: Analisis dan berikan saran perbaikan yang selaras dengan persona dan brand voice kreator ini.`;
    }
    
    systemPrompt += `
    
    Selalu respond dengan JSON object yang valid berisi:
    {
      "analysis": "Analisis detail tentang kekuatan dan kelemahan konten saat ini dalam bahasa Indonesia",
      "improvements": ["5 saran perbaikan spesifik dalam bahasa Indonesia"],
      "captionFix": {
        "current": "Caption saat ini yang terdeteksi",
        "suggested": "Caption yang disarankan untuk perbaikan sesuai persona"
      },
      "tagsFix": {
        "current": ["tag1", "tag2", "tag3"],
        "suggested": ["tag_baru1", "tag_baru2", "tag_baru3"]
      },
      "hooks": ["3 alternatif hook yang lebih baik dalam bahasa Indonesia"],
      "engagement": ["3 tips optimisasi engagement dalam bahasa Indonesia"],
      "trending": ["3 cara untuk sejalan dengan trend terkini dalam bahasa Indonesia"],
      "audience": "Insight target audience yang lebih tepat dalam bahasa Indonesia",
      "competition": "Insight analisis kompetitor dalam bahasa Indonesia",
      "nextSteps": ["3 langkah selanjutnya yang actionable dalam bahasa Indonesia"]
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
    console.error('AI Analyze Content with Persona Error:', error);
    throw new Error(`AI persona content analysis error: ${error.message}`);
  }
};

/**
 * Generate persona-aware trending content ideas
 */
const generateTrendingIdeasWithPersona = async (persona) => {
  try {
    const systemPrompt = `Kamu adalah strategi konten yang mengikuti trend terkini dan selalu update dengan trend media sosial terbaru.
    Generate ide konten video trending yang sempurna sesuai dengan persona dan goals kreator.
    
    PENTING: Berikan semua respon dalam bahasa Indonesia yang natural dan sesuai dengan budaya Indonesia.
    
    KONTEKS PERSONA KREATOR:
    - Niche Konten: ${persona.contentNiche}
    - Platform Utama: ${persona.platformPriority.replace('_', ' ').toUpperCase()}
    - Gaya Konten: ${persona.contentStyle.replace('_', ' ')}
    - Suara Brand: ${persona.brandVoice.replace('_', ' ')}
    - Target Audience: ${persona.targetAudience.ageGroup.replace('_', ' ')} di ${persona.targetAudience.location}
    - Durasi Video: ${persona.videoDurationPreference}
    - Tujuan Konten: ${persona.contentGoals.join(', ')}
    
    Always respond with a valid JSON object containing:
    {
      "trendingIdeas": [
        {
          "title": "Catchy video title that matches brand voice",
          "concept": "Detailed concept description tailored to niche",
          "hook": "Attention-grabbing opening line in brand voice",
          "trendElement": "What trending element it uses",
          "difficulty": "Easy/Medium/Hard",
          "engagement": "Expected engagement level (High/Medium/Low)",
          "duration": "Recommended duration based on persona",
          "personaFit": "Why this idea matches the creator's persona"
        }
      ],
      "currentTrends": ["5 current trends in this niche"],
      "hashtags": ["10 trending hashtags for this niche and platform"],
      "tips": ["3 tips for viral potential specific to this persona"],
      "audienceInsights": "Specific insights about this creator's target audience"
    }
    
    Generate 5 trending ideas that have high viral potential and perfect persona alignment.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate trending content ideas perfectly tailored to my persona` }
      ],
      temperature: 0.9,
      max_tokens: 1500,
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
    console.error('AI Trending Ideas with Persona Error:', error);
    throw new Error(`AI persona trending ideas error: ${error.message}`);
  }
};

module.exports = {
  generateContent,
  chatWithAI,
  analyzeContent,
  generateTrendingIdeas,
  // New persona-aware functions
  chatWithPersona,
  analyzeContentWithPersona,
  generateTrendingIdeasWithPersona
};
