// controllers/videos.controller.js
const Video = require("../models/Video");
const cloudinary = require("../config/cloudinary");
const transcriptService = require("../services/transcript.service");
const aiService = require("../services/ai.service");

// ... uploadVideo & listMyVideos tetap seperti sebelumnya

const uploadVideo = async (req, res) => {
  try {
    const user_id = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload ke Cloudinary
    const streamUpload = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "video",
            folder:
              process.env.CLOUDINARY_VIDEO_FOLDER || "content-planner/videos",
          },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
      });

    const result = await streamUpload();

    // Simpan ke database
    const video = new Video({
      user_id,
      title: req.body.title || req.file.originalname,
      caption: req.body.caption || "",
      hashtags: req.body.hashtags || "",
      secure_url: result.secure_url,
      public_id: result.public_id,
      duration_sec:
        typeof result.duration === "number" ? Math.round(result.duration) : 0,
    });

    await video.save();

    return res.status(201).json({
      message: "Video uploaded successfully",
      video,
    });
  } catch (err) {
    console.error("Error uploadVideo:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const listMyVideos = async (req, res) => {
  try {
    const user_id = req.user.id;

    const videos = await Video.find({ user_id }).sort({ createdAt: -1 });

    return res.json({ items: videos });
  } catch (err) {
    console.error("Error listMyVideos:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const getVideo = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    const video = await Video.findOne({ _id: id, user_id });
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    return res.json({ video });
  } catch (err) {
    console.error("Error getVideo:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const updateVideo = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    // Cari video milik user
    const doc = await Video.findOne({ _id: id, user_id });
    if (!doc) return res.status(404).json({ error: "Video not found" });

    // Update metadata jika ada
    const { caption, hashtags, title } = req.body;
    if (typeof caption === "string") doc.caption = caption;
    if (typeof hashtags === "string") doc.hashtags = hashtags;
    if (typeof title === "string") doc.title = title;

    // Jika ada file baru => upload ke Cloudinary, opsional hapus yang lama
    if (req.file) {
      // upload baru
      const streamUpload = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: "video",
              folder:
                process.env.CLOUDINARY_VIDEO_FOLDER || "content-planner/videos",
            },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(req.file.buffer);
        });

      const result = await streamUpload();

      const oldPublicId = doc.public_id;
      // set data baru
      doc.secure_url = result.secure_url;
      doc.public_id = result.public_id;
      doc.duration_sec =
        typeof result.duration === "number"
          ? Math.round(result.duration)
          : doc.duration_sec;

      // Optional: hapus file lama jika diminta
      const deleteOld =
        (req.query.deleteOld || "").toString().toLowerCase() === "true";
      if (deleteOld && oldPublicId) {
        try {
          await cloudinary.uploader.destroy(oldPublicId, {
            resource_type: "video",
          });
        } catch (e) {
          // jangan gagalkan seluruh update jika gagal hapus lama
          console.warn("Cloudinary delete old error:", e?.message || e);
        }
      }
    }

    await doc.save();
    return res.json({ message: "Video updated successfully", video: doc });
  } catch (err) {
    console.error("Error updateVideo:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    const doc = await Video.findOne({ _id: id, user_id });
    if (!doc) return res.status(404).json({ error: "Video not found" });

    // Hapus di Cloudinary bila ada public_id
    if (doc.public_id) {
      try {
        await cloudinary.uploader.destroy(doc.public_id, {
          resource_type: "video",
        });
      } catch (e) {
        console.warn("Cloudinary destroy error:", e?.message || e);
        // lanjut hapus DB meski cloudinary gagal (pilihan desain)
      }
    }

    await doc.deleteOne();
    return res.json({ message: "Video deleted successfully" });
  } catch (err) {
    console.error("Error deleteVideo:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const analyzeVideo = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    // Find video owned by user
    const video = await Video.findOne({ _id: id, user_id });
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    console.log('🎬 Video found for analysis:', {
      id: video._id,
      title: video.title,
      transcript_status: video.transcript_status,
      hasTranscript: !!video.transcript
    });

    // Check if transcript already exists
    if (video.transcript_status === 'completed' && video.transcript) {
      return res.json({ 
        message: "Video already analyzed",
        status: "completed",
        transcript: video.transcript
      });
    }

    // Check if analysis is already in progress
    if (video.transcript_status === 'processing') {
      console.log('📤 Sending response: Analysis already in progress');
      const response = { 
        message: "Analysis already in progress",
        status: "processing"
      };
      console.log('📤 Response data:', response);
      return res.json(response);
    }

    // Get Socket.IO instance from app
    const io = req.app.get('io');
    if (!io) {
      return res.status(500).json({ error: "WebSocket not available" });
    }

    // Start transcript extraction in background
    setImmediate(async () => {
      try {
        // Update status to processing
        video.transcript_status = 'processing';
        video.transcript_metadata = {
          started_at: new Date(),
          progress: 0
        };
        await video.save();

        // Emit progress update
        io.to(`video-analysis-${id}`).emit('transcript-progress', {
          videoId: id,
          status: 'processing',
          progress: 0,
          message: 'Starting transcript extraction...'
        });

        // Extract transcript using service
        const result = await transcriptService.extractTranscript(
          video._id,
          (progressData) => {
            console.log('📡 Progress callback received:', progressData);
            // Emit progress updates via WebSocket
            const progressMessage = {
              videoId: id,
              status: 'processing',
              progress: progressData.progress || progressData.percentage || 0,
              message: progressData.message || 'Processing...'
            };
            console.log('📡 Emitting progress:', progressMessage);
            io.to(`video-analysis-${id}`).emit('transcript-progress', progressMessage);
          }
        );

        // Update video with transcript result
        video.transcript = result.transcript;
        video.transcript_status = 'completed';
        video.hasTranscript = true;
        video.transcript_metadata = {
          ...video.transcript_metadata,
          completed_at: new Date(),
          processing_time_ms: result.processing_time_ms,
          word_count: result.transcript.split(' ').length,
          confidence_score: result.confidence_score
        };
        await video.save();

        // Step 2: Analyze content with AI
        io.to(`video-analysis-${id}`).emit('transcript-progress', {
          videoId: id,
          status: 'processing',
          progress: 80,
          message: 'Menganalisis konten dengan AI...'
        });

        try {
          // Import AI service
          const { analyzeContent } = require('../services/ai.service');
          
          // Prepare content data for analysis
          const contentData = {
            title: video.title,
            description: video.description || '',
            currentScript: result.transcript,
            targetAudience: 'General Indonesian audience',
            platform: 'Social Media'
          };

          // Perform AI analysis
          const aiAnalysisResult = await analyzeContent(contentData);
          console.log('🤖 AI Analysis Result:', JSON.stringify(aiAnalysisResult, null, 2));
          
          // Update video with AI analysis results
          video.analysis_status = 'completed';
          video.hasAIAnalysis = true;
          video.aiAnalysis = aiAnalysisResult.analysis.analysis || 'Analisis berhasil diselesaikan';
          video.aiSuggestions = {
            improvements: aiAnalysisResult.analysis.improvements || [],
            captionFix: aiAnalysisResult.analysis.captionFix || { current: '', suggested: '' },
            tagsFix: aiAnalysisResult.analysis.tagsFix || { current: [], suggested: [] },
            hooks: aiAnalysisResult.analysis.hooks || [],
            engagement: aiAnalysisResult.analysis.engagement || [],
            trending: aiAnalysisResult.analysis.trending || [],
            audience: aiAnalysisResult.analysis.audience || 'Target audience tidak teridentifikasi'
          };
          await video.save();
        } catch (aiError) {
          console.error('❌ AI Analysis failed:', aiError);
          // Still mark as completed but without AI analysis
          video.analysis_status = 'failed';
          video.hasAIAnalysis = false;
          video.aiAnalysis = 'Analisis AI gagal dilakukan. Transcript tersedia untuk chat.';
          await video.save();
        }

        // Emit completion
        io.to(`video-analysis-${id}`).emit('transcript-progress', {
          videoId: id,
          status: 'completed',
          progress: 100,
          message: 'Analisis video selesai! Hasil tersedia di chat dan saran perbaikan.',
          transcript: result.transcript,
          analysis: aiAnalysis.analysis
        });

      } catch (error) {
        console.error('Transcript extraction error:', error);
        
        // Update video with error status
        video.transcript_status = 'failed';
        video.transcript_metadata = {
          ...video.transcript_metadata,
          error_at: new Date(),
          error_message: error.message
        };
        await video.save();

        // Emit error
        io.to(`video-analysis-${id}`).emit('transcript-progress', {
          videoId: id,
          status: 'failed',
          progress: 0,
          message: `Analysis failed: ${error.message}`
        });
      }
    });

    console.log('📤 Sending response: Video analysis started');
    const response = {
      message: "Video analysis started",
      status: "processing",
      videoId: id
    };
    console.log('📤 Response data:', response);
    
    return res.json(response);

  } catch (err) {
    console.error("Error analyzeVideo:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const getVideoTranscript = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    // Find video owned by user
    const video = await Video.findOne({ _id: id, user_id });
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    return res.json({
      videoId: id,
      status: video.transcript_status || 'pending',
      transcript: video.transcript || null,
      metadata: video.transcript_metadata || null
    });

  } catch (err) {
    console.error("Error getVideoTranscript:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Chat with AI about video
const chatWithVideo = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;
    const { message, context } = req.body;

    // Find video owned by user and refresh from database
    const video = await Video.findOne({ _id: id, user_id }).lean();
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    console.log('🎬 Video data for chat (fresh from DB):', {
      id: video._id,
      title: video.title,
      hasAIAnalysis: video.hasAIAnalysis,
      transcript: video.transcript ? 'Present' : 'Not present',
      transcriptLength: video.transcript ? video.transcript.length : 0,
      aiAnalysis: video.aiAnalysis ? 'Present' : 'Not present',
      aiSuggestions: video.aiSuggestions ? 'Present' : 'Not present',
      allFields: Object.keys(video)
    });

    // Check if video has AI analysis (check multiple conditions)
    const hasAnalysis = video.hasAIAnalysis || (video.transcript && video.aiAnalysis);
    
    if (!hasAnalysis) {
      console.log('❌ Video has no AI analysis:', {
        hasAIAnalysis: video.hasAIAnalysis,
        hasTranscript: !!video.transcript,
        hasAiAnalysis: !!video.aiAnalysis
      });
      return res.status(400).json({ 
        error: "Video analysis required",
        message: "Please analyze the video first before chatting about it"
      });
    }

    console.log('✅ Video has AI analysis, proceeding with chat');

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Prepare context for AI
    const videoContext = {
      title: video.title || 'Untitled Video',
      transcript: video.transcript || context?.transcript || '',
      analysis: video.aiAnalysis || context?.analysis || '',
      suggestions: video.aiSuggestions || context?.suggestions || {}
    };

    // Generate AI response using OpenAI
    console.log('🤖 Calling OpenAI API for chat response...');
    
    // Use chatWithAI function with video context as system message
    const chatMessages = [
      {
        role: "system",
        content: `Kamu adalah AI assistant yang membantu menganalisis video. 
        
INFORMASI VIDEO:
- Judul: ${videoContext.title || 'Tanpa judul'}
- Transkrip: "${videoContext.transcript}"
- Analisis sebelumnya: ${videoContext.analysis}

INSTRUKSI FORMATTING:
- Gunakan markdown formatting untuk response yang terstruktur
- Gunakan **bold** untuk heading dan poin penting
- Gunakan numbering (1., 2., 3.) untuk daftar saran
- Gunakan *italic* untuk penekanan
- Gunakan bullet points (-, •) untuk sub-poin
- Buat response yang mudah dibaca dengan spacing yang baik

Jawab pertanyaan user berdasarkan informasi video di atas dalam bahasa Indonesia yang natural dan terstruktur.`
      },
      {
        role: "user", 
        content: message
      }
    ];

    const result = await aiService.chatWithAI(chatMessages);
    const aiResponse = result.response;

    console.log('✅ OpenAI response received successfully');

    return res.json({
      response: aiResponse,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error in chatWithVideo:', error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: "Failed to process chat message"
    });
  }
};

// Delete video analysis
const deleteVideoAnalysis = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    console.log('🗑️ Deleting video analysis for video:', id);

    // Find video owned by user
    const video = await Video.findOne({ _id: id, user_id });
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    // Use MongoDB native operations to completely remove fields
    await Video.updateOne(
      { _id: id },
      {
        $unset: {
          "transcript": 1,
          "transcript_metadata": 1,
          "aiAnalysis": 1,
          "aiSuggestions": 1,
          "analysis_status": 1,
          "transcript_status": 1
        }
      }
    );

    // Set the boolean flags
    await Video.updateOne(
      { _id: id },
      {
        $set: {
          hasAIAnalysis: false,
          hasTranscript: false
        }
      }
    );

    // Force fresh query from database to verify cleanup
    const updatedVideo = await Video.findById(id).lean();

    // If fields still exist, force manual removal (fallback mechanism)
    if (updatedVideo.transcript || updatedVideo.aiAnalysis || updatedVideo.aiSuggestions || updatedVideo.transcript_metadata) {
      await Video.replaceOne(
        { _id: id },
        {
          _id: updatedVideo._id,
          user_id: updatedVideo.user_id,
          title: updatedVideo.title,
          caption: updatedVideo.caption,
          hashtags: updatedVideo.hashtags,
          secure_url: updatedVideo.secure_url,
          public_id: updatedVideo.public_id,
          duration_sec: updatedVideo.duration_sec,
          createdAt: updatedVideo.createdAt,
          updatedAt: new Date(),
          __v: updatedVideo.__v,
          hasAIAnalysis: false,
          hasTranscript: false
          // Explicitly exclude: transcript, transcript_metadata, aiAnalysis, aiSuggestions, etc.
        }
      );
      
      // Get the manually cleaned video
      const finalVideo = await Video.findById(id).lean();
      return res.json({
        message: "Video analysis deleted successfully",
        video: finalVideo
      });
    }

    return res.json({
      message: "Video analysis deleted successfully",
      video: updatedVideo
    });

  } catch (error) {
    console.error('Error deleting video analysis:', error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: "Failed to delete video analysis"
    });
  }
};

// Update video analysis results
const updateVideoAnalysis = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;
    const analysisData = req.body;

    // Find video owned by user
    const video = await Video.findOne({ _id: id, user_id });
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    console.log('🔄 Updating video analysis:', {
      videoId: id,
      hasAIAnalysis: analysisData.hasAIAnalysis,
      transcript: analysisData.transcript ? 'Present' : 'Not present',
      aiAnalysis: analysisData.aiAnalysis ? 'Present' : 'Not present'
    });

    // Update video with analysis data
    const updateData = {
      hasAIAnalysis: analysisData.hasAIAnalysis || false,
      transcript: analysisData.transcript,
      transcript_status: analysisData.transcript_status,
      transcript_metadata: analysisData.transcript_metadata,
      analysis_status: analysisData.analysis_status,
      aiAnalysis: analysisData.aiAnalysis,
      aiSuggestions: analysisData.aiSuggestions
    };

    const updatedVideo = await Video.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    console.log('✅ Video analysis updated successfully');

    return res.json({
      message: "Video analysis updated successfully",
      video: updatedVideo
    });

  } catch (error) {
    console.error('Error updating video analysis:', error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: "Failed to update video analysis"
    });
  }
};

