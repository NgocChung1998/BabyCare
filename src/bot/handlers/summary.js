import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { bot, safeSendMessage } from '../index.js';
import { Feeding, SleepSession, PottyLog, DiaperLog, SupplementLog } from '../../database/models/index.js';
import { mainKeyboard } from '../keyboard.js';
import { CONSTANTS } from '../../config/index.js';
import { clearState } from '../../utils/stateManager.js';
import { sleepSessionTracker } from './sleep.js';
import { getGroupChatIds } from './sync.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Lấy trạng thái ngủ hiện tại
 */
const getCurrentSleepStatus = async (chatId) => {
  // Kiểm tra cả primary chatId
  const groupChatIds = await getGroupChatIds(chatId);
  
  for (const id of groupChatIds) {
    if (sleepSessionTracker.has(id)) {
      const startTime = sleepSessionTracker.get(id);
      const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000);
      return { isSleeping: true, startTime, elapsedMinutes: elapsed };
    }
  }
  return { isSleeping: false };
};

/**
 * Tóm tắt ngày với thông tin chi tiết
 */
const summarizeDay = async (chatId) => {
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  const start = now.startOf('day').toDate();
  const end = now.endOf('day').toDate();
  
  // Lấy tất cả chatId trong nhóm
  const groupChatIds = await getGroupChatIds(chatId);

  const [feedings, sleeps, potty, diapers, supplements] = await Promise.all([
    Feeding.find({ chatId: { $in: groupChatIds }, recordedAt: { $gte: start, $lte: end } }),
    SleepSession.find({ chatId: { $in: groupChatIds }, start: { $gte: start }, end: { $lte: end } }),
    PottyLog.find({ chatId: { $in: groupChatIds }, recordedAt: { $gte: start, $lte: end } }),
    DiaperLog.find({ chatId: { $in: groupChatIds }, recordedAt: { $gte: start, $lte: end } }),
    SupplementLog.find({ chatId: { $in: groupChatIds }, recordedAt: { $gte: start, $lte: end } })
  ]);

  const milkCount = feedings.length;
  const milkMl = feedings.reduce((sum, item) => sum + item.amountMl, 0);
  const sleepMinutes = sleeps.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
  const sleepHours = Math.floor(sleepMinutes / 60);
  const sleepMins = sleepMinutes % 60;
  const peeCount = potty.filter((item) => item.type === 'pee').length;
  const pooCount = potty.filter((item) => item.type === 'poo').length;
  const diaperCount = diapers.length;
  const vitaminD = supplements.some((s) => s.type === 'vitaminD');

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '📊 TÓM TẮT HÔM NAY',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];

  // ===== TRẠNG THÁI NGỦ HIỆN TẠI =====
  const sleepStatus = await getCurrentSleepStatus(chatId);
  lines.push('😴 TRẠNG THÁI NGỦ:');
  
  if (sleepStatus.isSleeping) {
    const startStr = dayjs.tz(sleepStatus.startTime, VIETNAM_TZ).format('HH:mm');
    const elapsed = sleepStatus.elapsedMinutes;
    const elapsedHours = Math.floor(elapsed / 60);
    const elapsedMins = elapsed % 60;
    const elapsedStr = elapsedHours > 0 
      ? `${elapsedHours}h${elapsedMins > 0 ? `${elapsedMins}p` : ''}`.trim()
      : `${elapsedMins}p`;
    
    // Ước tính thời gian tỉnh (giả sử giấc ngủ trung bình 2-3 tiếng)
    const avgSleepMinutes = 150; // 2.5 tiếng
    const remainingMinutes = Math.max(0, avgSleepMinutes - elapsed);
    const wakeTime = now.add(remainingMinutes, 'minute');
    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingMins = remainingMinutes % 60;
    const remainingStr = remainingHours > 0 
      ? `${remainingHours}h${remainingMins > 0 ? `${remainingMins}p` : ''}`.trim()
      : `${remainingMins}p`;
    
    lines.push('🟢 ĐANG NGỦ');
    lines.push('');
    lines.push(`   └─ Bắt đầu: ${startStr}`);
    lines.push(`   └─ Đã ngủ: ${elapsedStr}`);
    lines.push(`   └─ Dự kiến tỉnh: ~${wakeTime.format('HH:mm')} (còn ${remainingStr})`);
  } else {
    const lastSleep = sleeps.at(-1);
    lines.push('⚪ ĐANG THỨC');
    lines.push('');
    if (lastSleep) {
      const lastEndStr = dayjs.tz(lastSleep.end, VIETNAM_TZ).format('HH:mm');
      const lastHours = Math.floor(lastSleep.durationMinutes / 60);
      const lastMins = lastSleep.durationMinutes % 60;
      const lastDurationStr = lastHours > 0 
        ? `${lastHours}h${lastMins > 0 ? `${lastMins}p` : ''}`.trim()
        : `${lastMins}p`;
      lines.push(`📋 Giấc ngủ gần nhất:`);
      lines.push(`   └─ ${lastDurationStr} (kết thúc ${lastEndStr})`);
    } else {
      lines.push('📋 Chưa có giấc ngủ hôm nay');
    }
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  // ===== THÔNG TIN ĂN =====
  const lastFeed = feedings.at(-1);
  lines.push('🍼 THÔNG TIN ĂN:');
  
  if (lastFeed) {
    const lastFeedTime = dayjs.tz(lastFeed.recordedAt, VIETNAM_TZ);
    const lastFeedTimeStr = lastFeedTime.format('HH:mm');
    const hoursSinceFeed = now.diff(lastFeedTime, 'hour', true);
    
    // Tính thời gian ăn tiếp theo (3-4 tiếng)
    const nextFeedMin = lastFeedTime.add(3, 'hour');
    const nextFeedMax = lastFeedTime.add(4, 'hour');
    const nextFeedMinStr = nextFeedMin.format('HH:mm');
    const nextFeedMaxStr = nextFeedMax.format('HH:mm');
    
    lines.push(`   └─ Lần cuối: ${lastFeedTimeStr} (${lastFeed.amountMl}ml)`);
    
    if (hoursSinceFeed < 3) {
      const minutesUntilNext = Math.round((3 * 60) - (hoursSinceFeed * 60));
      const hoursUntil = Math.floor(minutesUntilNext / 60);
      const minsUntil = minutesUntilNext % 60;
      const untilStr = hoursUntil > 0 
        ? `${hoursUntil}h${minsUntil > 0 ? `${minsUntil}p` : ''}`.trim()
        : `${minsUntil}p`;
      lines.push(`   └─ Cữ tiếp: ${nextFeedMinStr}-${nextFeedMaxStr} (còn ~${untilStr})`);
    } else if (hoursSinceFeed < 4) {
      const minutesUntilNext = Math.round((4 * 60) - (hoursSinceFeed * 60));
      const hoursUntil = Math.floor(minutesUntilNext / 60);
      const minsUntil = minutesUntilNext % 60;
      const untilStr = hoursUntil > 0 
        ? `${hoursUntil}h${minsUntil > 0 ? `${minsUntil}p` : ''}`.trim()
        : `${minsUntil}p`;
      lines.push(`   └─ Cữ tiếp: ${nextFeedMinStr}-${nextFeedMaxStr} (còn ~${untilStr})`);
    } else {
      lines.push(`   └─ ⚠️ Đã qua giờ ăn! Nên cho bé ăn sớm`);
      lines.push(`   └─ Khung giờ: ${nextFeedMinStr}-${nextFeedMaxStr}`);
    }
  } else {
    lines.push('   └─ Chưa có dữ liệu ăn hôm nay');
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('📈 TỔNG KẾT:');
  lines.push('');
  lines.push(`🍼 Bú: ${milkCount} lần • ${milkMl}ml`);
  lines.push(`😴 Ngủ: ${sleepHours}h${sleepMins > 0 ? `${sleepMins}p` : ''} (${sleeps.length} giấc)`.trim());
  lines.push(`💧 Tè: ${peeCount} lần • 💩 Ị: ${pooCount} lần`);
  lines.push(`🧷 Thay tã: ${diaperCount} lần`);
  lines.push(`☀️ Vitamin D: ${vitaminD ? '✅ Đã uống' : '❌ Chưa uống'}`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('💡 Bấm các nút bên dưới để ghi nhận thêm!');

  await safeSendMessage(chatId, lines.join('\n'), mainKeyboard);
};

/**
 * Đăng ký handler cho summary
 */
export const registerSummaryHandler = () => {
  // Button press -> tự động hiển thị tóm tắt
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    if (msg.text === '📊 Tóm tắt ngày') {
      clearState(msg.chat.id);
      await summarizeDay(msg.chat.id);
    }
  });

  // Command
  bot.onText(/\/summary/, async (msg) => {
    clearState(msg.chat.id);
    await summarizeDay(msg.chat.id);
  });
};

export { summarizeDay };
export default registerSummaryHandler;
