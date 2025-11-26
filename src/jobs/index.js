import cron from 'node-cron';
import dayjs from 'dayjs';
import { CONSTANTS } from '../config/index.js';
import { safeSendMessage } from '../bot/index.js';
import { ChatProfile, VaccineSchedule, DailySchedule } from '../database/models/index.js';
import { calculateSleepStats } from '../bot/handlers/sleep.js';
import { formatScheduleItems, formatMinutes } from '../utils/formatters.js';

const jobs = [];

/**
 * Job nhắc vaccine (9h sáng hàng ngày)
 */
const createVaccineReminderJob = () => {
  return cron.schedule(
    '0 0 9 * * *',
    async () => {
      const today = dayjs().startOf('day');
      const schedules = await VaccineSchedule.find({
        date: {
          $gte: today.subtract(1, 'day').toDate(),
          $lte: today.add(3, 'day').endOf('day').toDate()
        }
      });
      await Promise.all(
        schedules.map(async (item) => {
          const targetDay = dayjs(item.date).startOf('day');
          const diff = targetDay.diff(today, 'day');
          if (diff === 3 && !item.reminders.pre3d) {
            await safeSendMessage(
              item.chatId,
              `💉 Còn 3 ngày nữa tới mũi ${item.vaccineName} (${targetDay.format('DD/MM')}). Chuẩn bị cho bé nhé!`
            );
            item.reminders.pre3d = true;
          }
          if (diff === 0 && !item.reminders.dayOf) {
            await safeSendMessage(
              item.chatId,
              `💉 Hôm nay bé có lịch tiêm ${item.vaccineName}. Nhớ mang sổ tiêm và đồ chơi bé thích nhé!`,
              {},
              'high'
            );
            item.reminders.dayOf = true;
          }
          if (item.isModified('reminders')) {
            await item.save();
          }
        })
      );
      console.info('[Cron] Đã chạy vaccine reminder');
    },
    { timezone: CONSTANTS.DEFAULT_TIMEZONE, scheduled: false }
  );
};

/**
 * Job nhắc Vitamin D (7h sáng hàng ngày)
 */
const createVitaminReminderJob = () => {
  return cron.schedule(
    '0 0 7 * * *',
    async () => {
      const chats = await ChatProfile.find({});
      await Promise.all(
        chats.map((chat) =>
          safeSendMessage(
            chat.chatId,
            '🌤️ 7h sáng rồi! Nhớ cho bé uống Vitamin D và men vi sinh nếu cần nhé.',
            {},
            'high'
          )
        )
      );
      console.info('[Cron] Đã chạy vitamin reminder');
    },
    { timezone: CONSTANTS.DEFAULT_TIMEZONE, scheduled: false }
  );
};

/**
 * Job gửi lịch chăm bé (6h sáng hàng ngày)
 */
const createScheduleMorningJob = () => {
  return cron.schedule(
    '0 0 6 * * *',
    async () => {
      const schedules = await DailySchedule.find({});
      await Promise.all(
        schedules.map(async (schedule) => {
          const content = formatScheduleItems(schedule.items);
          await safeSendMessage(
            schedule.chatId,
            `🗓 Lịch chăm bé ngày hôm nay đã sẵn sàng!\n${content}`,
            {},
            'normal'
          );
        })
      );
      console.info('[Cron] Đã gửi lịch sáng');
    },
    { timezone: CONSTANTS.DEFAULT_TIMEZONE, scheduled: false }
  );
};

/**
 * Job báo cáo giấc ngủ tuần (20h Chủ nhật)
 */
const createWeeklySleepJob = () => {
  return cron.schedule(
    '0 0 20 * * 0',
    async () => {
      const chats = await ChatProfile.find({});
      await Promise.all(
        chats.map(async (chat) => {
          const stats = await calculateSleepStats(chat.chatId, 7);
          if (!stats) return;
          const text = `🛌 Tuần này bé ngủ trung bình ${formatMinutes(
            stats.averagePerDay
          )} mỗi ngày. Bé ngủ đêm ${formatMinutes(stats.nightMinutes)} và nap ${formatMinutes(
            stats.napMinutes
          )}. Tiếp tục giữ nếp ngủ khỏe mạnh nhé!`;
          await safeSendMessage(chat.chatId, text);
        })
      );
      console.info('[Cron] Đã gửi báo cáo giấc ngủ tuần');
    },
    { timezone: CONSTANTS.DEFAULT_TIMEZONE, scheduled: false }
  );
};

/**
 * Khởi động tất cả cron jobs
 */
export const startAllJobs = () => {
  const vaccineJob = createVaccineReminderJob();
  const vitaminJob = createVitaminReminderJob();
  const scheduleJob = createScheduleMorningJob();
  const sleepJob = createWeeklySleepJob();

  vaccineJob.start();
  vitaminJob.start();
  scheduleJob.start();
  sleepJob.start();

  jobs.push(vaccineJob, vitaminJob, scheduleJob, sleepJob);
  console.info('✅ Đã khởi động tất cả cron jobs');
};

/**
 * Dừng tất cả cron jobs
 */
export const stopAllJobs = () => {
  jobs.forEach((job) => job.stop());
  console.info('🛑 Đã dừng tất cả cron jobs');
};

export default { startAllJobs, stopAllJobs };

