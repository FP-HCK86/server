const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const LateService = require('../services/late.service');
const nodemailer = require('nodemailer');

class CronScheduler {
    static start() {
        cron.schedule('*/60 * * * * *', async () => {
            console.log('[Cron] Starting...');

            try {
                const now = new Date();
                const schedule = await Schedule.findOneAndUpdate(
                    { status: 'pending', scheduled_at: { $lte: now } },
                    { $set: { status: 'processing', locked_at: new Date() } },
                    { sort: { scheduled_at: 1 }, new: true }
                );

                if (!schedule) {
                    console.log('[Cron] No schedules due.');
                    return;
                }

                console.log(`[Cron] Processing ${schedule._id}`);

                // Cek apakah jadwal posting akan terjadi dalam 30 menit
                const timeDifference = new Date(schedule.scheduled_at) - now;
                if (timeDifference <= 30 * 60 * 1000 && timeDifference > 0) {
                    // Kirim email pengingat 30 menit sebelum posting
                    sendEmail(
                        schedule.email,  // Ambil email pengguna dari model Schedule
                        'Reminder: Your Post is About to be Published',
                        `Hi! This is a reminder that your post on ${schedule.platform} is scheduled to go live in 30 minutes.`
                    );
                }

                // Asumsi mediaUrl dari video (integrasi dengan Orang B)
                const mediaUrl = 'https://res.cloudinary.com/...';  // Ganti dengan secure_url dari Video model

                const result = await LateService.publishNow({
                    vendor_profile_id: schedule.vendor_profile_id,
                    platform: schedule.platform,
                    mediaUrl,
                    caption: schedule.caption,
                    idempotencyKey: schedule._id.toString()
                });

                if (result.vendor_job_id) {
                    await Schedule.findByIdAndUpdate(schedule._id, { vendor_job_id: result.vendor_job_id });
                }

                console.log(`[Cron] Success for ${schedule._id}`);
            } catch (error) {
                console.error('[Cron] Error:', error.message);
            }
        });

        console.log('[Cron] Started (every 60s).');
    }
}

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

module.exports = CronScheduler;
