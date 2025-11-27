import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { bot, safeSendMessage } from '../index.js';
import { ChatProfile, Feeding, SleepSession } from '../../database/models/index.js';
import { routineInlineKeyboard, buildInlineKeyboard, mainKeyboard } from '../keyboard.js';
import { generateDailyRoutine, getScheduleByAge, editActivityTime, checkMissedActivities, markAsReminded } from '../../services/routineService.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';
import { formatAge } from '../../utils/formatters.js';
import { sleepSessionTracker } from './sleep.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

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
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];
  
  // Hiển thị lịch dự kiến
  lines.push('📋 LỊCH DỰ KIẾN:');
  lines.push('');
  
  for (const feed of routine.feedingSchedule) {
    const isPast = feed.time < currentTime;
    const isCurrent = Math.abs(
      now.diff(dayjs.tz(`${now.format('YYYY-MM-DD')} ${feed.time}`, VIETNAM_TZ), 'minute')
    ) <= 30;
    
    let status = '⏳';
    if (feed.completed) status = '✅';
    else if (isPast) status = '⚠️';
    if (isCurrent && !feed.completed) status = '🔔';
    
    lines.push(`${status} ${feed.time}${feed.amountMl ? ` (${feed.amountMl}ml)` : ''}`);
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  
  // Hiển thị ăn thực tế
  lines.push('📝 THỰC TẾ HÔM NAY:');
  lines.push('');
  
  if (actualFeeds.length > 0) {
    actualFeeds.forEach((feed, i) => {
      const time = dayjs.tz(feed.recordedAt, VIETNAM_TZ).format('HH:mm');
      lines.push(`${i + 1}. ${time} - ${feed.amountMl}ml`);
    });
  } else {
    lines.push('Chưa có bữa ăn nào được ghi nhận');
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('💡 Quên ghi nhận? Bấm "Sửa giờ ăn"');
  
  const editKeyboard = buildInlineKeyboard([
    [
      { text: '✏️ Sửa giờ ăn', callback_data: 'routine_edit_feed' },
      { text: '🔙 Quay lại', callback_data: 'routine_back' }
    ]
  ]);
  
  await safeSendMessage(chatId, lines.join('\n'), editKeyboard);
};

/**
 * Hiển thị lịch ngủ hôm nay
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
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];
  
  // Hiển thị lịch dự kiến
  lines.push('📋 LỊCH DỰ KIẾN:');
  lines.push('');
  
  for (const sleep of routine.sleepSchedule) {
    const isPast = sleep.startTime < currentTime;
    const isCurrent = Math.abs(
      now.diff(dayjs.tz(`${now.format('YYYY-MM-DD')} ${sleep.startTime}`, VIETNAM_TZ), 'minute')
    ) <= 30;
    
    let status = '⏳';
    if (sleep.completed) status = '✅';
    else if (isPast) status = '⚠️';
    if (isCurrent && !sleep.completed) status = '🔔';
    
    const durationStr = sleep.duration >= 60 
      ? `${Math.floor(sleep.duration/60)}h${sleep.duration%60 > 0 ? (sleep.duration%60) + 'p' : ''}`
      : `${sleep.duration}p`;
    
    lines.push(`${status} ${sleep.startTime} - ${sleep.name} (${durationStr})`);
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  
  // Hiển thị ngủ thực tế
  lines.push('📝 THỰC TẾ HÔM NAY:');
  lines.push('');
  
  if (actualSleeps.length > 0) {
    actualSleeps.forEach((sleep, i) => {
      const start = dayjs.tz(sleep.start, VIETNAM_TZ).format('HH:mm');
      const end = sleep.end ? dayjs.tz(sleep.end, VIETNAM_TZ).format('HH:mm') : 'đang ngủ';
      const duration = sleep.durationMinutes 
        ? `${Math.floor(sleep.durationMinutes/60)}h${sleep.durationMinutes%60}p`
        : '';
      lines.push(`${i + 1}. ${start} - ${end} ${duration}`);
    });
  } else {
    lines.push('Chưa có giấc ngủ nào được ghi nhận');
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('💡 Quên ghi nhận? Bấm "Sửa giờ ngủ"');
  
  const editKeyboard = buildInlineKeyboard([
    [
      { text: '✏️ Sửa giờ ngủ', callback_data: 'routine_edit_sleep' },
      { text: '🔙 Quay lại', callback_data: 'routine_back' }
    ]
  ]);
  
  await safeSendMessage(chatId, lines.join('\n'), editKeyboard);
};

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
    
    // Xử lý input sửa giờ
    const state = getState(chatId);
    
    if (state?.type === 'edit_feed_time') {
      clearState(chatId);
      // Format: HH:mm hoặc HH:mm 150ml
      const parts = text.split(' ');
      const timeMatch = parts[0].match(/^(\d{1,2}):(\d{2})$/);
      
      if (!timeMatch) {
        await safeSendMessage(chatId, '❌ Sai định dạng. Nhập: HH:mm hoặc HH:mm 150ml');
        return;
      }
      
      const newTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      const amount = parts[1] ? parseInt(parts[1]) : 150;
      
      await editActivityTime(chatId, 'feeding', state.oldTime, newTime, amount);
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận bữa ăn lúc ${newTime}${amount ? ` (${amount}ml)` : ''}`,
        routineInlineKeyboard
      );
      return;
    }
    
    if (state?.type === 'edit_sleep_time') {
      clearState(chatId);
      const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
      
      if (!timeMatch) {
        await safeSendMessage(chatId, '❌ Sai định dạng. Nhập: HH:mm (ví dụ: 09:30)');
        return;
      }
      
      const newTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      await editActivityTime(chatId, 'sleep', state.oldTime, newTime);
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận giấc ngủ bắt đầu lúc ${newTime}`,
        routineInlineKeyboard
      );
      return;
    }
    
    if (state?.type === 'confirm_missed_feed') {
      clearState(chatId);
      const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
      
      if (!timeMatch) {
        await safeSendMessage(chatId, '❌ Sai định dạng. Nhập: HH:mm');
        return;
      }
      
      const newTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      await editActivityTime(chatId, 'feeding', null, newTime, state.amount || 150);
      await safeSendMessage(
        chatId,
        `✅ Đã cập nhật! Bé ăn lúc ${newTime}`,
        mainKeyboard
      );
      return;
    }
    
    if (state?.type === 'confirm_missed_sleep') {
      clearState(chatId);
      const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
      
      if (!timeMatch) {
        await safeSendMessage(chatId, '❌ Sai định dạng. Nhập: HH:mm');
        return;
      }
      
      const newTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      await editActivityTime(chatId, 'sleep', null, newTime);
      await safeSendMessage(
        chatId,
        `✅ Đã cập nhật! Bé ngủ từ lúc ${newTime}`,
        mainKeyboard
      );
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
    
    if (query.data === 'routine_edit_feed') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'edit_feed_time' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ ăn thực tế:\n\n' +
        'Định dạng: HH:mm hoặc HH:mm SỐml\n\n' +
        'Ví dụ:\n' +
        '• 09:30\n' +
        '• 09:30 150ml\n' +
        '• 14:00 180ml'
      );
      return;
    }
    
    if (query.data === 'routine_edit_sleep') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'edit_sleep_time' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ bé bắt đầu ngủ:\n\n' +
        'Định dạng: HH:mm\n\n' +
        'Ví dụ: 09:30'
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
      await showRoutineMenu(chatId);
      return;
    }
    
    // Xác nhận bỏ lỡ
    if (query.data === 'missed_feed_yes') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'confirm_missed_feed', amount: 150 });
      await safeSendMessage(chatId, '🍼 Bé ăn lúc mấy giờ?\n\nNhập: HH:mm (ví dụ: 09:30)');
      return;
    }
    
    if (query.data === 'missed_feed_no') {
      await bot.answerCallbackQuery(query.id, { text: 'OK, em sẽ không hỏi lại nữa!' });
      return;
    }
    
    if (query.data === 'missed_sleep_yes') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'confirm_missed_sleep' });
      await safeSendMessage(chatId, '😴 Bé ngủ từ lúc mấy giờ?\n\nNhập: HH:mm (ví dụ: 09:30)');
      return;
    }
    
    if (query.data === 'missed_sleep_no') {
      await bot.answerCallbackQuery(query.id, { text: 'OK, em sẽ không hỏi lại nữa!' });
      return;
    }
  });
};

// Export để sử dụng trong jobs
export { showRoutineMenu, showFeedingSchedule, showSleepSchedule, checkMissedActivities, markAsReminded };
export default registerRoutineHandler;

