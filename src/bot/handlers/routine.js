import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { bot, safeSendMessage } from '../index.js';
import { ChatProfile, Feeding, SleepSession, DailyRoutine } from '../../database/models/index.js';
import { routineInlineKeyboard, buildInlineKeyboard, mainKeyboard } from '../keyboard.js';
import { generateDailyRoutine, getScheduleByAge } from '../../services/routineService.js';
import { setMilkReminder } from '../../services/reminderService.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';
import { formatAge } from '../../utils/formatters.js';
import { sleepSessionTracker } from './sleep.js';
import { CONSTANTS } from '../../config/index.js';
import { getGroupChatIds, getPrimaryChatId, notifySyncMembers } from './sync.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Lấy thời gian thức khuyến nghị theo độ tuổi (phút)
 * Dựa trên khuyến nghị của các chuyên gia
 */
const getRecommendedAwakeTime = (ageMonths) => {
  if (ageMonths < 1) return { min: 30, max: 60 }; // 0-1 tháng: 30-60 phút
  if (ageMonths < 2) return { min: 45, max: 75 }; // 1-2 tháng: 45-75 phút
  if (ageMonths < 3) return { min: 60, max: 90 }; // 2-3 tháng: 1-1.5h
  if (ageMonths < 4) return { min: 75, max: 120 }; // 3-4 tháng: 1.25-2h
  if (ageMonths < 6) return { min: 90, max: 150 }; // 4-6 tháng: 1.5-2.5h
  if (ageMonths < 9) return { min: 120, max: 180 }; // 6-9 tháng: 2-3h
  if (ageMonths < 12) return { min: 150, max: 240 }; // 9-12 tháng: 2.5-4h
  if (ageMonths < 18) return { min: 180, max: 300 }; // 12-18 tháng: 3-5h
  if (ageMonths < 24) return { min: 240, max: 360 }; // 18-24 tháng: 4-6h
  return { min: 300, max: 420 }; // 24+ tháng: 5-7h
};

/**
 * Lấy thời gian ngủ nap khuyến nghị theo độ tuổi (phút)
 * Dựa trên khuyến nghị của các chuyên gia
 */
const getRecommendedNapDuration = (ageMonths) => {
  if (ageMonths < 2) return { min: 20, max: 120 }; // 20p-2h
  if (ageMonths < 3) return { min: 30, max: 120 }; // 30p-2h
  if (ageMonths < 6) return { min: 45, max: 120 }; // 45p-2h
  if (ageMonths < 9) return { min: 60, max: 120 }; // 1-2h
  if (ageMonths < 12) return { min: 60, max: 120 }; // 1-2h
  if (ageMonths < 18) return { min: 60, max: 150 }; // 1-2.5h
  return { min: 60, max: 120 }; // 1-2h
};

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
 * Gửi thông báo nhắc cữ ăn cho tất cả thành viên trong nhóm
 */
const sendMilkReminderToGroup = async (chatId, message) => {
  const groupChatIds = await getGroupChatIds(chatId);
  for (const memberId of groupChatIds) {
    await safeSendMessage(memberId, message, mainKeyboard);
  }
};

/**
 * Đặt lại toàn bộ nhắc nhở pha sữa dựa trên cữ ăn gần nhất
 */
const scheduleMilkReminderAfterFeed = async (chatId) => {
  const primaryChatId = await getPrimaryChatId(chatId);
  const lastFeed = await Feeding.findOne({ chatId: primaryChatId }).sort({ recordedAt: -1 });
  if (!lastFeed) return;

  setMilkReminder(primaryChatId, lastFeed.recordedAt, (message) => {
    sendMilkReminderToGroup(chatId, message).catch((err) => {
      console.error('[Routine] Error sending milk reminder:', err);
    });
  });
};

/**
 * Hiển thị menu lịch ăn ngủ với thông tin tổng quát
 */
