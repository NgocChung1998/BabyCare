import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { SleepSession, ChatProfile, Feeding } from '../../database/models/index.js';
import { mainKeyboard, buildInlineKeyboard } from '../keyboard.js';
import { formatMinutes } from '../../utils/formatters.js';
import { isNightSleep, getSleepGuideline } from '../../utils/helpers.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';
import { getGroupChatIds, notifySyncMembers } from './sync.js';

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

const normalizeToDate = (value) => (value instanceof Date ? value : new Date(value));

export const hydrateSleepTracker = async (chatId) => {
  if (sleepSessionTracker.has(chatId)) {
    return sleepSessionTracker.get(chatId);
  }
  const profile = await ChatProfile.findOne({ chatId, currentSleepStart: { $exists: true } });
  if (profile?.currentSleepStart) {
    const startTime = normalizeToDate(profile.currentSleepStart);
    sleepSessionTracker.set(chatId, startTime);
    return startTime;
  }
  return null;
};

export const setOngoingSleep = async (chatId, startTime) => {
  const normalized = normalizeToDate(startTime);
  sleepSessionTracker.set(chatId, normalized);
  await ChatProfile.findOneAndUpdate(
    { chatId },
    { currentSleepStart: normalized },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

export const clearOngoingSleep = async (chatId) => {
  sleepSessionTracker.delete(chatId);
  await ChatProfile.findOneAndUpdate(
    { chatId },
    { $unset: { currentSleepStart: '' } }
  );
};

/**
 * Parse thời gian từ input đơn giản
 * "6" -> "06:00"
 * "6 30" hoặc "6:30" -> "06:30"
 * "14" -> "14:00"
 * "14 30" -> "14:30"
 */
const parseSimpleTime = (input) => {
  if (!input) return null;
  const text = input.trim();
  
  // Format HH:mm
  const fullMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (fullMatch) {
    const h = parseInt(fullMatch[1], 10);
    const m = parseInt(fullMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }
  
  // Format "H" hoặc "HH"
  const hourOnly = text.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const h = parseInt(hourOnly[1], 10);
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, '0')}:00`;
    }
    return null;
  }
  
  // Format "H M" hoặc "H MM"
  const spaceFormat = text.match(/^(\d{1,2})\s+(\d{1,2})$/);
  if (spaceFormat) {
    const h = parseInt(spaceFormat[1], 10);
    const m = parseInt(spaceFormat[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }
  
  return null;
};

/**
 * Tạo các button thời gian để chọn (trừ đi từ hiện tại)
 * Ví dụ: 9:30 -> 9:05, 9:10, 9:15, 9:20, 9:25, 9:30
 */
const generateTimeButtons = (minutesBefore = 25, stepMinutes = 5, type = 'sleep') => {
  const now = dayjs();
  const buttons = [];
  const row1 = [];
  const row2 = [];
  
  // Tạo các mốc thời gian
  for (let i = minutesBefore; i >= 0; i -= stepMinutes) {
    const time = now.subtract(i, 'minute');
    const timeStr = time.format('HH:mm');
    const callbackData = `${type}_time_${timeStr}`;
    
    if (buttons.length < 3) {
      row1.push({ text: timeStr, callback_data: callbackData });
    } else {
      row2.push({ text: timeStr, callback_data: callbackData });
    }
    buttons.push(timeStr);
  }
  
  const result = [row1];
  if (row2.length) result.push(row2);
  result.push([{ text: '✏️ Nhập giờ khác', callback_data: `${type}_custom_time` }]);
  result.push([{ text: '❌ Hủy', callback_data: `${type}_cancel` }]);
  
  return buildInlineKeyboard(result);
};

/**
 * Lấy thời gian thức khuyến nghị theo độ tuổi (phút)
 */
const getRecommendedAwakeTime = (ageMonths) => {
  if (ageMonths < 3) return { min: 45, max: 90 }; // 45-90 phút
  if (ageMonths < 6) return { min: 90, max: 150 }; // 1.5-2.5h
  if (ageMonths < 9) return { min: 120, max: 180 }; // 2-3h
  if (ageMonths < 12) return { min: 150, max: 240 }; // 2.5-4h
  if (ageMonths < 18) return { min: 180, max: 300 }; // 3-5h
  if (ageMonths < 24) return { min: 240, max: 360 }; // 4-6h
  return { min: 300, max: 420 }; // 5-7h
};

/**
 * Lấy thời gian ngủ khuyến nghị theo độ tuổi (phút)
 */
const getRecommendedNapDuration = (ageMonths) => {
  if (ageMonths < 3) return { min: 30, max: 120 }; // 30p-2h
  if (ageMonths < 6) return { min: 45, max: 120 }; // 45p-2h
  if (ageMonths < 9) return { min: 60, max: 120 }; // 1-2h
  if (ageMonths < 12) return { min: 60, max: 120 }; // 1-2h
  return { min: 60, max: 150 }; // 1-2.5h
};

/**
 * Hiển thị menu ngủ với trạng thái - KHÔNG thực hiện hành động luôn
 */
const showSleepMenu = async (chatId) => {
  // Lấy tất cả chatId trong nhóm để query dữ liệu chung
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  await hydrateSleepTracker(primaryChatId);
  
  // Kiểm tra trạng thái ngủ từ primary chatId
  const status = getSleepStatus(primaryChatId);
  
  // Lấy giấc ngủ gần nhất đã hoàn thành (có end)
  const lastCompletedSleep = await SleepSession.findOne({ 
    chatId: { $in: groupChatIds },
    end: { $exists: true, $ne: null }
  }).sort({ end: -1 });
  
  // Lấy cữ ăn gần nhất
  const lastFeed = await Feeding.findOne({ chatId: { $in: groupChatIds } }).sort({ recordedAt: -1 });
  
  // Lấy tuổi bé để tính khuyến nghị
  const profile = await ChatProfile.findOne({ chatId: { $in: groupChatIds }, dateOfBirth: { $exists: true } });
  const ageMonths = profile?.dateOfBirth 
    ? dayjs().diff(dayjs(profile.dateOfBirth), 'month')
    : 6; // Mặc định 6 tháng
  
  const awakeTimeRec = getRecommendedAwakeTime(ageMonths);
  const napDurationRec = getRecommendedNapDuration(ageMonths);
  
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
      ? `${elapsedHours}h${elapsedMins > 0 ? `${elapsedMins}p` : ''}`
      : `${elapsedMins}p`;
    
    // Dự đoán giờ dậy (dựa trên khuyến nghị theo tuổi)
    const avgNapMins = Math.round((napDurationRec.min + napDurationRec.max) / 2);
    const estimatedWake = dayjs(status.startTime).add(avgNapMins, 'minute');
    const estimatedWakeStr = estimatedWake.format('HH:mm');
    
    // Tính thời gian còn lại đến giờ dậy dự kiến
    const remainingMins = Math.max(0, avgNapMins - status.elapsedMinutes);
    const remainingStr = remainingMins > 0 ? `còn ~${remainingMins}p` : 'có thể dậy sớm';
    
    lines.push('🟢 BÉ ĐANG NGỦ');
    lines.push('');
    lines.push(`⏰ Bắt đầu: ${startStr}`);
    lines.push(`⏱️ Đã ngủ: ${elapsedStr}`);
    lines.push('');
    lines.push(`💭 Dự kiến dậy: ~${estimatedWakeStr}`);
    lines.push(`   └─ ${remainingStr}`);
    lines.push('');
    lines.push(`📊 Khuyến nghị (${ageMonths} tháng): ${napDurationRec.min}-${napDurationRec.max}p`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push('👇 Bé đã dậy? Bấm nút bên dưới:');
  } else {
    lines.push('⚪ BÉ ĐANG THỨC');
    lines.push('');
    
    let awakeMinutes = 0;
    let lastWakeTime = null;
    
    if (lastCompletedSleep && lastCompletedSleep.end) {
      lastWakeTime = dayjs(lastCompletedSleep.end);
      const lastEndStr = lastWakeTime.format('HH:mm');
      const lastHours = Math.floor(lastCompletedSleep.durationMinutes / 60);
      const lastMins = lastCompletedSleep.durationMinutes % 60;
      const lastDurationStr = lastHours > 0 
        ? `${lastHours}h${lastMins > 0 ? `${lastMins}p` : ''}`
        : `${lastMins}p`;
      
      awakeMinutes = Math.round((Date.now() - new Date(lastCompletedSleep.end).getTime()) / 60000);
      const awakeHours = Math.floor(awakeMinutes / 60);
      const awakeMins = awakeMinutes % 60;
      const awakeStr = awakeHours > 0 
        ? `${awakeHours}h${awakeMins > 0 ? `${awakeMins}p` : ''}`
        : `${awakeMins}p`;
      
      lines.push(`📋 Giấc ngủ gần nhất:`);
      lines.push(`   └─ ${lastDurationStr} (dậy lúc ${lastEndStr})`);
      lines.push(`   └─ Đã thức: ${awakeStr}`);
      
      // Tính giờ ngủ tiếp theo khuyến nghị
      const avgAwakeTime = Math.round((awakeTimeRec.min + awakeTimeRec.max) / 2);
      const nextSleepTime = lastWakeTime.add(avgAwakeTime, 'minute');
      const nextSleepStr = nextSleepTime.format('HH:mm');
      const minsUntilSleep = Math.round((nextSleepTime.toDate().getTime() - Date.now()) / 60000);
      
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('💡 KHUYẾN NGHỊ (theo chuyên gia)');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`📊 Thời gian thức (${ageMonths} tháng):`);
      lines.push(`   └─ Khuyến nghị: ${awakeTimeRec.min}-${awakeTimeRec.max}p`);
      lines.push('');
      
      if (minsUntilSleep > 0) {
        lines.push(`⏰ Nên cho ngủ: ~${nextSleepStr}`);
        lines.push(`   └─ còn ${minsUntilSleep}p nữa`);
      } else {
        lines.push(`⚠️ ĐÃ QUÁ GIỜ NGỦ!`);
        lines.push(`   └─ Nên cho bé ngủ ngay`);
      }
    } else {
      lines.push('📋 Chưa có giấc ngủ được ghi nhận');
      lines.push('');
      lines.push(`💡 Khuyến nghị (${ageMonths} tháng):`);
      lines.push(`   └─ Thức: ${awakeTimeRec.min}-${awakeTimeRec.max}p`);
      lines.push(`   └─ Ngủ nap: ${napDurationRec.min}-${napDurationRec.max}p`);
    }
    
    if (lastFeed) {
      const lastFeedTime = dayjs(lastFeed.recordedAt).format('HH:mm');
      lines.push('');
      lines.push(`🍼 Cữ ăn gần nhất: ${lastFeedTime} (${lastFeed.amountMl}ml)`);
    }
    
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push('👇 Chọn hành động:');
  }
  
  // Keyboard với nút hành động và liên kết
  const buttons = [];
  
  if (status.isSleeping) {
    buttons.push([{ text: '⏹️ Bé đã dậy - Kết thúc ngủ', callback_data: 'sleep_confirm_stop' }]);
    buttons.push([{ text: '✏️ Sửa giờ bắt đầu ngủ', callback_data: 'sleep_edit_start' }]);
  } else {
    buttons.push([{ text: '▶️ Bé bắt đầu ngủ', callback_data: 'sleep_confirm_start' }]);
  }
  
  buttons.push([
    { text: '🍼 Ghi cữ ăn', callback_data: 'go_milk' },
    { text: '📅 Lịch ăn ngủ', callback_data: 'go_routine' }
  ]);
  buttons.push([
    { text: '📊 Thống kê tuần', callback_data: 'sleep_stats' }
  ]);
  
  await safeSendMessage(chatId, lines.join('\n'), buildInlineKeyboard(buttons));
};

/**
 * Xác nhận bắt đầu ngủ - hiển thị các button chọn giờ
 */
const confirmSleepStart = async (chatId) => {
  const lines = [
    '😴 XÁC NHẬN BẮT ĐẦU NGỦ',
    '',
    '⏰ Bé bắt đầu ngủ lúc mấy giờ?',
    '',
    '👇 Chọn giờ hoặc nhập thủ công:'
  ];
  
  await safeSendMessage(chatId, lines.join('\n'), generateTimeButtons(25, 5, 'sleep_start'));
};

/**
 * Xác nhận kết thúc ngủ - hiển thị các button chọn giờ
 */
const confirmSleepStop = async (chatId) => {
  const lines = [
    '⏹️ XÁC NHẬN KẾT THÚC NGỦ',
    '',
    '⏰ Bé dậy lúc mấy giờ?',
    '',
    '👇 Chọn giờ hoặc nhập thủ công:'
  ];
  
  await safeSendMessage(chatId, lines.join('\n'), generateTimeButtons(25, 5, 'sleep_stop'));
};

/**
 * Bắt đầu ngủ với thời gian cụ thể
 */
const handleSleepStart = async (chatId, timeStr = null) => {
  // Lấy primary chatId để dùng chung tracker
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  
  const status = getSleepStatus(primaryChatId);
  if (status.isSleeping) {
    await safeSendMessage(chatId, '⚠️ Bé đang ngủ rồi! Bấm "Kết thúc ngủ" khi bé dậy nhé.', mainKeyboard);
    return;
  }
  
  let startTime;
  if (timeStr) {
    const now = dayjs();
    startTime = dayjs(`${now.format('YYYY-MM-DD')} ${timeStr}`).toDate();
  } else {
    startTime = new Date();
  }
  
  // Lưu vào cả memory tracker VÀ database để persist khi restart
  await setOngoingSleep(primaryChatId, startTime);
  const displayTime = dayjs(startTime).format('HH:mm');
  
  await safeSendMessage(
    chatId,
    `✅ Đã ghi nhận!\n\n` +
    `😴 Bé bắt đầu ngủ lúc ${displayTime}\n` +
    `💤 Chúc bé ngủ ngon!\n\n` +
    `📝 Khi bé dậy, bấm nút "😴 Nhật ký ngủ"`,
    mainKeyboard
  );
  
  // Thông báo cho các thành viên khác
  await notifySyncMembers(chatId, `Bé bắt đầu ngủ lúc ${displayTime}`);
};

/**
 * Kết thúc ngủ với thời gian cụ thể
 */
const handleSleepStop = async (chatId, endTimeStr = null) => {
  // Lấy primary chatId để dùng chung tracker
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  
  const status = getSleepStatus(primaryChatId);
  if (!status.isSleeping) {
    await safeSendMessage(chatId, '⚠️ Bé không đang ngủ!', mainKeyboard);
    return;
  }
  
  const start = status.startTime;
  let end;
  
  if (endTimeStr) {
    const now = dayjs();
    end = dayjs(`${now.format('YYYY-MM-DD')} ${endTimeStr}`).toDate();
    // Nếu giờ kết thúc nhỏ hơn giờ bắt đầu (qua ngày mới)
    if (end < start) {
      end = dayjs(end).add(1, 'day').toDate();
    }
  } else {
    end = new Date();
  }
  
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  
  // Không lưu nếu thời gian quá ngắn
  if (durationMinutes < 1) {
    await safeSendMessage(chatId, '⚠️ Thời gian ngủ quá ngắn! Vui lòng kiểm tra lại.', mainKeyboard);
    return;
  }
  
  // Lưu với primaryChatId để dữ liệu tập trung
  await SleepSession.create({ chatId: primaryChatId, start, end, durationMinutes });
  // Xóa khỏi cả memory tracker VÀ database
  await clearOngoingSleep(primaryChatId);

  const startStr = dayjs(start).format('HH:mm');
  const endStr = dayjs(end).format('HH:mm');
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const durationStr = hours > 0 ? `${hours}h${mins > 0 ? `${mins}p` : ''}` : `${mins}p`;

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '✅ GIẤC NGỦ HOÀN TẤT',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `⏰ ${startStr} → ${endStr}`,
    `⏱️ Tổng: ${durationStr}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '🎉 Bé ngủ ngon quá!',
    '',
    '💡 Bấm /sleep stats để xem thống kê tuần.'
  ];

  await safeSendMessage(chatId, lines.join('\n'), mainKeyboard);
  
  // Thông báo cho các thành viên khác
  await notifySyncMembers(chatId, `Bé đã dậy! Ngủ ${durationStr} (${startStr} → ${endStr})`);
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
      '2. Chọn giờ hoặc nhập giờ\n' +
      '3. Khi bé dậy, bấm lại để kết thúc!',
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
    '━━━━━━━━━━━━━━━━━━━━',
    '🛌 THỐNG KÊ GIẤC NGỦ (7 ngày)',
    '━━━━━━━━━━━━━━━━━━━━',
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
  // Bấm nút "😴 Nhật ký ngủ" -> CHỈ hiển thị trạng thái, KHÔNG thực hiện hành động
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();
    
    if (text === '😴 Nhật ký ngủ') {
      clearState(msg.chat.id);
      await showSleepMenu(msg.chat.id);
      return;
    }
  });

  // Commands
  bot.onText(/\/sleep\s+start/, async (msg) => {
    clearState(msg.chat.id);
    await confirmSleepStart(msg.chat.id);
  });

  bot.onText(/\/sleep\s+stop/, async (msg) => {
    clearState(msg.chat.id);
    await confirmSleepStop(msg.chat.id);
  });

  bot.onText(/\/sleep\s+stats/, async (msg) => {
    clearState(msg.chat.id);
    await handleSleepStats(msg.chat.id);
  });

  // /sleep không có tham số -> xem trạng thái
  bot.onText(/\/sleep\s*$/, async (msg) => {
    clearState(msg.chat.id);
    await showSleepMenu(msg.chat.id);
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    // Xác nhận bắt đầu ngủ -> hiển thị các button chọn giờ
    if (query.data === 'sleep_confirm_start') {
      await bot.answerCallbackQuery(query.id);
      await confirmSleepStart(chatId);
      return;
    }
    
    // Xác nhận kết thúc ngủ -> hiển thị các button chọn giờ
    if (query.data === 'sleep_confirm_stop') {
      await bot.answerCallbackQuery(query.id);
      await confirmSleepStop(chatId);
      return;
    }
    
    // Chọn giờ bắt đầu ngủ từ button
    if (query.data.startsWith('sleep_start_time_')) {
      const timeStr = query.data.replace('sleep_start_time_', '');
      await bot.answerCallbackQuery(query.id, { text: `😴 Bắt đầu ngủ lúc ${timeStr}` });
      await handleSleepStart(chatId, timeStr);
      return;
    }
    
    // Chọn giờ kết thúc ngủ từ button
    if (query.data.startsWith('sleep_stop_time_')) {
      const timeStr = query.data.replace('sleep_stop_time_', '');
      await bot.answerCallbackQuery(query.id, { text: `⏹️ Dậy lúc ${timeStr}` });
      await handleSleepStop(chatId, timeStr);
      return;
    }
    
    // Nhập giờ thủ công cho bắt đầu ngủ
    if (query.data === 'sleep_start_custom_time') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'sleep_start_input' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ bé bắt đầu ngủ:\n\n' +
        '📝 Ví dụ:\n' +
        '• 9 → 09:00\n' +
        '• 9 30 → 09:30\n' +
        '• 14:15 → 14:15'
      );
      return;
    }
    
    // Nhập giờ thủ công cho kết thúc ngủ
    if (query.data === 'sleep_stop_custom_time') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'sleep_stop_input' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ bé dậy:\n\n' +
        '📝 Ví dụ:\n' +
        '• 10 → 10:00\n' +
        '• 10 45 → 10:45\n' +
        '• 15:30 → 15:30'
      );
      return;
    }
    
    // Hủy
    if (query.data === 'sleep_start_cancel' || query.data === 'sleep_stop_cancel') {
      await bot.answerCallbackQuery(query.id, { text: 'Đã hủy' });
      clearState(chatId);
      await showSleepMenu(chatId);
      return;
    }
    
    if (query.data === 'sleep_stats') {
      await bot.answerCallbackQuery(query.id);
      await handleSleepStats(chatId);
      return;
    }
    
    // ===== NAVIGATION LINKS =====
    if (query.data === 'go_milk') {
      await bot.answerCallbackQuery(query.id);
      const { showMilkMenu } = await import('./milk.js');
      await showMilkMenu(chatId);
      return;
    }
    
    if (query.data === 'go_routine') {
      await bot.answerCallbackQuery(query.id);
      const { showRoutineMenu } = await import('./routine.js');
      await showRoutineMenu(chatId);
      return;
    }
  });
  
  // Xử lý input thủ công
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    const state = getState(chatId);
    
    // Nhập giờ bắt đầu ngủ
    if (state?.type === 'sleep_start_input') {
      const timeStr = parseSimpleTime(text);
      if (!timeStr) {
        await safeSendMessage(
          chatId, 
          '❌ Không hiểu!\n\nNhập lại:\n• 9 → 09:00\n• 9 30 → 09:30\n• 14:15 → 14:15'
        );
        return;
      }
      clearState(chatId);
      await handleSleepStart(chatId, timeStr);
      return;
    }
    
    // Nhập giờ kết thúc ngủ
    if (state?.type === 'sleep_stop_input') {
      const timeStr = parseSimpleTime(text);
      if (!timeStr) {
        await safeSendMessage(
          chatId, 
          '❌ Không hiểu!\n\nNhập lại:\n• 10 → 10:00\n• 10 45 → 10:45\n• 15:30 → 15:30'
        );
        return;
      }
      clearState(chatId);
      await handleSleepStop(chatId, timeStr);
      return;
    }
  });
};

export { showSleepMenu };
export default registerSleepHandler;
