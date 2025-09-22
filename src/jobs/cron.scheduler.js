const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const { sendEmail } = require('../helpers/email');
const moment = require('moment-timezone'); // Tambahkan ini
const LateService = require('../services/lateService');

class CronScheduler {
 static start() {
  // Cron job setiap 5 menit untuk cek schedule
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('Running cron job for schedule reminders and posting...');
      const nowWIB = moment().tz('Asia/Jakarta'); // Waktu saat ini dalam WIB
      const now = nowWIB.utc().toDate(); // Convert ke UTC untuk query MongoDB
      const fiveMinutesFromNow = nowWIB.add(5, 'minutes').utc().toDate(); // UTC +5 menit

      // Cari schedule yang kurang dari 5 menit (dalam UTC)
      const upcomingSchedules = await Schedule.find({
        scheduled_at: { $gte: now, $lte: fiveMinutesFromNow },
        status: 'pending',
      }).populate('user_id');

      for (const schedule of upcomingSchedules) {
        // Kirim email reminder jika waktu 5 menit lagi
        try {
          await sendEmail(
            schedule.user_id.email,
            'Reminder: Posting Sosmed Segera Dimulai - SMP Planner',
            `Halo ${schedule.user_id.username}, Posting ke ${schedule.platform} akan dimulai dalam 5 menit (${moment(schedule.scheduled_at).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')}). Siapkan konten Anda!` // Format WIB untuk email
          );
          console.log(`Reminder email sent to ${schedule.user_id.email}`);
        } catch (emailError) {
          console.error('Error sending reminder email:', emailError);
        }

        // Update status agar tidak dikirim ulang
        schedule.status = 'reminded';
        await schedule.save();
      }

      // Posting otomatis jika waktu tiba
      const dueSchedules = await Schedule.find({
        scheduled_at: { $lte: now },
        status: 'reminded',
      }).populate('user_id');

      for (const schedule of dueSchedules) {
        try {
          await LateService.publishNow({
            profileId: schedule.vendor_profile_id,
            platform: schedule.platform,
            mediaItems: [{ url: schedule.video_id, type: 'video' }],
            content: schedule.caption,
            timezone: 'Asia/Jakarta',
          });

          // Kirim email sukses
          await sendEmail(
            schedule.user_id.email,
            'Posting Sosmed Berhasil - SMP Planner',
            `Halo ${schedule.user_id.username}, Posting ke ${schedule.platform} berhasil dilakukan pada ${moment(schedule.scheduled_at).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')}.`
          );

          schedule.status = 'completed';
          await schedule.save();
          console.log(`Posting completed for schedule ${schedule._id}`);
        } catch (error) {
          console.error('Error posting:', error);
          // Kirim email error
          await sendEmail(
            schedule.user_id.email,
            'Error Posting Sosmed - SMP Planner',
            `Halo ${schedule.user_id.username}, Ada error saat posting ke ${schedule.platform}: ${error.message}.`
          );
        }
      }
    } catch (error) {
      console.error('Cron job error:', error);
    }
  });

  console.log('Cron scheduler started successfully');
}

}

module.exports = CronScheduler;