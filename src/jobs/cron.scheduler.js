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

// Fungsi untuk mengirim email
const sendEmail = (userEmail, subject, text) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,  // Alamat email pengirim (misalnya Gmail)
            pass: process.env.EMAIL_PASS,  // Password email pengirim
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: subject,
        text: text,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
};

// module.exports = CronScheduler;
