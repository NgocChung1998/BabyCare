import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { SleepSession, ChatProfile, Feeding } from '../../database/models/index.js';
import { mainKeyboard } from '../keyboard.js';
import { formatMinutes } from '../../utils/formatters.js';
import { isNightSleep, getSleepGuideline } from '../../utils/helpers.js';
import { clearState } from '../../utils/stateManager.js';

// Export sleepSessionTracker để summary.js có thể sử dụng
export const sleepSessionTracker = new Map();

/**
 * Kiểm tra trạng thái ngủ hiện tại
 */
const getSleepStatus = (chatId) => {
  if (sleepSessionTracker.has(chatId)) {
    const startTime = sleepSessionTracker.get(chatId);
    const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000);
    return { isSleeping: true, startTime, elapsedMinutes: elapsed };
  }
  return { isSleeping: false };
};

/**
 * Hiển thị menu ngủ với trạng thái
 */
const showSleepMenu = async (chatId) => {
  const status = getSleepStatus(chatId);
  const lastSleep = await SleepSession.findOne({ chatId }).sort({ end: -1 });
  const lastFeed = await Feeding.findOne({ chatId }).sort({ recordedAt: -1 });
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '😴 NHẬT KÝ NGỦ',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];
  
  if (status.isSleeping) {
    const startStr = dayjs(status.startTime).format('HH:mm');
    const elapsedHours = Math.floor(status.elapsedMinutes / 60);
    const elapsedMins = status.elapsedMinutes % 60;
    const elapsedStr = elapsedHours > 0 
      ? `${elapsedHours}h${elapsedMins > 0 ? `${elapsedMins}p` : ''}`.trim()
      : `${elapsedMins}p`;
    
    lines.push('🟢 TRẠNG THÁI: ĐANG NGỦ');
    lines.push('');
    lines.push(`⏰ Bắt đầu: ${startStr}`);
    lines.push(`⏱️ Đã ngủ: ${elapsedStr}`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push('📝 Bấm lại nút để kết thúc giấc ngủ.');
  } else {
    lines.push('⚪ TRẠNG THÁI: ĐANG THỨC');
    lines.push('');
    
    if (lastSleep) {
      const lastEndStr = dayjs(lastSleep.end).format('HH:mm');
      const lastHours = Math.floor(lastSleep.durationMinutes / 60);
      const lastMins = lastSleep.durationMinutes % 60;
      const lastDurationStr = lastHours > 0 
        ? `${lastHours}h${lastMins > 0 ? `${lastMins}p` : ''}`.trim()
        : `${lastMins}p`;
      lines.push(`📋 Giấc ngủ gần nhất:`);
      lines.push(`   └─ ${lastDurationStr} (kết thúc ${lastEndStr})`);
    } else {
      lines.push('📋 Chưa có giấc ngủ được ghi nhận');
    }
    
    if (lastFeed) {
      const lastFeedTime = dayjs(lastFeed.recordedAt).format('HH:mm');
      lines.push('');
      lines.push(`🍼 Vừa ăn lúc: ${lastFeedTime}`);
      lines.push(`   └─ ${lastFeed.amountMl}ml`);
    }
    
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push('📝 Bấm lại nút để bắt đầu ghi nhận giấc ngủ.');
  }
  
  await safeSendMessage(
    chatId,
    lines.join('\n'),
    mainKeyboard
  );
};

/**
 * Bắt đầu ngủ
 */
const handleSleepStart = async (chatId) => {
  const status = getSleepStatus(chatId);
  if (status.isSleeping) {
    await showSleepMenu(chatId);
    return;
  }
  sleepSessionTracker.set(chatId, new Date());
  const now = dayjs().format('HH:mm');
  await safeSendMessage(
    chatId,
    `😴 Bé bắt đầu ngủ lúc ${now}.\n\n` +
    `💤 Chúc bé ngủ ngon!\n\n` +
    `📝 Khi bé dậy, bấm lại nút "😴 Nhật ký ngủ" để ghi nhận.`,
    mainKeyboard
  );
};

/**
 * Kết thúc ngủ
 */
