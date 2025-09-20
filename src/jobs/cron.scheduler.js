const cron = require('node-cron');
const axiosClient = require('../config/axiosClient');

// contoh dummy, harusnya tarik dari database
const scheduledPosts = [
  {
    content: "Hello World!",
    accountId: "68ce54af666e6297f4476cb4",
    mediaUrl: "https://example.com/image.jpg",
    scheduledFor: "2025-09-21T03:00:00Z"
  }
];

cron.schedule('* * * * *', async () => {
  console.log("Cron job running:", new Date().toISOString());
  for (const post of scheduledPosts) {
    if (new Date(post.scheduledFor) <= new Date()) {
      try {
        const payload = {
          content: post.content,
          platforms: [{ platform: "instagram", accountId: post.accountId }],
          mediaItems: [{ type: "image", url: post.mediaUrl }],
          publishNow: true
        };
        const resp = await axiosClient.post('/posts', payload);
        console.log("Posted:", resp.data);
      } catch (err) {
        console.error("Cron post failed:", err.response?.data || err.message);
      }
    }
  }
});
