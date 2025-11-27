import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { CONSTANTS } from '../config/index.js';
import { safeSendMessage } from '../bot/index.js';
import { ChatProfile, VaccineSchedule, DailySchedule, DailyRoutine } from '../database/models/index.js';
import { calculateSleepStats } from '../bot/handlers/sleep.js';
import { formatScheduleItems, formatMinutes } from '../utils/formatters.js';
import { checkMissedActivities, markAsReminded, generateDailyRoutine } from '../services/routineService.js';
import { buildInlineKeyboard } from '../bot/keyboard.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

const jobs = [];

/**
 * Job nhắc vaccine (9h sáng hàng ngày theo giờ Việt Nam)
 */
const createVaccineReminderJob = () => {
  return cron.schedule(
    '0 0 9 * * *',
    async () => {
      const today = dayjs.tz(dayjs(), VIETNAM_TZ).startOf('day');
      const schedules = await VaccineSchedule.find({
        completed: false,
        date: {
          $gte: today.subtract(1, 'day').toDate(),
          $lte: today.add(7, 'day').endOf('day').toDate()
        }
      });
      await Promise.all(
        schedules.map(async (item) => {
          const targetDay = dayjs.tz(item.date, VIETNAM_TZ).startOf('day');
          const diff = targetDay.diff(today, 'day');
          
          // Nhắc trước 7 ngày
          if (diff === 7 && !item.reminders.pre7d) {
            await safeSendMessage(
              item.chatId,
              `💉 Còn 1 tuần nữa tới mũi ${item.vaccineName} (${targetDay.format('DD/MM')}). Chuẩn bị cho bé nhé!`
            );
            item.reminders.pre7d = true;
          }
          
          // Nhắc trước 3 ngày
          if (diff === 3 && !item.reminders.pre3d) {
            await safeSendMessage(
              item.chatId,
              `💉 Còn 3 ngày nữa tới mũi ${item.vaccineName} (${targetDay.format('DD/MM')}). Chuẩn bị cho bé nhé!`
            );
            item.reminders.pre3d = true;
          }
          
          // Nhắc đúng ngày
          if (diff === 0 && !item.reminders.dayOf) {
            await safeSendMessage(
              item.chatId,
              `💉 HÔM NAY bé có lịch tiêm ${item.vaccineName}!\n\n📋 Nhớ mang:\n• Sổ tiêm chủng\n• Đồ chơi bé thích\n• Bỉm/tã dự phòng\n\nChúc bé tiêm khỏe mạnh! 💪`,
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
 * Job nhắc Vitamin D (7h sáng hàng ngày theo giờ Việt Nam)
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
 * Job gửi lịch chăm bé và tạo lịch ăn ngủ (6h sáng hàng ngày)
 */
const createScheduleMorningJob = () => {
  return cron.schedule(
    '0 0 6 * * *',
    async () => {
      const chats = await ChatProfile.find({});
      
      await Promise.all(
        chats.map(async (chat) => {
          // Tạo lịch ăn ngủ hàng ngày
          if (chat.dateOfBirth) {
            await generateDailyRoutine(chat.chatId);
          }
          
          // Gửi lịch chăm bé
          const schedule = await DailySchedule.findOne({ chatId: chat.chatId });
          if (schedule) {
            const content = formatScheduleItems(schedule.items);
            await safeSendMessage(
              chat.chatId,
              `🗓 Lịch chăm bé ngày hôm nay đã sẵn sàng!\n${content}`,
              {},
              'normal'
            );
          }
        })
      );
      console.info('[Cron] Đã gửi lịch sáng và tạo routine');
    },
    { timezone: CONSTANTS.DEFAULT_TIMEZONE, scheduled: false }
  );
};

/**
 * Job báo cáo giấc ngủ tuần (20h Chủ nhật theo giờ Việt Nam)
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
 * Job kiểm tra bữa ăn/giấc ngủ bị lỡ (chạy mỗi giờ từ 7h-21h)
 */
const createMissedActivityJob = () => {
  return cron.schedule(
    '0 30 7-21 * * *', // Mỗi giờ rưỡi (7:30, 8:30, ..., 21:30)
    async () => {
      const chats = await ChatProfile.find({ dateOfBirth: { $exists: true } });
      
      await Promise.all(
        chats.map(async (chat) => {
          try {
            const { missedFeeds, missedSleeps } = await checkMissedActivities(chat.chatId);
            
            // Nhắc bữa ăn bị lỡ
            if (missedFeeds.length > 0) {
              const feed = missedFeeds[0]; // Chỉ nhắc bữa đầu tiên
              const confirmKeyboard = buildInlineKeyboard([
                [
                  { text: '✅ Đã cho ăn rồi', callback_data: 'missed_feed_yes' },
                  { text: '❌ Chưa', callback_data: 'missed_feed_no' }
                ]
              ]);
              
              await safeSendMessage(
                chat.chatId,
                `🍼 Ơ! Bố/mẹ quên cho bé ăn rồi à?\n\n` +
                `📅 Lịch: ${feed.time}\n` +
                `⏰ Đã quá ${feed.minutesLate} phút\n\n` +
                `Bé đã ăn chưa ạ?`,
                confirmKeyboard
              );
              
              await markAsReminded(chat.chatId, 'feeding', feed.time);
            }
            
            // Nhắc giấc ngủ bị lỡ
            if (missedSleeps.length > 0) {
              const sleep = missedSleeps[0];
              const confirmKeyboard = buildInlineKeyboard([
                [
                  { text: '✅ Bé đã ngủ', callback_data: 'missed_sleep_yes' },
                  { text: '❌ Chưa ngủ', callback_data: 'missed_sleep_no' }
                ]
              ]);
              
              await safeSendMessage(
                chat.chatId,
                `😴 Ơ! Bố/mẹ quên cho bé ngủ rồi à?\n\n` +
                `📅 Lịch: ${sleep.time} - ${sleep.name}\n` +
                `⏰ Đã quá ${sleep.minutesLate} phút\n\n` +
                `Bé đã ngủ chưa ạ?`,
                confirmKeyboard
              );
              
              await markAsReminded(chat.chatId, 'sleep', sleep.name);
            }
          } catch (error) {
            console.error(`[Cron] Lỗi kiểm tra missed activity cho ${chat.chatId}:`, error);
          }
        })
      );
      console.info('[Cron] Đã kiểm tra missed activities');
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
  const missedJob = createMissedActivityJob();

  vaccineJob.start();
  vitaminJob.start();
  scheduleJob.start();
  sleepJob.start();
  missedJob.start();

  jobs.push(vaccineJob, vitaminJob, scheduleJob, sleepJob, missedJob);
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