const handleSleepStop = async (chatId) => {
  const status = getSleepStatus(chatId);
  if (!status.isSleeping) {
    await showSleepMenu(chatId);
    return;
  }
  const start = status.startTime;
  const end = new Date();
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  await SleepSession.create({ chatId, start, end, durationMinutes });
  sleepSessionTracker.delete(chatId);

  const startStr = dayjs(start).format('HH:mm');
  const endStr = dayjs(end).format('HH:mm');
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const durationStr = hours > 0 ? `${hours}h${mins}p` : `${mins}p`;

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '✅ GIẤC NGỦ HOÀN TẤT',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `⏰ Từ ${startStr} đến ${endStr}`,
    `⏱️ Tổng: ${durationStr}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '💡 Gõ /sleep stats để xem thống kê giấc ngủ tuần.'
  ];

  await safeSendMessage(
    chatId,
    lines.join('\n'),
    mainKeyboard
  );
};

/**
 * Toggle trạng thái ngủ (cho nút bấm) - hiển thị trạng thái trước, sau đó toggle
 */
const handleSleepToggle = async (chatId) => {
  const status = getSleepStatus(chatId);
  
  // Hiển thị trạng thái trước
  await showSleepMenu(chatId);
  
  // Sau đó mới toggle (gọi ngay sau khi hiển thị)
  if (status.isSleeping) {
    await handleSleepStop(chatId);
  } else {
    await handleSleepStart(chatId);
  }
};

/**
 * Xem trạng thái ngủ hiện tại
 */
const handleSleepStatus = async (chatId) => {
  await showSleepMenu(chatId);
};

/**
 * Tính thống kê giấc ngủ
 */
export const calculateSleepStats = async (chatId, days = 7) => {
  const end = dayjs().endOf('day');
  const start = end.subtract(days - 1, 'day').startOf('day');
  const sessions = await SleepSession.find({
    chatId,
    start: { $gte: start.toDate() },
    end: { $lte: end.toDate() }
  });
  if (!sessions.length) return null;

  const totalMinutes = sessions.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
  const nightMinutes = sessions
    .filter((session) => isNightSleep(session))
    .reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
  const napMinutes = totalMinutes - nightMinutes;
  const averagePerDay = totalMinutes / days;
  const napCount = sessions.filter((session) => !isNightSleep(session)).length;
  const nightCount = sessions.filter((session) => isNightSleep(session)).length;
  
  const grouped = sessions.reduce((acc, session) => {
    const dayKey = dayjs(session.start).format('ddd');
    acc[dayKey] = (acc[dayKey] ?? 0) + (session.durationMinutes ?? 0);
    return acc;
  }, {});

  return { 
    totalMinutes, 
    nightMinutes, 
    napMinutes, 
    averagePerDay, 
    grouped, 
    sessionCount: sessions.length,
    napCount,
    nightCount
  };
};

/**
 * Xem thống kê giấc ngủ
 */
const handleSleepStats = async (chatId) => {
  const stats = await calculateSleepStats(chatId, 7);
  if (!stats) {
    await safeSendMessage(
      chatId,
      '🛌 Chưa có dữ liệu giấc ngủ.\n\n' +
      '📝 Cách ghi nhận:\n' +
      '1. Bấm "😴 Nhật ký ngủ" khi bé bắt đầu ngủ\n' +
      '2. Bấm lại khi bé dậy\n' +
      '3. Bot sẽ tự tính thời gian!',
      mainKeyboard
    );
    return;
  }
  const profile = await ChatProfile.findOne({ chatId });
  const ageMonths = profile?.dateOfBirth ? dayjs().diff(dayjs(profile.dateOfBirth), 'month') : null;
  const guideline = getSleepGuideline(ageMonths);
  const bulletDays = Object.entries(stats.grouped)
    .map(([day, minutes]) => `• ${day}: ${formatMinutes(minutes)}`)
    .join('\n');
  
  const message = [
    '🛌 Thống kê giấc ngủ (7 ngày qua):',
    '',
    `📊 Tổng ${stats.sessionCount} giấc ngủ`,
    `🌙 Ngủ đêm: ${stats.nightCount} giấc • ${formatMinutes(stats.nightMinutes)}`,
    `☀️ Ngủ ngày: ${stats.napCount} giấc • ${formatMinutes(stats.napMinutes)}`,
    `⏱️ Trung bình: ${formatMinutes(stats.averagePerDay)}/ngày`,
    '',
    '📅 Chi tiết theo ngày:',
    bulletDays,
    '',
    `💡 ${guideline}`
  ].join('\n');
  
  await safeSendMessage(chatId, message, mainKeyboard);
};

/**
 * Đăng ký handlers cho sleep
 */
export const registerSleepHandler = () => {
  // Bấm nút "😴 Nhật ký ngủ" -> hiển thị trạng thái trước, sau đó toggle
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();
    
    if (text === '😴 Nhật ký ngủ') {
      clearState(msg.chat.id);
      await handleSleepToggle(msg.chat.id);
      return;
    }
  });

  bot.onText(/\/sleep\s+start/, async (msg) => {
    clearState(msg.chat.id);
    await handleSleepStart(msg.chat.id);
  });

  bot.onText(/\/sleep\s+stop/, async (msg) => {
    clearState(msg.chat.id);
    await handleSleepStop(msg.chat.id);
  });

  bot.onText(/\/sleep\s+stats/, async (msg) => {
    clearState(msg.chat.id);
    await handleSleepStats(msg.chat.id);
  });

  bot.onText(/\/sleep\s+status/, async (msg) => {
    clearState(msg.chat.id);
    await handleSleepStatus(msg.chat.id);
  });

  // /sleep không có tham số -> xem trạng thái
  bot.onText(/\/sleep\s*$/, async (msg) => {
    clearState(msg.chat.id);
    await handleSleepStatus(msg.chat.id);
  });
};

export default registerSleepHandler;
