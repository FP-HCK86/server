# AI Endpoints Documentation

## Overview
These endpoints handle AI-powered content generation for the Planoria platform, specifically for the Canvas feature where users can create video content with AI assistance.

## Base URL
```
http://localhost:3000/ai
```

## Rate Limiting
- **Limit**: 10 requests per minute per IP
- **Headers**: Response includes rate limit headers
- **Error**: Returns 429 status when limit exceeded

## Endpoints

### 1. Health Check
Check if AI service is operational.

**GET** `/ai/health`

**Response:**
```json
{
  "success": true,
  "message": "AI service is healthy",
  "data": {
    "status": "operational",
    "timestamp": "2025-09-18T10:30:00.000Z",
    "testResponse": "Hello! Yes, I'm working properly."
  }
}
```

### 2. Generate Content (Mode 1)
Generate comprehensive video content from a user prompt.

**POST** `/ai/generate-content`

**Request Body:**
```json
{
  "prompt": "Create a video about productivity tips for remote workers"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Content generated successfully",
  "data": {
    "script": "Welcome to today's video about remote work productivity...",
    "storyboard": "Scene 1: Home office setup... Scene 2: Time management...",
    "hooks": [
      "Stop wasting time working from home - here's how",
      "3 productivity hacks that changed my remote work game",
      "Remote workers: this will double your productivity"
    ],
    "tags": [
      "productivity",
      "remotework",
      "workfromhome",
      "tips",
      "lifestyle"
    ],
    "caption": "Ready to level up your remote work game? 🚀 These productivity tips will transform how you work from home. Save this post and try tip #2 today! What's your biggest remote work challenge? Drop it in the comments! 💪 #productivity #remotework"
  },
  "usage": {
    "promptTokens": 125,
    "completionTokens": 450,
    "totalTokens": 575
  }
}
```

**Validation Rules:**
- `prompt` is required
- `prompt` must be a non-empty string
- `prompt` must be less than 500 characters

### 3. Chat with AI
Interactive chat for brainstorming and content refinement.

**POST** `/ai/chat`

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I want to create a video about cooking pasta, but make it interesting"
    },
    {
      "role": "assistant", 
      "content": "Great idea! Here are some creative angles..."
    },
    {
      "role": "user",
      "content": "I like the storytelling approach, can you elaborate?"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Chat response generated successfully",
  "data": {
    "response": "Absolutely! For a storytelling approach to pasta cooking, you could...",
    "usage": {
      "promptTokens": 89,
      "completionTokens": 156,
      "totalTokens": 245
    }
  }
}
```

**Validation Rules:**
- `messages` must be an array
- Each message must have `role` (user/assistant) and `content` (string)
- Maximum 20 messages per conversation
- At least one message required

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Prompt is required"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Too many AI requests. Please wait a moment before trying again.",
  "retryAfter": 45
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "AI service error: OpenAI API quota exceeded. Please check your billing."
}
```

### 503 Service Unavailable
```json
{
  "success": false,
  "message": "AI service is not available",
  "error": "Connection timeout"
}
```

## Usage Examples

### JavaScript/Axios Example
```javascript
// Generate content
const response = await axios.post('http://localhost:3000/ai/generate-content', {
  prompt: 'Create a video about healthy breakfast ideas'
});

console.log(response.data.data.script);
console.log(response.data.data.hooks);

// Chat with AI
const chatResponse = await axios.post('http://localhost:3000/ai/chat', {
  messages: [
    { role: 'user', content: 'Help me brainstorm video ideas about travel' }
  ]
});

console.log(chatResponse.data.data.response);
```

### cURL Example
```bash
# Generate content
curl -X POST http://localhost:3000/ai/generate-content \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a video about sustainable living tips"}'

# Chat
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "I need creative video ideas for a tech channel"}]}'
```

## Environment Variables Required
```
OPENAI_API_KEY=your_openai_api_key_here
```

## Notes
- The AI service uses GPT-3.5-turbo model
- Responses are optimized for social media content (Instagram, TikTok, YouTube Shorts)
- Rate limiting helps prevent API quota exhaustion
- All endpoints include usage statistics for monitoring API consumption
