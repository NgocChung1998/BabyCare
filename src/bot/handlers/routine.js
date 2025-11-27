import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { bot, safeSendMessage } from '../index.js';
import { ChatProfile, Feeding, SleepSession, DailyRoutine } from '../../database/models/index.js';
import { routineInlineKeyboard, buildInlineKeyboard, mainKeyboard } from '../keyboard.js';
import { generateDailyRoutine, getScheduleByAge } from '../../services/routineService.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';
import { formatAge } from '../../utils/formatters.js';
import { sleepSessionTracker } from './sleep.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Parse thời gian từ input đơn giản
 */
const parseSimpleTime = (input) => {
  if (!input) return null;
  const text = input.trim();
  
  const fullMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (fullMatch) {
    const h = parseInt(fullMatch[1], 10);
    const m = parseInt(fullMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }
  
  const hourOnly = text.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const h = parseInt(hourOnly[1], 10);
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, '0')}:00`;
    }
    return null;
  }
  
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
 * Hiển thị menu lịch ăn ngủ
 */
const showRoutineMenu = async (chatId) => {
  const profile = await ChatProfile.findOne({ chatId });
  
  if (!profile?.dateOfBirth) {
    await safeSendMessage(
      chatId,
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '📅 LỊCH ĂN NGỦ\n' +
      '━━━━━━━━━━━━━━━━━━━━\n\n' +
      '❌ Chưa có ngày sinh của bé!\n\n' +
      '📝 Để tạo lịch ăn ngủ tự động theo độ tuổi,\n' +
      'vui lòng cập nhật ngày sinh:\n\n' +
      '/birthday set YYYY-MM-DD\n\n' +
      'Ví dụ: /birthday set 2024-05-10',
      mainKeyboard
    );
    return;
  }
  
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  const birthDate = dayjs.tz(profile.dateOfBirth, VIETNAM_TZ);
  const ageMonths = now.diff(birthDate, 'month');
  const schedule = getScheduleByAge(ageMonths);
  const ageText = formatAge(profile.dateOfBirth);
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '📅 LỊCH ĂN NGỦ HÀNG NGÀY',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `👶 Tuổi bé: ${ageText}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '📊 KHUYẾN NGHỊ THEO ĐỘ TUỔI:',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🍼 Cữ ăn: mỗi ${schedule.feedingIntervalHours}h`,
    `😴 Tổng giấc ngủ: ${schedule.totalSleep}`,
    `🌙 Ngủ đêm: ${schedule.nightSleep}`,
    `☀️ Giấc ngày: ${schedule.naps}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '👇 Chọn để xem chi tiết:'
  ];
  
  await safeSendMessage(chatId, lines.join('\n'), routineInlineKeyboard);
};

/**
 * Hiển thị lịch ăn hôm nay
 * Chỉ hiện: đã hoàn thành (icon ✅) + tương lai (icon ⏳)
 * Không hiện quá khứ chưa hoàn thành
 */
