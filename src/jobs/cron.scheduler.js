const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const { sendEmail } = require('../helpers/email');
const moment = require('moment-timezone');
const LateService = require('../services/lateService');

class CronScheduler {
  static start() {
    if (this._started) {
      console.log('[Cron] Already started, skip');
      return;
    }
    this._started = true;
    // Cron job tiap 1 menit: ambil semua schedule yang sudah waktunya dan masih pending, claim -> processing -> publish
    cron.schedule('* * * * *', async () => {
      const startTick = Date.now();
      console.log('[Cron] Tick start');
      try {
        const now = new Date();

        // Heuristic: mark schedules handed to Late (have vendor_job_id) as posted
        // once their scheduled time has passed by at least 60s. This prevents UI
        // from showing perpetual pending after we stopped locally re-publishing them.
        try {
          const graceCutoff = new Date(Date.now() - 60 * 1000); // 60s grace
            const autoResult = await Schedule.updateMany(
              {
                status: 'pending',
                vendor_job_id: { $exists: true },
                scheduled_at: { $lte: graceCutoff }
              },
              { $set: { status: 'posted', auto_marked: true, posted_at: new Date() } }
            );
            if (autoResult.modifiedCount) {
              console.log('[Cron] Auto-marked remote scheduled as posted:', autoResult.modifiedCount);
            }
        } catch (autoErr) {
          console.warn('[Cron] auto-mark check failed:', autoErr.message);
        }

        // Ambil batch pending (limit untuk hindari memory blow). Gunakan findOneAndUpdate loop untuk atomic claim.
        const batchSize = 10; // adjustable
        let claimed = [];
        for (let i = 0; i < batchSize; i++) {
          const doc = await Schedule.findOneAndUpdate(
            {
              scheduled_at: { $lte: now },
              status: 'pending',
              // Minimal safeguard: if a schedule already has vendor_job_id it was handed to Late's own scheduler.
              // We skip it to avoid duplicate publish (Late will publish at its scheduled time).
              vendor_job_id: { $exists: false }
            },
            { $set: { status: 'processing', locked_at: new Date() } },
            { new: true }
          ).populate('user_id');
          if (!doc) break;
          claimed.push(doc);
        }

        if (!claimed.length) {
          console.log('[Cron] No due schedules this tick');
          return;
        }

        for (const schedule of claimed) {
          try {
            // TODO: Ambil URL video sebenarnya (populate video) jika field video_id adalah ObjectId Video
            // Untuk saat ini asumsi caption + hashtags
            const Video = require('../models/Video');
            let mediaItems = [];
            try {
              const videoDoc = await Video.findById(schedule.video_id);
              if (videoDoc?.secure_url) {
                mediaItems.push({ type: 'video', url: videoDoc.secure_url });
              }
            } catch (e) {
              console.warn('[Cron] fetch video error', e.message);
            }

            // Pastikan accountId (mirip runNow logic). Sederhanakan: jika gagal dapat accountId, fail.
            const VendorAccount = require('../models/VendorAccount');
            let accountRecord = await VendorAccount.findOne({ user_id: schedule.user_id._id, platform: schedule.platform, vendor_profile_id: schedule.vendor_profile_id });
            let accountId = accountRecord?.vendor_account_id;
            if (!accountId) {
              try {
                const accounts = await LateService.getAccounts(schedule.vendor_profile_id);
                const match = accounts.find(a => a.platform === schedule.platform);
                if (match?._id) {
                  accountId = match._id;
                  await VendorAccount.findOneAndUpdate({ _id: accountRecord?._id || undefined, platform: schedule.platform, user_id: schedule.user_id._id }, { vendor_account_id: accountId }, { upsert: true });
                }
              } catch (syncErr) {
                console.warn('[Cron] account sync failed:', syncErr.message);
              }
            }

            if (!accountId) {
              await Schedule.findByIdAndUpdate(schedule._id, { status: 'failed', error: 'account_not_resolved' });
              await sendEmail(
                schedule.user_id.email,
                'Posting Gagal - Planoria',
                `Halo ${schedule.user_id.username || ''}, Post ke ${schedule.platform} gagal karena akun tidak dapat di-resolve. (#account_not_resolved)`
              );
              continue;
            }

            let publishResp;
            try {
              publishResp = await LateService.publishNow({
                content: schedule.caption + (schedule.hashtags ? `\n${schedule.hashtags}` : ''),
                mediaItems,
                platforms: [{ platform: schedule.platform, accountId }]
              });
            } catch (pubErr) {
              console.error('[Cron] Late publish error:', pubErr.response?.data || pubErr.message);
              await Schedule.findByIdAndUpdate(schedule._id, { status: 'failed', error: 'late_publish_failed' });
              await sendEmail(
                schedule.user_id.email,
                'Posting Gagal - Planoria',
                `Halo ${schedule.user_id.username || ''}, Post ke ${schedule.platform} gagal dipublish. Error: ${pubErr.message}`
              );
              continue;
            }

            const postId = publishResp?.post?._id || publishResp?.postId;
            await Schedule.findByIdAndUpdate(schedule._id, { status: 'posted', vendor_job_id: postId });
            await sendEmail(
              schedule.user_id.email,
              'Posting Berhasil - Planoria',
              `Halo ${schedule.user_id.username || ''}, Post ke ${schedule.platform} telah berhasil dipublish pada ${moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')}.`);
            console.log('[Cron] Posted schedule', schedule._id.toString());
          } catch (innerErr) {
            console.error('[Cron] Unexpected processing error:', innerErr);
            await Schedule.findByIdAndUpdate(schedule._id, { status: 'failed', error: 'unexpected_processing_error' });
          }
        }
      } catch (error) {
        console.error('[Cron] tick error:', error);
      } finally {
        console.log('[Cron] Tick done in', Date.now() - startTick, 'ms');
      }
    });

    console.log('Cron scheduler (Option1 simplified) started successfully');
  }
}

module.exports = CronScheduler;