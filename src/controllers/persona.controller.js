const Persona = require('../models/Persona');

/**
 * Get all personas for the authenticated user
 * GET /api/persona
 */
const getUserPersonas = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId; // Adjust based on your auth middleware
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const personas = await Persona.getUserPersonas(userId);
    
    return res.status(200).json({
      success: true,
      message: 'Personas retrieved successfully',
      data: {
        personas,
        count: personas.length,
        hasActive: personas.some(p => p.isActive)
      }
    });

  } catch (error) {
    console.error('Get User Personas Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve personas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get active persona for the authenticated user
 * GET /api/persona/active
 */
const getActivePersona = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const activePersona = await Persona.getActivePersona(userId);
    
    if (!activePersona) {
      return res.status(404).json({
        success: false,
        message: 'No active persona found',
        data: { hasActivePersona: false }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Active persona retrieved successfully',
      data: {
        persona: activePersona,
        hasActivePersona: true
      }
    });

  } catch (error) {
    console.error('Get Active Persona Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve active persona',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create a new persona
 * POST /api/persona
 */
const createPersona = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const {
      name,
      contentNiche,
      platformPriority,
      contentStyle,
      videoDurationPreference,
      targetAudience,
      brandVoice,
      contentGoals,
      instagramSettings,
      tiktokSettings,
      description,
      keyTopics,
      isActive = false
    } = req.body;

    // Basic validation
    if (!name || !contentNiche || !platformPriority || !contentStyle || !videoDurationPreference || !brandVoice) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, contentNiche, platformPriority, contentStyle, videoDurationPreference, brandVoice'
      });
    }

    // Validate targetAudience structure
    if (!targetAudience || !targetAudience.ageGroup) {
      return res.status(400).json({
        success: false,
        message: 'targetAudience.ageGroup is required'
      });
    }

    // Check persona limit per user (optional: max 5 personas)
    const existingCount = await Persona.countDocuments({ userId });
    if (existingCount >= 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 personas allowed per user'
      });
    }

    const personaData = {
      userId,
      name,
      contentNiche,
      platformPriority,
      contentStyle,
      videoDurationPreference,
      targetAudience,
      brandVoice,
      contentGoals: contentGoals || [],
      instagramSettings: instagramSettings || {},
      tiktokSettings: tiktokSettings || {},
      description,
      keyTopics: keyTopics || [],
      isActive
    };

    const persona = new Persona(personaData);
    await persona.save();

    return res.status(201).json({
      success: true,
      message: 'Persona created successfully',
      data: { persona }
    });

  } catch (error) {
    console.error('Create Persona Error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create persona',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update an existing persona
 * PUT /api/persona/:id
 */
const updatePersona = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const persona = await Persona.findOne({ _id: id, userId });
    
    if (!persona) {
      return res.status(404).json({
        success: false,
        message: 'Persona not found'
      });
    }

    // Update fields
    const updateFields = [
      'name', 'contentNiche', 'platformPriority', 'contentStyle', 
      'videoDurationPreference', 'targetAudience', 'brandVoice', 
      'contentGoals', 'instagramSettings', 'tiktokSettings', 
      'description', 'keyTopics', 'isActive'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        persona[field] = req.body[field];
      }
    });

    await persona.save();

    return res.status(200).json({
      success: true,
      message: 'Persona updated successfully',
      data: { persona }
    });

  } catch (error) {
    console.error('Update Persona Error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update persona',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Set a persona as active
 * PUT /api/persona/:id/activate
 */
const activatePersona = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const persona = await Persona.findOne({ _id: id, userId });
    
    if (!persona) {
      return res.status(404).json({
        success: false,
        message: 'Persona not found'
      });
    }

    persona.isActive = true;
    await persona.save(); // Pre-save middleware will deactivate others

    return res.status(200).json({
      success: true,
      message: 'Persona activated successfully',
      data: { persona }
    });

  } catch (error) {
    console.error('Activate Persona Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to activate persona',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a persona
 * DELETE /api/persona/:id
 */
const deletePersona = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const persona = await Persona.findOne({ _id: id, userId });
    
    if (!persona) {
      return res.status(404).json({
        success: false,
        message: 'Persona not found'
      });
    }

    await Persona.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Persona deleted successfully'
    });

  } catch (error) {
    console.error('Delete Persona Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete persona',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get persona creation wizard questions
 * GET /api/persona/wizard
 */
const getPersonaWizard = async (req, res) => {
  try {
    const wizardQuestions = {
      steps: [
        {
          step: 1,
          title: "Tentang Konten Anda",
          questions: [
            {
              field: "name",
              question: "Apa nama untuk persona ini?",
              type: "text",
              placeholder: "Contoh: Travel Blogger, Food Creator, etc.",
              required: true
            },
            {
              field: "contentNiche",
              question: "Apa niche konten Anda?",
              type: "select",
              options: [
                { value: "food", label: "Food & Kuliner" },
                { value: "fashion", label: "Fashion & Style" },
                { value: "tech", label: "Technology" },
                { value: "lifestyle", label: "Lifestyle" },
                { value: "comedy", label: "Comedy & Entertainment" },
                { value: "education", label: "Education & Tips" },
                { value: "dance", label: "Dance & Music" },
                { value: "beauty", label: "Beauty & Skincare" },
                { value: "fitness", label: "Fitness & Health" },
                { value: "travel", label: "Travel & Adventure" },
                { value: "business", label: "Business & Career" },
                { value: "motivation", label: "Motivational" },
                { value: "other", label: "Lainnya" }
              ],
              required: true
            }
          ]
        },
        {
          step: 2,
          title: "Platform & Style",
          questions: [
            {
              field: "platformPriority",
              question: "Platform mana yang menjadi fokus utama?",
              type: "select",
              options: [
                { value: "instagram_reels", label: "Instagram Reels" },
                { value: "tiktok", label: "TikTok" },
                { value: "both_equally", label: "Keduanya sama penting" }
              ],
              required: true
            },
            {
              field: "contentStyle",
              question: "Bagaimana style konten Anda?",
              type: "select",
              options: [
                { value: "trendy_viral", label: "Trendy & Viral" },
                { value: "educational", label: "Educational & Tutorial" },
                { value: "behind_scenes", label: "Behind the Scenes" },
                { value: "product_showcase", label: "Product Showcase" },
                { value: "storytelling", label: "Storytelling" },
                { value: "entertainment", label: "Pure Entertainment" }
              ],
              required: true
            },
            {
              field: "videoDurationPreference",
              question: "Durasi video yang biasa Anda buat?",
              type: "select",
              options: [
                { value: "15s", label: "15 detik (Quick & Snappy)" },
                { value: "30s", label: "30 detik (Standard)" },
                { value: "60s", label: "60 detik (Detailed)" },
                { value: "mixed", label: "Bervariasi" }
              ],
              required: true
            }
          ]
        },
        {
          step: 3,
          title: "Audience & Voice",
          questions: [
            {
              field: "targetAudience.ageGroup",
              question: "Siapa target audience utama Anda?",
              type: "select",
              options: [
                { value: "gen_z_16_24", label: "Gen Z (16-24 tahun)" },
                { value: "millennial_25_40", label: "Millennial (25-40 tahun)" },
                { value: "mixed_16_40", label: "Campuran (16-40 tahun)" }
              ],
              required: true
            },
            {
              field: "brandVoice",
              question: "Bagaimana brand voice Anda?",
              type: "select",
              options: [
                { value: "fun_energetic", label: "Fun & Energetic" },
                { value: "professional", label: "Professional" },
                { value: "relatable", label: "Relatable & Friendly" },
                { value: "inspirational", label: "Inspirational" },
                { value: "humorous", label: "Humorous & Witty" }
              ],
              required: true
            }
          ]
        }
      ]
    };

    return res.status(200).json({
      success: true,
      message: 'Persona wizard retrieved successfully',
      data: wizardQuestions
    });

  } catch (error) {
    console.error('Get Persona Wizard Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve persona wizard'
    });
  }
};

module.exports = {
  getUserPersonas,
  getActivePersona,
  createPersona,
  updatePersona,
  activatePersona,
  deletePersona,
  getPersonaWizard
};