module.exports = {
  // export yang lama:
  uploadVideo,
  listMyVideos,
  getVideo,
  // export baru:
  updateVideo,
  deleteVideo,
  // export analisis:
  analyzeVideo: async (req, res) => {
    try {
      const user_id = req.user.id;
      const { id } = req.params;

      // Find video owned by user
      const video = await Video.findOne({ _id: id, user_id });
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      
      console.log('🎬 Video found for analysis:', {
        id: video._id,
        title: video.title,
        transcript_status: video.transcript_status,
        hasTranscript: !!video.transcript
      });

      // Check if transcript already exists
      if (video.transcript_status === 'completed' && video.transcript) {
        return res.json({ 
          message: "Video already analyzed",
          status: "completed",
          transcript: video.transcript
        });
      }

      // Check if analysis is already in progress
      if (video.transcript_status === 'processing') {
        console.log('📤 Sending response: Analysis already in progress');
        const response = { 
          message: "Analysis already in progress",
          status: "processing"
        };
        console.log('📤 Response data:', response);
        return res.json(response);
      }

      console.log('📤 Sending response: Video analysis started');
      const response = {
        message: "Video analysis started",
        status: "processing",
        videoId: id
      };
      console.log('📤 Response data:', response);
      
      return res.json(response);

    } catch (err) {
      console.error("Error analyzeVideo:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
  getVideoTranscript,
  chatWithVideo,
  deleteVideoAnalysis,
  updateVideoAnalysis,
};