const showRoutineMenu = async (chatId) => {
  // Lấy tất cả chatId trong nhóm
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  
  const profile = await ChatProfile.findOne({ chatId: { $in: groupChatIds }, dateOfBirth: { $exists: true } });
  
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
  
  // Lấy thông tin ăn gần nhất từ cả nhóm
  const todayStart = now.startOf('day').toDate();
  const lastFeed = await Feeding.findOne({
    chatId: { $in: groupChatIds },
    recordedAt: { $gte: todayStart }
  }).sort({ recordedAt: -1 });
  
  // Lấy thông tin ngủ gần nhất từ cả nhóm
  const lastSleep = await SleepSession.findOne({
    chatId: { $in: groupChatIds },
    start: { $gte: todayStart }
  }).sort({ start: -1 });
  
  // Kiểm tra trạng thái ngủ hiện tại (dùng primaryChatId)
  const isSleeping = sleepSessionTracker.has(primaryChatId);
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '📅 LỊCH ĂN NGỦ HÔM NAY',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `👶 Tuổi bé: ${ageText}`,
    `📅 ${now.format('DD/MM/YYYY')} • ⏰ ${now.format('HH:mm')}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '🍼 THÔNG TIN ĂN',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];
  
  // Thông tin ăn
  if (lastFeed) {
    const feedTime = dayjs.tz(lastFeed.recordedAt, VIETNAM_TZ);
    const feedTimeStr = feedTime.format('HH:mm');
    const minutesSince = Math.round((now.toDate().getTime() - feedTime.toDate().getTime()) / 60000);
    const hoursSince = Math.floor(minutesSince / 60);
    const minsSince = minutesSince % 60;
    
    let sinceStr;
    if (hoursSince > 0) {
      sinceStr = `${hoursSince}h${minsSince > 0 ? `${minsSince}p` : ''} trước`;
    } else {
      sinceStr = `${minsSince}p trước`;
    }
    
    // Tính cữ tiếp theo
    const nextFeedTime = feedTime.add(schedule.feedingIntervalHours, 'hour');
    const minutesUntil = Math.round((nextFeedTime.toDate().getTime() - now.toDate().getTime()) / 60000);
    const hoursUntil = Math.floor(minutesUntil / 60);
    const minsUntil = minutesUntil % 60;
    
    let untilStr;
    if (minutesUntil <= 0) {
      untilStr = '⏰ Đã đến giờ ăn!';
    } else if (hoursUntil > 0) {
      untilStr = `còn ${hoursUntil}h${minsUntil > 0 ? `${minsUntil}p` : ''}`;
    } else {
      untilStr = `còn ${minsUntil}p`;
    }
    
    lines.push(`✅ Vừa ăn: ${feedTimeStr} (${lastFeed.amountMl}ml)`);
    lines.push(`   └─ ${sinceStr}`);
    lines.push('');
    lines.push(`⏳ Cữ tiếp theo: ${nextFeedTime.format('HH:mm')}`);
    lines.push(`   └─ ${untilStr}`);
  } else {
    lines.push('📋 Chưa có cữ ăn hôm nay');
    lines.push('');
    lines.push(`💡 Khuyến nghị: mỗi ${schedule.feedingIntervalHours}h`);
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('😴 THÔNG TIN NGỦ');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  
  // Lấy thời gian khuyến nghị theo tuổi
  const awakeTimeRec = getRecommendedAwakeTime(ageMonths);
  const napDurationRec = getRecommendedNapDuration(ageMonths);
  const avgNapMins = Math.round((napDurationRec.min + napDurationRec.max) / 2);
  const avgAwakeTime = Math.round((awakeTimeRec.min + awakeTimeRec.max) / 2);
  
  // Thông tin ngủ
  if (isSleeping) {
    // Lấy startTime từ primaryChatId thay vì chatId
    const startTime = sleepSessionTracker.get(primaryChatId);
    if (startTime) {
      const startStr = dayjs.tz(startTime, VIETNAM_TZ).format('HH:mm');
      const elapsed = Math.round((now.toDate().getTime() - startTime.getTime()) / 60000);
      const elapsedHours = Math.floor(elapsed / 60);
      const elapsedMins = elapsed % 60;
      const elapsedStr = elapsedHours > 0 
        ? `${elapsedHours}h${elapsedMins > 0 ? `${elapsedMins}p` : ''}`
        : `${elapsedMins}p`;
      
      // Tính dự kiến dậy
      const estimatedWake = dayjs.tz(startTime, VIETNAM_TZ).add(avgNapMins, 'minute');
      const estimatedWakeStr = estimatedWake.format('HH:mm');
      const remainingMins = Math.max(0, avgNapMins - elapsed);
      const remainingStr = remainingMins > 0 ? `còn ~${remainingMins}p` : 'có thể dậy';
      
      lines.push('🟢 ĐANG NGỦ');
      lines.push(`   └─ Bắt đầu: ${startStr}`);
      lines.push(`   └─ Đã ngủ: ${elapsedStr}`);
      lines.push('');
      lines.push(`💭 Dự kiến dậy: ~${estimatedWakeStr}`);
      lines.push(`   └─ ${remainingStr}`);
      lines.push(`   └─ Khuyến nghị: ${napDurationRec.min}-${napDurationRec.max}p`);
    } else {
      lines.push('🟢 ĐANG NGỦ');
      lines.push(`   └─ (Không tìm thấy thông tin bắt đầu)`);
    }
  } else {
    lines.push('⚪ ĐANG THỨC');
    
    // Lấy giấc ngủ gần nhất ĐÃ HOÀN THÀNH (có end)
    const lastCompletedSleep = await SleepSession.findOne({
      chatId: { $in: groupChatIds },
      end: { $exists: true, $ne: null }
    }).sort({ end: -1 });
    
    if (lastCompletedSleep && lastCompletedSleep.end) {
      const sleepEnd = dayjs.tz(lastCompletedSleep.end, VIETNAM_TZ);
      const sleepEndStr = sleepEnd.format('HH:mm');
      const minutesSince = Math.round((now.toDate().getTime() - sleepEnd.toDate().getTime()) / 60000);
      const hoursSince = Math.floor(minutesSince / 60);
      const minsSince = minutesSince % 60;
      
      let sinceStr;
      if (hoursSince > 0) {
        sinceStr = `${hoursSince}h${minsSince > 0 ? `${minsSince}p` : ''} trước`;
      } else {
        sinceStr = `${minsSince}p trước`;
      }
      
      const durationHours = Math.floor(lastCompletedSleep.durationMinutes / 60);
      const durationMins = lastCompletedSleep.durationMinutes % 60;
      const durationStr = durationHours > 0 
        ? `${durationHours}h${durationMins > 0 ? `${durationMins}p` : ''}`
        : `${durationMins}p`;
      
      lines.push(`   └─ Giấc gần nhất: ${durationStr} (dậy ${sleepEndStr})`);
      lines.push(`   └─ Đã thức: ${sinceStr}`);
      
      // Tính giờ ngủ tiếp theo khuyến nghị
      const nextSleepTime = sleepEnd.add(avgAwakeTime, 'minute');
      const nextSleepStr = nextSleepTime.format('HH:mm');
      const minsUntilSleep = Math.round((nextSleepTime.toDate().getTime() - now.toDate().getTime()) / 60000);
      
      lines.push('');
      if (minsUntilSleep > 0) {
        lines.push(`⏰ Nên cho ngủ: ~${nextSleepStr}`);
        lines.push(`   └─ còn ${minsUntilSleep}p nữa`);
      } else {
        lines.push(`⚠️ ĐÃ QUÁ GIỜ NGỦ!`);
        lines.push(`   └─ Nên cho bé ngủ ngay`);
      }
      lines.push(`   └─ Khuyến nghị thức: ${awakeTimeRec.min}-${awakeTimeRec.max}p`);
    } else {
      lines.push('   └─ Chưa có giấc ngủ hôm nay');
      lines.push(`   └─ Khuyến nghị thức: ${awakeTimeRec.min}-${awakeTimeRec.max}p`);
    }
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('💡 Bấm để xem chi tiết hoặc chọn hành động:');
  
  // Tạo inline keyboard với các liên kết
  const routineButtons = [
    [
      { text: '🍼 Xem lịch ăn', callback_data: 'routine_feeding' },
      { text: '😴 Xem lịch ngủ', callback_data: 'routine_sleep' }
    ],
    [
      { text: isSleeping ? '⏹️ Bé đã dậy' : '▶️ Cho bé ngủ', callback_data: isSleeping ? 'sleep_confirm_stop' : 'sleep_confirm_start' }
    ],
    [
      { text: '🍼 Ghi cữ ăn', callback_data: 'go_milk' },
      { text: '😴 Nhật ký ngủ', callback_data: 'go_sleep' }
    ],
    [
      { text: '🔙 Menu chính', callback_data: 'go_main' }
    ]
  ];
  
  await safeSendMessage(chatId, lines.join('\n'), buildInlineKeyboard(routineButtons));
};

/**
 * Tính lịch ăn dự kiến dựa trên cữ ăn gần nhất
 */
const calculateNextFeedings = (lastFeedTime, intervalHours = 3.5, count = 5) => {
  const schedule = [];
  let nextTime = dayjs.tz(lastFeedTime, VIETNAM_TZ);
  
  for (let i = 0; i < count; i++) {
    nextTime = nextTime.add(intervalHours, 'hour');
    schedule.push({
      time: nextTime.format('HH:mm'),
      datetime: nextTime
    });
  }
  
  return schedule;
};

/**
 * Hiển thị lịch ăn hôm nay
 * Hiện: đã ăn (✅ với button sửa) + tương lai dựa trên cữ gần nhất (⏳)
 */
const showFeedingSchedule = async (chatId) => {
  // Lấy tất cả chatId trong nhóm
  const groupChatIds = await getGroupChatIds(chatId);
  
  const profile = await ChatProfile.findOne({ chatId: { $in: groupChatIds }, dateOfBirth: { $exists: true } });
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  const currentTime = now.format('HH:mm');
  
  // Lấy thông tin ăn thực tế hôm nay từ cả nhóm
  const todayStart = now.startOf('day').toDate();
  const actualFeeds = await Feeding.find({
    chatId: { $in: groupChatIds },
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
  
  // Tạo buttons cho các cữ đã ăn (để sửa)
  const feedButtons = [];
  
  // Hiển thị các cữ đã ăn (thực tế) với button sửa
  if (actualFeeds.length > 0) {
    lines.push('✅ ĐÃ ĂN (bấm để sửa):');
    lines.push('');
    
    const feedRow = [];
    actualFeeds.forEach((feed, i) => {
      const time = dayjs.tz(feed.recordedAt, VIETNAM_TZ).format('HH:mm');
      lines.push(`   ${i + 1}. ✅ ${time} - ${feed.amountMl}ml`);
      
      // Tạo button cho mỗi cữ ăn (tối đa 3 button/hàng)
      feedRow.push({
        text: `✏️ ${time}`,
        callback_data: `routine_edit_feed_${feed._id}`
      });
      
      if (feedRow.length === 3) {
        feedButtons.push([...feedRow]);
        feedRow.length = 0;
      }
    });
    
    if (feedRow.length > 0) {
      feedButtons.push([...feedRow]);
    }
    
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }
  
  // Tính lịch dự kiến dựa trên cữ ăn gần nhất
  if (actualFeeds.length > 0) {
    const lastFeed = actualFeeds[actualFeeds.length - 1];
    const lastFeedTime = dayjs.tz(lastFeed.recordedAt, VIETNAM_TZ);
    
    // Lấy interval từ độ tuổi bé
    let intervalHours = 3.5;
    if (profile?.dateOfBirth) {
      const ageMonths = now.diff(dayjs.tz(profile.dateOfBirth, VIETNAM_TZ), 'month');
      const schedule = getScheduleByAge(ageMonths);
      intervalHours = schedule.feedingIntervalHours;
    }
    
    const nextFeedings = calculateNextFeedings(lastFeedTime.toDate(), intervalHours, 4);
    const futureFeedings = nextFeedings.filter(f => f.time > currentTime);
    
    if (futureFeedings.length > 0) {
      lines.push('⏳ DỰ KIẾN (tính từ cữ gần nhất):');
      lines.push('');
      futureFeedings.forEach((feed, i) => {
        lines.push(`   ${i + 1}. ⏳ ${feed.time}`);
      });
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
    }
  } else {
    // Chưa có cữ ăn nào hôm nay
    lines.push('📋 Chưa có cữ ăn nào hôm nay');
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }
  
  // Lịch khuyến nghị theo độ tuổi
  if (profile?.dateOfBirth) {
    const ageMonths = now.diff(dayjs.tz(profile.dateOfBirth, VIETNAM_TZ), 'month');
    const schedule = getScheduleByAge(ageMonths);
    
    lines.push('📋 LỊCH KHUYẾN NGHỊ THEO TUỔI:');
    lines.push(`   └─ Khoảng cách: mỗi ${schedule.feedingIntervalHours}h`);
    lines.push('');
    lines.push('   🕐 Khung giờ gợi ý:');
    schedule.feeds.forEach((feedTime, i) => {
      lines.push(`      ${i + 1}. ${feedTime}`);
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
  lines.push('💡 Bấm nút bên dưới để thêm hoặc sửa');
  
  // Thêm buttons
  feedButtons.push([
    { text: '➕ Thêm cữ ăn', callback_data: 'routine_add_feed' },
    { text: '🔙 Quay lại', callback_data: 'routine_back' }
  ]);
  feedButtons.push([
    { text: '😴 Nhật ký ngủ', callback_data: 'go_sleep' },
    { text: '😴 Xem lịch ngủ', callback_data: 'routine_sleep' }
  ]);
  
  await safeSendMessage(chatId, lines.join('\n'), buildInlineKeyboard(feedButtons));
};

/**
 * Hiển thị lịch ngủ hôm nay
 * Hiện: đã ngủ (✅ với button sửa) + khuyến nghị theo chuyên gia
 */
const showSleepSchedule = async (chatId) => {
  // Lấy tất cả chatId trong nhóm
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  
  const profile = await ChatProfile.findOne({ chatId: { $in: groupChatIds }, dateOfBirth: { $exists: true } });
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  const currentTime = now.format('HH:mm');
  
  // Tính tuổi bé
  const ageMonths = profile?.dateOfBirth 
    ? now.diff(dayjs.tz(profile.dateOfBirth, VIETNAM_TZ), 'month')
    : 6;
  
  // Lấy thông tin ngủ thực tế hôm nay từ cả nhóm
  const todayStart = now.startOf('day').toDate();
  const actualSleeps = await SleepSession.find({
    chatId: { $in: groupChatIds },
    start: { $gte: todayStart }
  }).sort({ start: 1 });
  
  // Lấy giấc ngủ gần nhất đã hoàn thành
  const lastCompletedSleep = await SleepSession.findOne({
    chatId: { $in: groupChatIds },
    end: { $exists: true, $ne: null }
  }).sort({ end: -1 });
  
  // Kiểm tra trạng thái ngủ hiện tại (dùng primaryChatId)
  const isSleeping = sleepSessionTracker.has(primaryChatId);
  
  // Lấy thông tin khuyến nghị theo tuổi
  const awakeTimeRec = getRecommendedAwakeTime(ageMonths);
  const napDurationRec = getRecommendedNapDuration(ageMonths);
  const avgAwakeTime = Math.round((awakeTimeRec.min + awakeTimeRec.max) / 2);
  const avgNapMins = Math.round((napDurationRec.min + napDurationRec.max) / 2);
  
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
  
  // Tạo buttons cho các giấc đã ngủ (để sửa)
  const sleepButtons = [];
  
  // ========== KHUYẾN NGHỊ TỪ CHUYÊN GIA ==========
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('💡 KHUYẾN NGHỊ (theo chuyên gia)');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`📊 Tuổi: ${ageMonths} tháng`);
  lines.push(`   └─ Thức: ${awakeTimeRec.min}-${awakeTimeRec.max}p giữa các giấc`);
  lines.push(`   └─ Ngủ nap: ${napDurationRec.min}-${napDurationRec.max}p mỗi giấc`);
  lines.push('');
  
  if (isSleeping) {
    // BÉ ĐANG NGỦ - tính dự kiến dậy
    const startTime = sleepSessionTracker.get(primaryChatId);
    if (startTime) {
      const startStr = dayjs.tz(startTime, VIETNAM_TZ).format('HH:mm');
      const elapsed = Math.round((now.toDate().getTime() - startTime.getTime()) / 60000);
      const estimatedWake = dayjs.tz(startTime, VIETNAM_TZ).add(avgNapMins, 'minute');
      const estimatedWakeStr = estimatedWake.format('HH:mm');
      const remainingMins = Math.max(0, avgNapMins - elapsed);
      
      lines.push('🔮 LỘ TRÌNH DỰ KIẾN:');
      lines.push(`   1. 💤 Đang ngủ (từ ${startStr})`);
      lines.push(`      └─ Đã ngủ: ${elapsed}p`);
      lines.push(`   2. 🌅 Dự kiến dậy: ~${estimatedWakeStr}`);
      lines.push(`      └─ ${remainingMins > 0 ? `còn ~${remainingMins}p` : 'có thể dậy'}`);
      
      // Tính giờ ngủ tiếp theo sau khi dậy
      const nextSleepTime = estimatedWake.add(avgAwakeTime, 'minute');
      lines.push(`   3. 😴 Giấc tiếp: ~${nextSleepTime.format('HH:mm')}`);
    }
  } else if (lastCompletedSleep && lastCompletedSleep.end) {
    // BÉ ĐANG THỨC - tính dựa trên giấc ngủ gần nhất
    const lastWakeTime = dayjs.tz(lastCompletedSleep.end, VIETNAM_TZ);
    const lastWakeStr = lastWakeTime.format('HH:mm');
    const awakeMinutes = Math.round((now.toDate().getTime() - lastWakeTime.toDate().getTime()) / 60000);
    
    // Tính giờ ngủ tiếp theo
    const nextSleepTime = lastWakeTime.add(avgAwakeTime, 'minute');
    const nextSleepStr = nextSleepTime.format('HH:mm');
    const minsUntilSleep = Math.round((nextSleepTime.toDate().getTime() - now.toDate().getTime()) / 60000);
    
    // Tính giờ dậy dự kiến
    const nextWakeTime = nextSleepTime.add(avgNapMins, 'minute');
    const nextWakeStr = nextWakeTime.format('HH:mm');
    
    // Tính giấc ngủ tiếp theo sau đó
    const afterNextSleepTime = nextWakeTime.add(avgAwakeTime, 'minute');
    const afterNextSleepStr = afterNextSleepTime.format('HH:mm');
    
    lines.push('🔮 LỘ TRÌNH DỰ KIẾN:');
    lines.push(`   1. 🌅 Dậy lúc ${lastWakeStr} (đã thức ${awakeMinutes}p)`);
    
    if (minsUntilSleep > 0) {
      lines.push(`   2. 😴 Nên cho ngủ: ~${nextSleepStr}`);
      lines.push(`      └─ còn ${minsUntilSleep}p nữa`);
    } else {
      lines.push(`   2. ⚠️ ĐÃ QUÁ GIỜ NGỦ!`);
      lines.push(`      └─ Nên cho bé ngủ ngay`);
    }
    
    lines.push(`   3. 🌅 Dự kiến dậy: ~${nextWakeStr}`);
    lines.push(`   4. 😴 Giấc tiếp: ~${afterNextSleepStr}`);
    
    // Cảnh báo nếu quá giờ
    if (minsUntilSleep <= 0) {
      lines.push('');
      lines.push('⚠️ BÉ ĐÃ THỨC QUÁ LÂU!');
      lines.push(`   └─ Thức ${awakeMinutes}p > Khuyến nghị ${awakeTimeRec.max}p`);
    } else if (minsUntilSleep <= 15) {
      lines.push('');
      lines.push('⏰ SẮP ĐẾN GIỜ NGỦ!');
    }
  } else {
    lines.push('📝 Chưa có giấc ngủ nào được ghi nhận hôm nay');
    lines.push('   └─ Hãy bấm "Thêm giấc ngủ" để bắt đầu theo dõi');
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  
  // ========== CÁC GIẤC ĐÃ NGỦ ==========
  if (actualSleeps.length > 0) {
    lines.push('✅ ĐÃ NGỦ HÔM NAY (bấm để sửa):');
    lines.push('');
    
    const sleepRow = [];
    actualSleeps.forEach((sleep, i) => {
      const start = dayjs.tz(sleep.start, VIETNAM_TZ).format('HH:mm');
      const end = sleep.end ? dayjs.tz(sleep.end, VIETNAM_TZ).format('HH:mm') : 'đang ngủ';
      const duration = sleep.durationMinutes 
        ? ` (${Math.floor(sleep.durationMinutes/60)}h${sleep.durationMinutes%60}p)`
        : '';
      lines.push(`   ${i + 1}. ✅ ${start} → ${end}${duration}`);
      
      // Tạo button cho mỗi giấc ngủ (tối đa 3 button/hàng)
      if (sleep.end) { // Chỉ cho sửa giấc đã hoàn thành
        sleepRow.push({
          text: `✏️ ${start}`,
          callback_data: `routine_edit_sleep_${sleep._id}`
        });
        
        if (sleepRow.length === 3) {
          sleepButtons.push([...sleepRow]);
          sleepRow.length = 0;
        }
      }
    });
    
    if (sleepRow.length > 0) {
      sleepButtons.push([...sleepRow]);
    }
    
    lines.push('');
    
    // Tổng kết
    const totalMinutes = actualSleeps.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    lines.push(`📊 Tổng: ${actualSleeps.length} giấc (${hours}h${mins}p)`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }
  
  // ========== LỊCH KHUYẾN NGHỊ THEO TUỔI ==========
  if (profile?.dateOfBirth) {
    const schedule = getScheduleByAge(ageMonths);
    
    lines.push('📋 THÔNG TIN THAM KHẢO:');
    lines.push(`   └─ Tổng ngủ/ngày: ${schedule.totalSleep}`);
    lines.push(`   └─ Ngủ đêm: ${schedule.nightSleep}`);
    lines.push(`   └─ Giấc ngày: ${schedule.naps}`);
    lines.push('');
    
    // Hiển thị hoạt động khuyến nghị
    if (schedule.activities && schedule.activities.length > 0) {
      lines.push('🎯 HOẠT ĐỘNG GỢI Ý:');
      schedule.activities.forEach((activity, i) => {
        const isPast = activity.start < currentTime;
        const icon = isPast ? '✓' : '⏳';
        const durationStr = activity.duration >= 60 
          ? `${Math.floor(activity.duration/60)}h${activity.duration%60 > 0 ? (activity.duration%60) + 'p' : ''}`
          : `${activity.duration}p`;
        lines.push(`   ${icon} ${activity.start} - ${activity.name} (~${durationStr})`);
      });
      lines.push('');
    }
  }
  
  // Thêm nút sửa giờ ngủ hiện tại nếu bé đang ngủ
  if (isSleeping) {
    sleepButtons.push([
      { text: '⏹️ Bé đã dậy', callback_data: 'sleep_confirm_stop' },
      { text: '✏️ Sửa giờ ngủ', callback_data: 'routine_edit_current_sleep' }
    ]);
  } else {
    sleepButtons.push([
      { text: '▶️ Cho bé ngủ', callback_data: 'sleep_confirm_start' }
    ]);
  }
  
  // Thêm buttons điều hướng
  sleepButtons.push([
    { text: '➕ Thêm giấc ngủ', callback_data: 'routine_add_sleep' },
    { text: '🔙 Quay lại', callback_data: 'routine_back' }
  ]);
  sleepButtons.push([
    { text: '🍼 Ghi cữ ăn', callback_data: 'go_milk' },
    { text: '🍼 Xem lịch ăn', callback_data: 'routine_feeding' }
  ]);
  
  await safeSendMessage(chatId, lines.join('\n'), buildInlineKeyboard(sleepButtons));
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
    
    // Nhập giờ ăn thủ công (thêm mới hoặc sửa)
    if (state?.type === 'routine_feed_input_time') {
      const timeStr = parseSimpleTime(text);
      if (!timeStr) {
        await safeSendMessage(
          chatId, 
          '❌ Không hiểu!\n\nNhập lại:\n• 9 → 09:00\n• 9 30 → 09:30'
        );
        return;
      }
      
      // Nếu đang sửa cữ ăn cũ (có feedId và oldAmount)
      if (state.feedId && state.oldAmount) {
        clearState(chatId);
        const now = dayjs.tz(dayjs(), VIETNAM_TZ);
        const newRecordedAt = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
        await Feeding.findByIdAndUpdate(state.feedId, { recordedAt: newRecordedAt });
        
        await safeSendMessage(
          chatId,
          `✅ Đã sửa!\n\n🍼 ${state.oldAmount}ml lúc ${timeStr}`,
          routineInlineKeyboard
        );
        await showFeedingSchedule(chatId);
        await scheduleMilkReminderAfterFeed(chatId);
        return;
      }
      
      // Thêm mới - chuyển sang chọn ml
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
      const feedId = state.feedId;
      clearState(chatId);
      
      // Lấy primaryChatId để lưu dữ liệu
      const groupChatIds = await getGroupChatIds(chatId);
      const primaryChatId = groupChatIds[0];
      
      if (feedId) {
        // Đang sửa cữ ăn cũ
        const now = dayjs.tz(dayjs(), VIETNAM_TZ);
        const recordedAt = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
        await Feeding.findByIdAndUpdate(feedId, { recordedAt, amountMl: amount });
        await safeSendMessage(
          chatId,
          `✅ Đã sửa!\n\n🍼 ${amount}ml lúc ${timeStr}`,
          routineInlineKeyboard
        );
        await notifySyncMembers(chatId, `✏️ Đã sửa cữ ăn: ${amount}ml lúc ${timeStr}`);
      } else {
        // Thêm mới
        const now = dayjs.tz(dayjs(), VIETNAM_TZ);
        const recordedAt = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
        await Feeding.create({ chatId: primaryChatId, amountMl: amount, recordedAt });
        await safeSendMessage(
          chatId,
          `✅ Đã ghi nhận!\n\n🍼 ${amount}ml lúc ${timeStr}`,
          routineInlineKeyboard
        );
        await notifySyncMembers(chatId, `🍼 Ghi nhận cữ ăn: ${amount}ml lúc ${timeStr}`);
      }
      // Hiển thị lại lịch ăn
      await showFeedingSchedule(chatId);
      await scheduleMilkReminderAfterFeed(chatId);
      return;
    }
    
    // Nhập giờ cho giấc ngủ hiện tại (bé đang ngủ)
    if (state?.type === 'routine_current_sleep_input_time') {
      const timeStr = parseSimpleTime(text);
      if (!timeStr) {
        await safeSendMessage(
          chatId, 
          '❌ Không hiểu!\n\nNhập lại:\n• 9 → 09:00\n• 9 30 → 09:30'
        );
        return;
      }
      clearState(chatId);
      
      // Lấy primaryChatId và cập nhật tracker
      const groupChatIds = await getGroupChatIds(chatId);
      const primaryChatId = groupChatIds[0];
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const newStartTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      sleepSessionTracker.set(primaryChatId, newStartTime);
      
      // Thông báo đến các thành viên khác
      await notifySyncMembers(chatId, `✏️ Đã sửa giờ bắt đầu ngủ thành ${timeStr}!`);
      
      await safeSendMessage(
        chatId,
        `✅ Đã sửa giờ bắt đầu ngủ thành ${timeStr}!`,
        routineInlineKeyboard
      );
      await showSleepSchedule(chatId);
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
      const sleepId = state.sleepId;
      clearState(chatId);
      
      // Lấy primaryChatId để lưu dữ liệu
      const groupChatIds = await getGroupChatIds(chatId);
      const primaryChatId = groupChatIds[0];
      
      // Lưu vào database
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const startTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      
      if (sleepId) {
        // Đang sửa giấc ngủ cũ
        const sleep = await SleepSession.findById(sleepId);
        if (sleep?.end) {
          const durationMinutes = Math.round((sleep.end.getTime() - startTime.getTime()) / 60000);
          await SleepSession.findByIdAndUpdate(sleepId, { start: startTime, durationMinutes });
        } else {
          await SleepSession.findByIdAndUpdate(sleepId, { start: startTime });
        }
        await safeSendMessage(
          chatId,
          `✅ Đã sửa!\n\n😴 Ngủ từ ${timeStr}`,
          routineInlineKeyboard
        );
        await notifySyncMembers(chatId, `✏️ Đã sửa giờ ngủ thành ${timeStr}`);
      } else {
        // Thêm mới - giả sử đã kết thúc (dùng giờ hiện tại làm giờ kết thúc)
        const durationMinutes = Math.round((now.toDate().getTime() - startTime.getTime()) / 60000);
        await SleepSession.create({
          chatId: primaryChatId,
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
        await notifySyncMembers(chatId, `😴 Ghi nhận giấc ngủ: ${timeStr} → ${now.format('HH:mm')} (${hours}h${mins}p)`);
      }
      // Hiển thị lại lịch ngủ
      await showSleepSchedule(chatId);
      return;
    }
    
    // ===== XỬ LÝ INPUT KHI QUÊN BỮA ĂN =====
    if (state?.type === 'missed_feed_input_time') {
      const timeStr = parseSimpleTime(text);
      if (!timeStr) {
        await safeSendMessage(chatId, '❌ Không hiểu!\n\nNhập lại:\n• 9 → 09:00\n• 9 30 → 09:30');
        return;
      }
      setState(chatId, { type: 'missed_feed_select_amount', timeStr });
      
      // Hiển thị keyboard chọn ml
      const amountButtons = [];
      for (let i = 0; i < MILK_AMOUNTS.length; i += 4) {
        const row = [];
        for (let j = i; j < i + 4 && j < MILK_AMOUNTS.length; j++) {
          row.push({ 
            text: `${MILK_AMOUNTS[j]}ml`, 
            callback_data: `missed_feed_amount_${MILK_AMOUNTS[j]}` 
          });
        }
        amountButtons.push(row);
      }
      amountButtons.push([{ text: '✏️ Nhập số khác', callback_data: 'missed_feed_custom_amount' }]);
      
      await safeSendMessage(
        chatId,
        `⏰ Giờ ăn: ${timeStr}\n\n👇 Bé ăn bao nhiêu ml?`,
        buildInlineKeyboard(amountButtons)
      );
      return;
    }
    
    if (state?.type === 'missed_feed_input_amount') {
      const amount = parseInt(text, 10);
      if (isNaN(amount) || amount <= 0) {
        await safeSendMessage(chatId, '❌ Số không hợp lệ! Nhập lại số ml (ví dụ: 160)');
        return;
      }
      const timeStr = state.timeStr;
      clearState(chatId);
      
      // Lấy primaryChatId để lưu dữ liệu
      const groupChatIds = await getGroupChatIds(chatId);
      const primaryChatId = groupChatIds[0];
      
      // Lưu vào database
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const recordedAt = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      await Feeding.create({ chatId: primaryChatId, amountMl: amount, recordedAt });
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận!\n\n🍼 ${amount}ml lúc ${timeStr}`,
        mainKeyboard
      );
      await notifySyncMembers(chatId, `🍼 Ghi nhận cữ ăn: ${amount}ml lúc ${timeStr}`);
      await scheduleMilkReminderAfterFeed(chatId);
      return;
    }
    
    // ===== XỬ LÝ INPUT KHI QUÊN GIẤC NGỦ =====
    if (state?.type === 'missed_sleep_input_start') {
      const timeStr = parseSimpleTime(text);
      if (!timeStr) {
        await safeSendMessage(chatId, '❌ Không hiểu!\n\nNhập lại:\n• 9 → 09:00\n• 9 30 → 09:30');
        return;
      }
      clearState(chatId);
      
      // Hỏi bé đã dậy chưa
      const sleepButtons = buildInlineKeyboard([
        [
          { text: '✅ Đã dậy rồi', callback_data: `missed_sleep_ended_${timeStr}` },
          { text: '😴 Vẫn đang ngủ', callback_data: `missed_sleep_ongoing_${timeStr}` }
        ]
      ]);
      
      await safeSendMessage(
        chatId,
        `⏰ Bé ngủ từ: ${timeStr}\n\n👇 Bé đã dậy chưa?`,
        sleepButtons
      );
      return;
    }
    
    if (state?.type === 'missed_sleep_input_end') {
      const timeStr = parseSimpleTime(text);
      if (!timeStr) {
        await safeSendMessage(chatId, '❌ Không hiểu!\n\nNhập lại:\n• 11 → 11:00\n• 11 30 → 11:30');
        return;
      }
      const startTimeStr = state.startTimeStr;
      clearState(chatId);
      
      // Lấy primaryChatId để lưu dữ liệu
      const groupChatIds = await getGroupChatIds(chatId);
      const primaryChatId = groupChatIds[0];
      
      // Lưu vào database
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const startTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${startTimeStr}`, VIETNAM_TZ).toDate();
      const endTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      
      if (durationMinutes <= 0) {
        await safeSendMessage(chatId, '❌ Giờ dậy phải sau giờ ngủ!', mainKeyboard);
        return;
      }
      
      await SleepSession.create({
        chatId: primaryChatId,
        start: startTime,
        end: endTime,
        durationMinutes
      });
      
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận!\n\n😴 Ngủ: ${startTimeStr} → ${timeStr}\n⏱️ Thời gian: ${hours}h${mins}p`,
        mainKeyboard
      );
      await notifySyncMembers(chatId, `😴 Ghi nhận giấc ngủ: ${startTimeStr} → ${timeStr} (${hours}h${mins}p)`);
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
    
    // ===== SỬA CỮ ĂN CỤ THỂ =====
    if (query.data.startsWith('routine_edit_feed_')) {
      const feedId = query.data.replace('routine_edit_feed_', '');
      await bot.answerCallbackQuery(query.id);
      
      // Lấy thông tin cữ ăn
      const feed = await Feeding.findById(feedId);
      if (!feed) {
        await safeSendMessage(chatId, '❌ Không tìm thấy cữ ăn này!', mainKeyboard);
        return;
      }
      
      const feedTime = dayjs.tz(feed.recordedAt, VIETNAM_TZ);
      const feedTimeStr = feedTime.format('HH:mm');
      
      // Tạo các button thời gian xung quanh giờ gốc
      const timeButtons = [];
      const baseMinutes = feedTime.hour() * 60 + feedTime.minute();
      
      // Tạo 6 mốc: -15, -10, -5, 0, +5, +10 phút
      const offsets = [-15, -10, -5, 0, 5, 10];
      const row1 = [];
      const row2 = [];
      
      offsets.forEach((offset, i) => {
        const newTime = feedTime.add(offset, 'minute').format('HH:mm');
        const btn = {
          text: offset === 0 ? `📍${newTime}` : newTime,
          callback_data: `routine_feed_edit_time_${feedId}_${newTime}`
        };
        if (i < 3) row1.push(btn);
        else row2.push(btn);
      });
      
      timeButtons.push(row1, row2);
      timeButtons.push([{ text: '✏️ Nhập giờ khác', callback_data: `routine_feed_edit_custom_${feedId}` }]);
      timeButtons.push([{ text: '🗑️ Xóa cữ này', callback_data: `routine_feed_delete_${feedId}` }]);
      timeButtons.push([{ text: '❌ Hủy', callback_data: 'routine_cancel_to_feed' }]);
      
      await safeSendMessage(
        chatId,
        `✏️ SỬA CỮ ĂN\n\n🍼 ${feed.amountMl}ml lúc ${feedTimeStr}\n\n👇 Chọn giờ mới:`,
        buildInlineKeyboard(timeButtons)
      );
      return;
    }
    
    // Chọn giờ mới cho cữ ăn cụ thể
    if (query.data.startsWith('routine_feed_edit_time_')) {
      const parts = query.data.replace('routine_feed_edit_time_', '').split('_');
      const feedId = parts[0];
      const newTimeStr = parts[1];
      
      await bot.answerCallbackQuery(query.id, { text: `⏰ ${newTimeStr}` });
      
      // Cập nhật database
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const newRecordedAt = dayjs.tz(`${now.format('YYYY-MM-DD')} ${newTimeStr}`, VIETNAM_TZ).toDate();
      await Feeding.findByIdAndUpdate(feedId, { recordedAt: newRecordedAt });
      
      await safeSendMessage(chatId, `✅ Đã sửa giờ ăn thành ${newTimeStr}!`);
      await showFeedingSchedule(chatId);
      await scheduleMilkReminderAfterFeed(chatId);
      return;
    }
    
    // Nhập giờ thủ công cho cữ ăn cụ thể
    if (query.data.startsWith('routine_feed_edit_custom_')) {
      const feedId = query.data.replace('routine_feed_edit_custom_', '');
      await bot.answerCallbackQuery(query.id);
      
      const feed = await Feeding.findById(feedId);
      setState(chatId, { type: 'routine_feed_input_time', feedId, oldAmount: feed?.amountMl });
      
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ mới:\n\n📝 Ví dụ:\n• 9 → 09:00\n• 9 30 → 09:30'
      );
      return;
    }
    
    // Xóa cữ ăn
    if (query.data.startsWith('routine_feed_delete_')) {
      const feedId = query.data.replace('routine_feed_delete_', '');
      await bot.answerCallbackQuery(query.id, { text: 'Đã xóa!' });
      await Feeding.findByIdAndDelete(feedId);
      await safeSendMessage(chatId, '✅ Đã xóa cữ ăn!');
      await showFeedingSchedule(chatId);
      await scheduleMilkReminderAfterFeed(chatId);
      return;
    }
    
    // ===== SỬA GIẤC NGỦ CỤ THỂ =====
    if (query.data.startsWith('routine_edit_sleep_')) {
      const sleepId = query.data.replace('routine_edit_sleep_', '');
      await bot.answerCallbackQuery(query.id);
      
      // Lấy thông tin giấc ngủ
      const sleep = await SleepSession.findById(sleepId);
      if (!sleep) {
        await safeSendMessage(chatId, '❌ Không tìm thấy giấc ngủ này!', mainKeyboard);
        return;
      }
      
      const sleepTime = dayjs.tz(sleep.start, VIETNAM_TZ);
      const sleepTimeStr = sleepTime.format('HH:mm');
      const endTimeStr = sleep.end ? dayjs.tz(sleep.end, VIETNAM_TZ).format('HH:mm') : 'đang ngủ';
      
      // Tạo các button thời gian xung quanh giờ gốc
      const timeButtons = [];
      const offsets = [-15, -10, -5, 0, 5, 10];
      const row1 = [];
      const row2 = [];
      
      offsets.forEach((offset, i) => {
        const newTime = sleepTime.add(offset, 'minute').format('HH:mm');
        const btn = {
          text: offset === 0 ? `📍${newTime}` : newTime,
          callback_data: `routine_sleep_edit_time_${sleepId}_${newTime}`
        };
        if (i < 3) row1.push(btn);
        else row2.push(btn);
      });
      
      timeButtons.push(row1, row2);
      timeButtons.push([{ text: '✏️ Nhập giờ khác', callback_data: `routine_sleep_edit_custom_${sleepId}` }]);
      timeButtons.push([{ text: '🗑️ Xóa giấc này', callback_data: `routine_sleep_delete_${sleepId}` }]);
      timeButtons.push([{ text: '❌ Hủy', callback_data: 'routine_cancel_to_sleep' }]);
      
      await safeSendMessage(
        chatId,
        `✏️ SỬA GIẤC NGỦ\n\n😴 ${sleepTimeStr} → ${endTimeStr}\n\n👇 Chọn giờ bắt đầu mới:`,
        buildInlineKeyboard(timeButtons)
      );
      return;
    }
    
    // Chọn giờ mới cho giấc ngủ cụ thể
    if (query.data.startsWith('routine_sleep_edit_time_')) {
      const parts = query.data.replace('routine_sleep_edit_time_', '').split('_');
      const sleepId = parts[0];
      const newTimeStr = parts[1];
      
      await bot.answerCallbackQuery(query.id, { text: `⏰ ${newTimeStr}` });
      
      // Cập nhật database
      const sleep = await SleepSession.findById(sleepId);
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const newStart = dayjs.tz(`${now.format('YYYY-MM-DD')} ${newTimeStr}`, VIETNAM_TZ).toDate();
      
      let update = { start: newStart };
      if (sleep?.end) {
        const durationMinutes = Math.round((sleep.end.getTime() - newStart.getTime()) / 60000);
        update.durationMinutes = durationMinutes;
      }
      
      await SleepSession.findByIdAndUpdate(sleepId, update);
      
      await safeSendMessage(chatId, `✅ Đã sửa giờ ngủ thành ${newTimeStr}!`);
      await showSleepSchedule(chatId);
      return;
    }
    
    // Nhập giờ thủ công cho giấc ngủ cụ thể
    if (query.data.startsWith('routine_sleep_edit_custom_')) {
      const sleepId = query.data.replace('routine_sleep_edit_custom_', '');
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'routine_sleep_input_time', sleepId });
      
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ bắt đầu ngủ mới:\n\n📝 Ví dụ:\n• 9 → 09:00\n• 9 30 → 09:30'
      );
      return;
    }
    
    // Xóa giấc ngủ
    if (query.data.startsWith('routine_sleep_delete_')) {
      const sleepId = query.data.replace('routine_sleep_delete_', '');
      await bot.answerCallbackQuery(query.id, { text: 'Đã xóa!' });
      await SleepSession.findByIdAndDelete(sleepId);
      await safeSendMessage(chatId, '✅ Đã xóa giấc ngủ!');
      await showSleepSchedule(chatId);
      return;
    }
    
    // ===== SỬA GIẤC NGỦ HIỆN TẠI (BÉ ĐANG NGỦ) =====
    if (query.data === 'routine_edit_current_sleep') {
      await bot.answerCallbackQuery(query.id);
      
      // Lấy giờ bắt đầu từ tracker
      const startTime = sleepSessionTracker.get(chatId);
      if (!startTime) {
        await safeSendMessage(chatId, '❌ Bé không đang ngủ!', mainKeyboard);
        return;
      }
      
      const sleepTime = dayjs.tz(startTime, VIETNAM_TZ);
      const sleepTimeStr = sleepTime.format('HH:mm');
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const elapsed = Math.round((now.toDate().getTime() - startTime.getTime()) / 60000);
      const elapsedStr = elapsed >= 60 
        ? `${Math.floor(elapsed/60)}h${elapsed%60}p`
        : `${elapsed}p`;
      
      // Tạo các button thời gian xung quanh giờ gốc
      const timeButtons = [];
      const offsets = [-30, -20, -15, -10, -5, 0];
      const row1 = [];
      const row2 = [];
      
      offsets.forEach((offset, i) => {
        const newTime = sleepTime.add(offset, 'minute').format('HH:mm');
        const btn = {
          text: offset === 0 ? `📍${newTime}` : newTime,
          callback_data: `routine_current_sleep_time_${newTime}`
        };
        if (i < 3) row1.push(btn);
        else row2.push(btn);
      });
      
      timeButtons.push(row1, row2);
      timeButtons.push([{ text: '✏️ Nhập giờ khác', callback_data: 'routine_current_sleep_custom' }]);
      timeButtons.push([{ text: '❌ Hủy', callback_data: 'routine_cancel_to_sleep' }]);
      
      await safeSendMessage(
        chatId,
        `✏️ SỬA GIỜ NGỦ HIỆN TẠI\n\n😴 Đang ngủ từ: ${sleepTimeStr}\n⏱️ Đã ngủ: ${elapsedStr}\n\n👇 Chọn giờ bắt đầu mới:`,
        buildInlineKeyboard(timeButtons)
      );
      return;
    }
    
    // Chọn giờ mới cho giấc ngủ hiện tại
    if (query.data.startsWith('routine_current_sleep_time_')) {
      const newTimeStr = query.data.replace('routine_current_sleep_time_', '');
      await bot.answerCallbackQuery(query.id, { text: `⏰ ${newTimeStr}` });
      
      // Lấy primaryChatId và cập nhật tracker
      const groupChatIds2 = await getGroupChatIds(chatId);
      const primaryChatId2 = groupChatIds2[0];
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const newStartTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${newTimeStr}`, VIETNAM_TZ).toDate();
      sleepSessionTracker.set(primaryChatId2, newStartTime);
      
      // Thông báo đến các thành viên khác
      await notifySyncMembers(chatId, `✏️ Đã sửa giờ bắt đầu ngủ thành ${newTimeStr}!`);
      
      await safeSendMessage(chatId, `✅ Đã sửa giờ bắt đầu ngủ thành ${newTimeStr}!`);
      await showSleepSchedule(chatId);
      return;
    }
    
    // Nhập giờ thủ công cho giấc ngủ hiện tại
    if (query.data === 'routine_current_sleep_custom') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'routine_current_sleep_input_time' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ bé bắt đầu ngủ:\n\n📝 Ví dụ:\n• 9 → 09:00\n• 9 30 → 09:30'
      );
      return;
    }
    
    // ===== THÊM CỮ ĂN MỚI =====
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
    
    // ===== THÊM GIẤC NGỦ MỚI =====
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
    
    // Chọn giờ ăn mới
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
      const feedId = state?.feedId;
      
      await bot.answerCallbackQuery(query.id, { text: `🍼 ${amount}ml` });
      clearState(chatId);
      
      // Lấy primaryChatId để lưu dữ liệu
      const groupChatIds = await getGroupChatIds(chatId);
      const primaryChatId = groupChatIds[0];
      
      // Lưu vào database
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const recordedAt = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      
      if (feedId) {
        await Feeding.findByIdAndUpdate(feedId, { recordedAt, amountMl: amount });
        await safeSendMessage(chatId, `✅ Đã sửa!\n\n🍼 ${amount}ml lúc ${timeStr}`);
        await notifySyncMembers(chatId, `✏️ Đã sửa cữ ăn: ${amount}ml lúc ${timeStr}`);
      } else {
        await Feeding.create({ chatId: primaryChatId, amountMl: amount, recordedAt });
        await safeSendMessage(chatId, `✅ Đã ghi nhận!\n\n🍼 ${amount}ml lúc ${timeStr}`);
        await notifySyncMembers(chatId, `🍼 Ghi nhận cữ ăn: ${amount}ml lúc ${timeStr}`);
      }
      
      await showFeedingSchedule(chatId);
      await scheduleMilkReminderAfterFeed(chatId);
      return;
    }
    
    // Nhập ml thủ công
    if (query.data === 'routine_feed_custom_amount') {
      await bot.answerCallbackQuery(query.id);
      const state = getState(chatId);
      setState(chatId, { type: 'routine_feed_input_amount', timeStr: state?.timeStr, feedId: state?.feedId });
      await safeSendMessage(chatId, '✏️ Nhập số ml:\n\nVí dụ: 160');
      return;
    }
    
    // Chọn giờ ngủ mới
    if (query.data.startsWith('routine_sleep_time_')) {
      const timeStr = query.data.replace('routine_sleep_time_', '');
      await bot.answerCallbackQuery(query.id, { text: `⏰ ${timeStr}` });
      clearState(chatId);
      
      // Lấy primaryChatId để lưu dữ liệu
      const groupChatIds = await getGroupChatIds(chatId);
      const primaryChatId = groupChatIds[0];
      
      // Lưu vào database - giấc ngủ kết thúc bây giờ
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const startTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      const durationMinutes = Math.round((now.toDate().getTime() - startTime.getTime()) / 60000);
      
      await SleepSession.create({
        chatId: primaryChatId,
        start: startTime,
        end: now.toDate(),
        durationMinutes
      });
      
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận!\n\n😴 Ngủ từ ${timeStr} đến ${now.format('HH:mm')}\n⏱️ ${hours}h${mins}p`
      );
      await notifySyncMembers(chatId, `😴 Ghi nhận giấc ngủ: ${timeStr} → ${now.format('HH:mm')} (${hours}h${mins}p)`);
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
    
    if (query.data === 'routine_cancel_to_feed') {
      await bot.answerCallbackQuery(query.id, { text: 'Đã hủy' });
      clearState(chatId);
      await showFeedingSchedule(chatId);
      return;
    }
    
    if (query.data === 'routine_cancel_to_sleep') {
      await bot.answerCallbackQuery(query.id, { text: 'Đã hủy' });
      clearState(chatId);
      await showSleepSchedule(chatId);
      return;
    }
    
    // ===== XÁC NHẬN BỮA ĂN BỊ LỠ =====
    if (query.data === 'missed_feed_yes') {
      await bot.answerCallbackQuery(query.id);
      // Hiển thị các button thời gian để chọn
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const timeButtons = [];
      const row1 = [];
      const row2 = [];
      
      // Tạo 6 mốc thời gian trong quá khứ
      for (let i = 60; i >= 10; i -= 10) {
        const time = now.subtract(i, 'minute').format('HH:mm');
        const btn = { text: time, callback_data: `missed_feed_time_${time}` };
        if (row1.length < 3) row1.push(btn);
        else row2.push(btn);
      }
      
      timeButtons.push(row1, row2);
      timeButtons.push([{ text: '✏️ Nhập giờ khác', callback_data: 'missed_feed_custom' }]);
      timeButtons.push([{ text: '❌ Hủy', callback_data: 'missed_feed_cancel' }]);
      
      await safeSendMessage(
        chatId,
        '🍼 Bé đã ăn lúc mấy giờ?\n\n👇 Chọn giờ:',
        buildInlineKeyboard(timeButtons)
      );
      return;
    }
    
    if (query.data === 'missed_feed_no') {
      await bot.answerCallbackQuery(query.id);
      await safeSendMessage(
        chatId,
        '🍼 OK! Bố/mẹ nhớ cho bé ăn sớm nhé!\n\n💡 Bấm nút "🍼 Ăn" để ghi nhận khi bé ăn.',
        mainKeyboard
      );
      return;
    }
    
    // Chọn giờ ăn khi xác nhận đã ăn
    if (query.data.startsWith('missed_feed_time_')) {
      const timeStr = query.data.replace('missed_feed_time_', '');
      await bot.answerCallbackQuery(query.id, { text: `⏰ ${timeStr}` });
      setState(chatId, { type: 'missed_feed_select_amount', timeStr });
      
      // Hiển thị keyboard chọn ml
      const amountButtons = [];
      for (let i = 0; i < MILK_AMOUNTS.length; i += 4) {
        const row = [];
        for (let j = i; j < i + 4 && j < MILK_AMOUNTS.length; j++) {
          row.push({ 
            text: `${MILK_AMOUNTS[j]}ml`, 
            callback_data: `missed_feed_amount_${MILK_AMOUNTS[j]}` 
          });
        }
        amountButtons.push(row);
      }
      amountButtons.push([{ text: '✏️ Nhập số khác', callback_data: 'missed_feed_custom_amount' }]);
      
      await safeSendMessage(
        chatId,
        `⏰ Giờ ăn: ${timeStr}\n\n👇 Bé ăn bao nhiêu ml?`,
        buildInlineKeyboard(amountButtons)
      );
      return;
    }
    
    // Nhập giờ ăn thủ công khi quên
    if (query.data === 'missed_feed_custom') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'missed_feed_input_time' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ bé đã ăn:\n\n📝 Ví dụ:\n• 9 → 09:00\n• 9 30 → 09:30'
      );
      return;
    }
    
    // Chọn ml khi xác nhận bữa ăn bị lỡ
    if (query.data.startsWith('missed_feed_amount_')) {
      const amount = parseInt(query.data.replace('missed_feed_amount_', ''), 10);
      const state = getState(chatId);
      const timeStr = state?.timeStr;
      
      await bot.answerCallbackQuery(query.id, { text: `🍼 ${amount}ml` });
      clearState(chatId);
      
      // Lấy primaryChatId để lưu dữ liệu
      const groupChatIds = await getGroupChatIds(chatId);
      const primaryChatId = groupChatIds[0];
      
      // Lưu vào database
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const recordedAt = dayjs.tz(`${now.format('YYYY-MM-DD')} ${timeStr}`, VIETNAM_TZ).toDate();
      await Feeding.create({ chatId: primaryChatId, amountMl: amount, recordedAt });
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận!\n\n🍼 ${amount}ml lúc ${timeStr}\n\n⏰ Em sẽ nhắc cữ tiếp theo sau ${CONSTANTS.MILK_INTERVAL_HOURS || 3}h nữa!`,
        mainKeyboard
      );
      await notifySyncMembers(chatId, `🍼 Ghi nhận cữ ăn: ${amount}ml lúc ${timeStr}`);
      await scheduleMilkReminderAfterFeed(chatId);
      return;
    }
    
    // Nhập ml thủ công khi quên
    if (query.data === 'missed_feed_custom_amount') {
      await bot.answerCallbackQuery(query.id);
      const state = getState(chatId);
      setState(chatId, { type: 'missed_feed_input_amount', timeStr: state?.timeStr });
      await safeSendMessage(chatId, '✏️ Nhập số ml:\n\nVí dụ: 160');
      return;
    }
    
    if (query.data === 'missed_feed_cancel') {
      await bot.answerCallbackQuery(query.id, { text: 'Đã hủy' });
      clearState(chatId);
      await safeSendMessage(chatId, '✅ OK!', mainKeyboard);
      return;
    }
    
    // ===== XÁC NHẬN GIẤC NGỦ BỊ LỠ =====
    if (query.data === 'missed_sleep_yes') {
      await bot.answerCallbackQuery(query.id);
      // Hiển thị các button thời gian để chọn
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const timeButtons = [];
      const row1 = [];
      const row2 = [];
      
      // Tạo 6 mốc thời gian trong quá khứ
      for (let i = 90; i >= 15; i -= 15) {
        const time = now.subtract(i, 'minute').format('HH:mm');
        const btn = { text: time, callback_data: `missed_sleep_start_${time}` };
        if (row1.length < 3) row1.push(btn);
        else row2.push(btn);
      }
      
      timeButtons.push(row1, row2);
      timeButtons.push([{ text: '✏️ Nhập giờ khác', callback_data: 'missed_sleep_custom_start' }]);
      timeButtons.push([{ text: '❌ Hủy', callback_data: 'missed_sleep_cancel' }]);
      
      await safeSendMessage(
        chatId,
        '😴 Bé đã bắt đầu ngủ lúc mấy giờ?\n\n👇 Chọn giờ:',
        buildInlineKeyboard(timeButtons)
      );
      return;
    }
    
    if (query.data === 'missed_sleep_no') {
      await bot.answerCallbackQuery(query.id);
      await safeSendMessage(
        chatId,
        '😴 OK! Nếu bé buồn ngủ, bố/mẹ nhớ cho bé ngủ nhé!\n\n💡 Bấm nút "😴 Nhật ký ngủ" để ghi nhận.',
        mainKeyboard
      );
      return;
    }
    
    // Chọn giờ bắt đầu ngủ khi xác nhận đã ngủ
    if (query.data.startsWith('missed_sleep_start_')) {
      const startTimeStr = query.data.replace('missed_sleep_start_', '');
      await bot.answerCallbackQuery(query.id, { text: `⏰ ${startTimeStr}` });
      
      // Hỏi bé đã dậy chưa
      const sleepButtons = buildInlineKeyboard([
        [
          { text: '✅ Đã dậy rồi', callback_data: `missed_sleep_ended_${startTimeStr}` },
          { text: '😴 Vẫn đang ngủ', callback_data: `missed_sleep_ongoing_${startTimeStr}` }
        ]
      ]);
      
      await safeSendMessage(
        chatId,
        `⏰ Bé ngủ từ: ${startTimeStr}\n\n👇 Bé đã dậy chưa?`,
        sleepButtons
      );
      return;
    }
    
    // Bé vẫn đang ngủ
    if (query.data.startsWith('missed_sleep_ongoing_')) {
      const startTimeStr = query.data.replace('missed_sleep_ongoing_', '');
      await bot.answerCallbackQuery(query.id);
      clearState(chatId);
      
      // Lấy primaryChatId và lưu vào tracker
      const groupChatIds3 = await getGroupChatIds(chatId);
      const primaryChatId3 = groupChatIds3[0];
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const startTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${startTimeStr}`, VIETNAM_TZ).toDate();
      sleepSessionTracker.set(primaryChatId3, startTime);
      
      const elapsed = Math.round((now.toDate().getTime() - startTime.getTime()) / 60000);
      const elapsedStr = elapsed >= 60 
        ? `${Math.floor(elapsed/60)}h${elapsed%60}p`
        : `${elapsed}p`;
      
      // Thông báo đến các thành viên khác
      await notifySyncMembers(chatId, `😴 Bé đang ngủ từ ${startTimeStr} (đã ngủ ${elapsedStr})`);
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận!\n\n😴 Bé đang ngủ từ ${startTimeStr}\n⏱️ Đã ngủ: ${elapsedStr}\n\n💡 Khi bé dậy, bấm nút "😴 Nhật ký ngủ" để kết thúc giấc ngủ.`,
        mainKeyboard
      );
      return;
    }
    
    // Bé đã dậy - chọn giờ dậy
    if (query.data.startsWith('missed_sleep_ended_')) {
      const startTimeStr = query.data.replace('missed_sleep_ended_', '');
      await bot.answerCallbackQuery(query.id);
      
      // Hiển thị các button giờ dậy
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const timeButtons = [];
      const row1 = [];
      const row2 = [];
      
      // Tạo các mốc thời gian dậy
      for (let i = 60; i >= 10; i -= 10) {
        const time = now.subtract(i, 'minute').format('HH:mm');
        const btn = { text: time, callback_data: `missed_sleep_woke_${startTimeStr}_${time}` };
        if (row1.length < 3) row1.push(btn);
        else row2.push(btn);
      }
      row2.push({ text: now.format('HH:mm'), callback_data: `missed_sleep_woke_${startTimeStr}_${now.format('HH:mm')}` });
      
      timeButtons.push(row1, row2);
      timeButtons.push([{ text: '✏️ Nhập giờ khác', callback_data: `missed_sleep_custom_end_${startTimeStr}` }]);
      
      await safeSendMessage(
        chatId,
        `⏰ Bé ngủ từ: ${startTimeStr}\n\n👇 Bé dậy lúc mấy giờ?`,
        buildInlineKeyboard(timeButtons)
      );
      return;
    }
    
    // Lưu giấc ngủ đã hoàn thành
    if (query.data.startsWith('missed_sleep_woke_')) {
      const parts = query.data.replace('missed_sleep_woke_', '').split('_');
      const startTimeStr = parts[0];
      const endTimeStr = parts[1];
      
      await bot.answerCallbackQuery(query.id, { text: '✅ Đã lưu!' });
      clearState(chatId);
      
      // Lấy primaryChatId để lưu dữ liệu
      const groupChatIds = await getGroupChatIds(chatId);
      const primaryChatId = groupChatIds[0];
      
      // Lưu vào database
      const now = dayjs.tz(dayjs(), VIETNAM_TZ);
      const startTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${startTimeStr}`, VIETNAM_TZ).toDate();
      const endTime = dayjs.tz(`${now.format('YYYY-MM-DD')} ${endTimeStr}`, VIETNAM_TZ).toDate();
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      
      await SleepSession.create({
        chatId: primaryChatId,
        start: startTime,
        end: endTime,
        durationMinutes
      });
      
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận!\n\n😴 Ngủ: ${startTimeStr} → ${endTimeStr}\n⏱️ Thời gian: ${hours}h${mins}p`,
        mainKeyboard
      );
      await notifySyncMembers(chatId, `😴 Ghi nhận giấc ngủ: ${startTimeStr} → ${endTimeStr} (${hours}h${mins}p)`);
      return;
    }
    
    // Nhập giờ ngủ thủ công khi quên
    if (query.data === 'missed_sleep_custom_start') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'missed_sleep_input_start' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ bé bắt đầu ngủ:\n\n📝 Ví dụ:\n• 9 → 09:00\n• 9 30 → 09:30'
      );
      return;
    }
    
    // Nhập giờ dậy thủ công
    if (query.data.startsWith('missed_sleep_custom_end_')) {
      const startTimeStr = query.data.replace('missed_sleep_custom_end_', '');
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'missed_sleep_input_end', startTimeStr });
      await safeSendMessage(
        chatId,
        `⏰ Bé ngủ từ: ${startTimeStr}\n\n✏️ Nhập giờ bé dậy:\n\n📝 Ví dụ:\n• 11 → 11:00\n• 11 30 → 11:30`
      );
      return;
    }
    
    if (query.data === 'missed_sleep_cancel') {
      await bot.answerCallbackQuery(query.id, { text: 'Đã hủy' });
      clearState(chatId);
      await safeSendMessage(chatId, '✅ OK!', mainKeyboard);
      return;
    }
    
    // ===== NAVIGATION LINKS =====
    // Chuyển đến menu sữa
    if (query.data === 'go_milk') {
      await bot.answerCallbackQuery(query.id);
      // Import và gọi showMilkMenu từ milk.js
      const { showMilkMenu } = await import('./milk.js');
      await showMilkMenu(chatId);
      return;
    }
    
    // Chuyển đến nhật ký ngủ
    if (query.data === 'go_sleep') {
      await bot.answerCallbackQuery(query.id);
      // Import và gọi showSleepMenu từ sleep.js
      const { showSleepMenu } = await import('./sleep.js');
      await showSleepMenu(chatId);
      return;
    }
    
    // Chuyển đến lịch ăn ngủ
    if (query.data === 'go_routine') {
      await bot.answerCallbackQuery(query.id);
      await showRoutineMenu(chatId);
      return;
    }
    
    // Quay về menu chính
    if (query.data === 'go_main') {
      await bot.answerCallbackQuery(query.id);
      await safeSendMessage(chatId, '📋 Menu chính:', mainKeyboard);
      return;
    }
  });
};

// Export để sử dụng trong jobs
export { showRoutineMenu, showFeedingSchedule, showSleepSchedule };
export default registerRoutineHandler;