const showFeedingSchedule = async (chatId) => {
  const routine = await generateDailyRoutine(chatId);
  
  if (!routine) {
    await safeSendMessage(chatId, '❌ Chưa có lịch. Vui lòng cập nhật ngày sinh bé!', mainKeyboard);
    return;
  }
  
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  const currentTime = now.format('HH:mm');
  
  // Lấy thông tin ăn thực tế hôm nay
  const todayStart = now.startOf('day').toDate();
  const actualFeeds = await Feeding.find({
    chatId,
    recordedAt: { $gte: todayStart }
  }).sort({ recordedAt: 1 });
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '🍼 LỊCH ĂN HÔM NAY',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `📅 ${now.format('DD/MM/YYYY')}`,
    `⏰ Hiện tại: ${currentTime}`,
    ''
  ];
  
  // Hiển thị các cữ đã ăn (thực tế)
  if (actualFeeds.length > 0) {
    lines.push('✅ ĐÃ ĂN:');
    lines.push('');
    actualFeeds.forEach((feed, i) => {
      const time = dayjs.tz(feed.recordedAt, VIETNAM_TZ).format('HH:mm');
      lines.push(`   ${i + 1}. ✅ ${time} - ${feed.amountMl}ml`);
    });
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }
  
  // Lọc lịch dự kiến: chỉ hiện tương lai
  const futureSchedule = routine.feedingSchedule.filter(feed => {
    return feed.time >= currentTime;
  });
  
  if (futureSchedule.length > 0) {
    lines.push('⏳ SẮP TỚI:');
    lines.push('');
    futureSchedule.forEach((feed, i) => {
      lines.push(`   ${i + 1}. ⏳ ${feed.time}`);
    });
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }
  
  // Tổng kết
  lines.push(`📊 Hôm nay: ${actualFeeds.length} cữ`);
  if (actualFeeds.length > 0) {
    const totalMl = actualFeeds.reduce((sum, f) => sum + f.amountMl, 0);
    lines.push(`   └─ Tổng: ${totalMl}ml`);
  }
  
  lines.push('');
  lines.push('💡 Quên ghi nhận? Bấm "Thêm cữ ăn"');
  
  const editKeyboard = buildInlineKeyboard([
    [
      { text: '➕ Thêm cữ ăn', callback_data: 'routine_add_feed' },
      { text: '🔙 Quay lại', callback_data: 'routine_back' }
    ]
  ]);
  
  await safeSendMessage(chatId, lines.join('\n'), editKeyboard);
};

/**
 * Hiển thị lịch ngủ hôm nay
 * Chỉ hiện: đã ngủ (icon ✅) + tương lai (icon ⏳)
 */
const showSleepSchedule = async (chatId) => {
  const routine = await generateDailyRoutine(chatId);
  
  if (!routine) {
    await safeSendMessage(chatId, '❌ Chưa có lịch. Vui lòng cập nhật ngày sinh bé!', mainKeyboard);
    return;
  }
  
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  const currentTime = now.format('HH:mm');
  
  // Lấy thông tin ngủ thực tế hôm nay
  const todayStart = now.startOf('day').toDate();
  const actualSleeps = await SleepSession.find({
    chatId,
    start: { $gte: todayStart }
  }).sort({ start: 1 });
  
  // Kiểm tra trạng thái ngủ hiện tại
  const isSleeping = sleepSessionTracker.has(chatId);
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '😴 LỊCH NGỦ HÔM NAY',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `📅 ${now.format('DD/MM/YYYY')}`,
    `⏰ Hiện tại: ${currentTime}`,
    isSleeping ? '🟢 Bé đang ngủ' : '⚪ Bé đang thức',
    ''
  ];
  
  // Hiển thị các giấc đã ngủ (thực tế)
  if (actualSleeps.length > 0) {
    lines.push('✅ ĐÃ NGỦ:');
    lines.push('');
    actualSleeps.forEach((sleep, i) => {
      const start = dayjs.tz(sleep.start, VIETNAM_TZ).format('HH:mm');
      const end = sleep.end ? dayjs.tz(sleep.end, VIETNAM_TZ).format('HH:mm') : 'đang ngủ';
      const duration = sleep.durationMinutes 
        ? ` (${Math.floor(sleep.durationMinutes/60)}h${sleep.durationMinutes%60}p)`
        : '';
      lines.push(`   ${i + 1}. ✅ ${start} → ${end}${duration}`);
    });
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }
  
  // Lọc lịch dự kiến: chỉ hiện tương lai
  const futureSchedule = routine.sleepSchedule.filter(sleep => {
    return sleep.startTime >= currentTime;
  });
  
  if (futureSchedule.length > 0) {
    lines.push('⏳ SẮP TỚI:');
    lines.push('');
    futureSchedule.forEach((sleep, i) => {
      const durationStr = sleep.duration >= 60 
        ? `${Math.floor(sleep.duration/60)}h${sleep.duration%60 > 0 ? (sleep.duration%60) + 'p' : ''}`
        : `${sleep.duration}p`;
      lines.push(`   ${i + 1}. ⏳ ${sleep.startTime} - ${sleep.name} (~${durationStr})`);
    });
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }
  
  // Tổng kết
  lines.push(`📊 Hôm nay: ${actualSleeps.length} giấc`);
  if (actualSleeps.length > 0) {
    const totalMinutes = actualSleeps.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    lines.push(`   └─ Tổng: ${hours}h${mins}p`);
  }
  
  lines.push('');
  lines.push('💡 Quên ghi nhận? Bấm "Thêm giấc ngủ"');
  
  const editKeyboard = buildInlineKeyboard([
    [
      { text: '➕ Thêm giấc ngủ', callback_data: 'routine_add_sleep' },
      { text: '🔙 Quay lại', callback_data: 'routine_back' }
    ]
  ]);
  
  await safeSendMessage(chatId, lines.join('\n'), editKeyboard);
};

