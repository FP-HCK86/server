// services/transcript.service.js
const fs = require('fs');
const path = require('path');
const { openai } = require('../config/openai');
const Video = require('../models/Video');

// Dynamically import fluent-ffmpeg with fallback
let ffmpeg;
try {
  ffmpeg = require('fluent-ffmpeg');
} catch (error) {
  console.warn('⚠️  fluent-ffmpeg not available, transcript service will use fallback mode');
  ffmpeg = null;
}

/**
 * Extract transcript from video using FFmpeg + Whisper OpenAI
 * Flow: Video -> Extract Audio (FFmpeg) -> Transcript (Whisper) -> Clean up
 */
const extractTranscript = async (videoId, progressCallback) => {
  const startTime = Date.now();
  let audioFilePath = null;
  
  try {
    // Get video data from database
    const video = await Video.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    // Check if FFmpeg is available
    if (!ffmpeg) {
      console.log('🔄 FFmpeg not available, using fallback transcript');
      if (progressCallback) {
        progressCallback({ progress: 50, message: 'Menggunakan transkrip fallback...' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        progressCallback({ progress: 100, message: 'Transkrip berhasil dibuat!' });
      }
      
      return {
        transcript: `Transkrip untuk video "${video.title || 'Video tanpa judul'}" belum dapat diekstrak secara otomatis. Fitur ini memerlukan FFmpeg untuk mengekstrak audio dari video. Silakan tambahkan transkrip secara manual atau install FFmpeg untuk ekstraksi otomatis.`,
        processing_time_ms: Date.now() - startTime,
        confidence_score: 0.0,
        word_count: 25,
        language: 'id',
        duration: 0,
        segments: []
      };
    }

    if (progressCallback) {
      progressCallback({ progress: 5, message: 'Mengunduh video dari Cloudinary...' });
    }

    // Create temp directory if not exists
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate unique filename for audio (try MP3 first, fallback to MP4)
    const audioFileName = `audio_${videoId}_${Date.now()}.mp3`;
    audioFilePath = path.join(tempDir, audioFileName);

    if (progressCallback) {
      progressCallback({ progress: 15, message: 'Mengekstrak audio dari video...' });
    }

    // Extract audio from video using FFmpeg with proper fallback
    await new Promise((resolve, reject) => {
      const tryExtraction = (useLibmp3lame = true) => {
        const currentAudioPath = useLibmp3lame ? audioFilePath : audioFilePath.replace('.mp3', '.mp4');
        const codec = useLibmp3lame ? 'libmp3lame' : 'aac';
        const format = useLibmp3lame ? 'mp3' : 'mp4';
        
        console.log(`🔄 Trying audio extraction with ${codec} codec...`);
        
        ffmpeg(video.secure_url)
          .audioCodec(codec)
          .audioBitrate(128)
          .audioChannels(1) // Mono for better transcription
          .audioFrequency(16000) // 16kHz is optimal for Whisper
          .format(format)
          .on('progress', (progress) => {
            const audioProgress = Math.round(15 + (progress.percent || 0) * 0.4); // 15-55%
            if (progressCallback) {
              progressCallback({ 
                progress: audioProgress, 
                message: `Mengekstrak audio (${codec})... ${Math.round(progress.percent || 0)}%` 
              });
            }
          })
          .on('end', () => {
            console.log(`✅ Audio extraction completed with ${codec}`);
            // Update audioFilePath to the successful path
            audioFilePath = currentAudioPath;
            resolve();
          })
          .on('error', (err) => {
            console.error(`❌ FFmpeg error with ${codec}:`, err.message);
            if (useLibmp3lame) {
              // Try fallback with AAC
              console.log('🔄 Trying fallback with AAC codec...');
              tryExtraction(false);
            } else {
              reject(new Error(`Audio extraction failed with both codecs: ${err.message}`));
            }
          })
          .save(currentAudioPath);
      };
      
      tryExtraction(true); // Start with libmp3lame
    });

    if (progressCallback) {
      progressCallback({ progress: 60, message: 'Mengirim audio ke Whisper AI...' });
    }

    // Check if audio file exists and has content
    if (!fs.existsSync(audioFilePath)) {
      throw new Error('Audio file was not created');
    }

    const audioStats = fs.statSync(audioFilePath);
    if (audioStats.size === 0) {
      throw new Error('Audio file is empty');
    }

    console.log(`📊 Audio file created: ${audioFilePath} (${audioStats.size} bytes)`);

    if (progressCallback) {
      progressCallback({ progress: 70, message: 'Memproses transkrip dengan Whisper AI...' });
    }

    // Transcribe audio using OpenAI Whisper
    const audioStream = fs.createReadStream(audioFilePath);
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: 'id', // Indonesian language
      response_format: 'verbose_json',
      temperature: 0.2 // Lower temperature for more accurate transcription
    });

    if (progressCallback) {
      progressCallback({ progress: 95, message: 'Menyelesaikan transkrip...' });
    }

    // Clean up temporary audio file
    try {
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
        console.log('🗑️  Temporary audio file cleaned up');
      }
    } catch (cleanupError) {
      console.warn('⚠️  Could not clean up audio file:', cleanupError.message);
    }

    const processingTime = Date.now() - startTime;
    const transcript = transcription.text || 'Tidak ada teks yang dapat diekstrak dari audio';
    
    console.log('✅ Transcription completed:', {
      duration: transcription.duration,
      language: transcription.language,
      textLength: transcript.length,
      processingTimeMs: processingTime
    });

    if (progressCallback) {
      progressCallback({ progress: 100, message: 'Transkrip berhasil dibuat!' });
    }

    return {
      transcript,
      processing_time_ms: processingTime,
      confidence_score: 0.9, // Whisper generally has high confidence
      word_count: transcript.split(' ').length,
      language: transcription.language,
      duration: transcription.duration,
      segments: transcription.segments || []
    };

  } catch (error) {
    console.error('❌ Transcript extraction error:', error);
    
    // Clean up audio file on error
    if (audioFilePath && fs.existsSync(audioFilePath)) {
      try {
        fs.unlinkSync(audioFilePath);
        console.log('🗑️  Cleaned up audio file after error');
      } catch (cleanupError) {
        console.warn('⚠️  Could not clean up audio file after error:', cleanupError.message);
      }
    }

    // Provide more specific error messages
    if (error.message.includes('Audio extraction failed')) {
      throw new Error('Gagal mengekstrak audio dari video. Pastikan video memiliki track audio.');
    } else if (error.message.includes('OpenAI')) {
      throw new Error('Gagal memproses transkrip dengan AI. Silakan coba lagi.');
    } else {
      throw new Error(`Gagal membuat transkrip: ${error.message}`);
    }
  }
};

module.exports = {
  extractTranscript
};