/**
 * Tạo các button thời gian để chọn
 */
const generateTimeButtons = (minutesBefore = 30, stepMinutes = 5, prefix = 'routine') => {
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  const row1 = [];
  const row2 = [];
  let count = 0;
  
  for (let i = minutesBefore; i >= 0; i -= stepMinutes) {
    const time = now.subtract(i, 'minute');
    const timeStr = time.format('HH:mm');
    const btn = { text: timeStr, callback_data: `${prefix}_time_${timeStr}` };
    
    if (count < 3) {
      row1.push(btn);
    } else if (count < 7) {
      row2.push(btn);
    }
    count++;
  }
  
  const result = [row1];
  if (row2.length) result.push(row2);
  result.push([{ text: '✏️ Nhập giờ khác', callback_data: `${prefix}_custom_time` }]);
  result.push([{ text: '❌ Hủy', callback_data: 'routine_cancel' }]);
  
  return buildInlineKeyboard(result);
};

// Các mức ml để chọn
const MILK_AMOUNTS = [120, 150, 170, 180, 200, 220, 250, 300];

/**
 * Đăng ký handlers cho routine
 */
export const registerRoutineHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    if (text === '📅 Lịch ăn ngủ') {
      clearState(chatId);
      await showRoutineMenu(chatId);
      return;
    }
    
    // Xử lý input
    const state = getState(chatId);
    
    // Nhập giờ ăn thủ công
    if (state?.type === 'routine_feed_input_time') {
      const timeStr = parseSimpleTime(text);
      if (!timeStr) {
        await safeSendMessage(
          chatId, 
          '❌ Không hiểu!\n\nNhập lại:\n• 9 → 09:00\n• 9 30 → 09:30'
        );
        return;
      }
      setState(chatId, { type: 'routine_feed_select_amount', timeStr });
      
      // Hiển thị keyboard chọn ml
      const amountButtons = [];
      for (let i = 0; i < MILK_AMOUNTS.length; i += 4) {
        const row = [];
        for (let j = i; j < i + 4 && j < MILK_AMOUNTS.length; j++) {
          row.push({ 
            text: `${MILK_AMOUNTS[j]}ml`, 
            callback_data: `routine_feed_amount_${MILK_AMOUNTS[j]}` 
          });
        }
        amountButtons.push(row);
      }
      amountButtons.push([{ text: '✏️ Nhập số khác', callback_data: 'routine_feed_custom_amount' }]);
      amountButtons.push([{ text: '❌ Hủy', callback_data: 'routine_cancel' }]);
      
      await safeSendMessage(
        chatId,
        `⏰ Giờ ăn: ${timeStr}\n\n👇 Chọn số ml:`,
        buildInlineKeyboard(amountButtons)
      );
      return;
    }
    
    // Nhập ml thủ công
    if (state?.type === 'routine_feed_input_amount') {
      const amount = parseInt(text, 10);
      if (isNaN(amount) || amount <= 0) {
        await safeSendMessage(chatId, '❌ Số không hợp lệ! Nhập lại số ml (ví dụ: 160)');
        return;
      }
      const timeStr = state.timeStr;
      clearState(chatId);
      
      // Lưu vào database
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const recordedAt = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      await Feeding.create({ chatId, amountMl: amount, recordedAt });
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận!\n\n🍼 ${amount}ml lúc ${timeStr}`,
        routineInlineKeyboard
      );
      // Hiển thị lại lịch ăn
      await showFeedingSchedule(chatId);
      return;
    }
    
    // Nhập giờ ngủ thủ công
    if (state?.type === 'routine_sleep_input_time') {
      const timeStr = parseSimpleTime(text);
      if (!timeStr) {
        await safeSendMessage(
          chatId, 
          '❌ Không hiểu!\n\nNhập lại:\n• 9 → 09:00\n• 9 30 → 09:30'
        );
        return;
      }
      clearState(chatId);
      
      // Lưu vào database
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const startTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      await SleepSession.create({
        chatId,
        start: startTime,
        end: now.toDate(),
        durationMinutes: Math.round((now.toDate().getTime() - startTime.getTime()) / 60000)
      });
      
      const duration = Math.round((now.toDate().getTime() - startTime.getTime()) / 60000);
      const hours = Math.floor(duration / 60);
      const mins = duration % 60;
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận!\n\n😴 Ngủ từ ${timeStr} đến ${now.format('HH:mm')}\n⏱️ ${hours}h${mins}p`,
        routineInlineKeyboard
      );
      // Hiển thị lại lịch ngủ
      await showSleepSchedule(chatId);
      return;
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'routine_feeds') {
      await bot.answerCallbackQuery(query.id);
      await showFeedingSchedule(chatId);
      return;
    }
    
    if (query.data === 'routine_sleeps') {
      await bot.answerCallbackQuery(query.id);
      await showSleepSchedule(chatId);
      return;
    }
    
    // Thêm cữ ăn - hiển thị button chọn giờ
    if (query.data === 'routine_add_feed') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'routine_feed_select_time' });
      await safeSendMessage(
        chatId,
        '➕ THÊM CỮ ĂN\n\n⏰ Bé ăn lúc mấy giờ?\n\n👇 Chọn giờ:',
        generateTimeButtons(30, 5, 'routine_feed')
      );
      return;
    }
    
    // Thêm giấc ngủ - hiển thị button chọn giờ
    if (query.data === 'routine_add_sleep') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'routine_sleep_select_time' });
      await safeSendMessage(
        chatId,
        '➕ THÊM GIẤC NGỦ\n\n⏰ Bé ngủ từ lúc mấy giờ?\n\n👇 Chọn giờ:',
        generateTimeButtons(30, 5, 'routine_sleep')
      );
      return;
    }
    
    // Chọn giờ ăn
    if (query.data.startsWith('routine_feed_time_')) {
      const timeStr = query.data.replace('routine_feed_time_', '');
      await bot.answerCallbackQuery(query.id, { text: `⏰ ${timeStr}` });
      setState(chatId, { type: 'routine_feed_select_amount', timeStr });
      
      // Hiển thị keyboard chọn ml
      const amountButtons = [];
      for (let i = 0; i < MILK_AMOUNTS.length; i += 4) {
        const row = [];
        for (let j = i; j < i + 4 && j < MILK_AMOUNTS.length; j++) {
          row.push({ 
            text: `${MILK_AMOUNTS[j]}ml`, 
            callback_data: `routine_feed_amount_${MILK_AMOUNTS[j]}` 
          });
        }
        amountButtons.push(row);
      }
      amountButtons.push([{ text: '✏️ Nhập số khác', callback_data: 'routine_feed_custom_amount' }]);
      amountButtons.push([{ text: '❌ Hủy', callback_data: 'routine_cancel' }]);
      
      await safeSendMessage(
        chatId,
        `⏰ Giờ ăn: ${timeStr}\n\n👇 Chọn số ml:`,
        buildInlineKeyboard(amountButtons)
      );
      return;
    }
    
    // Nhập giờ ăn thủ công
    if (query.data === 'routine_feed_custom_time') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'routine_feed_input_time' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ bé ăn:\n\n📝 Ví dụ:\n• 9 → 09:00\n• 9 30 → 09:30'
      );
      return;
    }
    
    // Chọn ml ăn
    if (query.data.startsWith('routine_feed_amount_')) {
      const amount = parseInt(query.data.replace('routine_feed_amount_', ''), 10);
      const state = getState(chatId);
      const timeStr = state?.timeStr;
      
      await bot.answerCallbackQuery(query.id, { text: `🍼 ${amount}ml` });
      clearState(chatId);
      
      // Lưu vào database
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const recordedAt = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      await Feeding.create({ chatId, amountMl: amount, recordedAt });
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận!\n\n🍼 ${amount}ml lúc ${timeStr}`,
        routineInlineKeyboard
      );
      // Hiển thị lại lịch ăn
      await showFeedingSchedule(chatId);
      return;
    }
    
    // Nhập ml thủ công
    if (query.data === 'routine_feed_custom_amount') {
      await bot.answerCallbackQuery(query.id);
      const state = getState(chatId);
      setState(chatId, { type: 'routine_feed_input_amount', timeStr: state?.timeStr });
      await safeSendMessage(chatId, '✏️ Nhập số ml:\n\nVí dụ: 160');
      return;
    }
    
    // Chọn giờ ngủ
    if (query.data.startsWith('routine_sleep_time_')) {
      const timeStr = query.data.replace('routine_sleep_time_', '');
      await bot.answerCallbackQuery(query.id, { text: `⏰ ${timeStr}` });
      clearState(chatId);
      
      // Lưu vào database - giấc ngủ kết thúc bây giờ
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const startTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      const durationMinutes = Math.round((now.toDate().getTime() - startTime.getTime()) / 60000);
      
      await SleepSession.create({
        chatId,
        start: startTime,
        end: now.toDate(),
        durationMinutes
      });
      
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận!\n\n😴 Ngủ từ ${timeStr} đến ${now.format('HH:mm')}\n⏱️ ${hours}h${mins}p`,
        routineInlineKeyboard
      );
      // Hiển thị lại lịch ngủ
      await showSleepSchedule(chatId);
      return;
    }
    
    // Nhập giờ ngủ thủ công
    if (query.data === 'routine_sleep_custom_time') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'routine_sleep_input_time' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ bé bắt đầu ngủ:\n\n📝 Ví dụ:\n• 9 → 09:00\n• 9 30 → 09:30'
      );
      return;
    }
    
    if (query.data === 'routine_generate') {
      await bot.answerCallbackQuery(query.id, { text: 'Đang tạo lịch mới...' });
      const routine = await generateDailyRoutine(chatId);
      if (routine) {
        await safeSendMessage(chatId, '✅ Đã tạo lịch ăn ngủ mới cho hôm nay!', routineInlineKeyboard);
      } else {
        await safeSendMessage(chatId, '❌ Không thể tạo lịch. Vui lòng cập nhật ngày sinh bé!', mainKeyboard);
      }
      return;
    }
    
    if (query.data === 'routine_back') {
      await bot.answerCallbackQuery(query.id);
      clearState(chatId);
      await showRoutineMenu(chatId);
      return;
    }
    
    if (query.data === 'routine_cancel') {
      await bot.answerCallbackQuery(query.id, { text: 'Đã hủy' });
      clearState(chatId);
      await showRoutineMenu(chatId);
      return;
    }
  });
};

// Export để sử dụng trong jobs
export { showRoutineMenu, showFeedingSchedule, showSleepSchedule };
export default registerRoutineHandler;
