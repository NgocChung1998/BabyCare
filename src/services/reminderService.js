import { CONSTANTS } from '../config/index.js';
import { randomDiaperDelayMs } from '../utils/helpers.js';
import dayjs from 'dayjs';

const milkTimers = new Map(); // Map<chatId, Array<timeoutId>>
const diaperTimers = new Map();
const awakeTimers = new Map(); // Map<chatId, Array<timeoutId>> - nhắc bé thức quá lâu
const sleepTimers = new Map(); // Map<chatId, Array<timeoutId>> - nhắc bé ngủ quá lâu

// Cấu hình nhắc nhở sữa (phút từ lúc ăn)
// Thời gian linh hoạt theo tuổi bé, các mốc dưới là tối thiểu
export const MILK_REMINDER_SCHEDULE = [
  { minutesAfter: 120, message: '🍼 Đã 2 tiếng từ cữ trước! Chuẩn bị pha sữa nhé!', label: 'Đã 2h' },
  { minutesAfter: 140, message: '🍼 Đã 2h20 rồi! Pha sữa cho bé nhé!', label: 'Đã 2h20' },
  { minutesAfter: 150, message: '🍼 Đã 2h30 rồi! Cho bé ăn thôi bố mẹ ơi!', label: 'Đã 2h30' },
  { minutesAfter: 165, message: '⚠️ Đã 2h45 rồi! Bé có thể đói, cho ăn ngay nhé!', label: 'Đã 2h45' },
  { minutesAfter: 180, message: '⚠️ Đã 3 tiếng rồi! Cho bé ăn ngay nhé!', label: 'Đã 3h' }
];

// Cấu hình nhắc thay tã (phút từ lúc thay)
export const DIAPER_REMINDER_SCHEDULE = [
  { minutesAfter: 150, message: '🧷 Đã 2.5 tiếng rồi, kiểm tra tã cho bé nhé!', label: 'Đã 2h30' },
  { minutesAfter: 180, message: '🧷 Đã 3 tiếng rồi, bố/mẹ kiểm tra tã cho bé nhé!', label: 'Đã 3h' },
  { minutesAfter: 210, message: '🧷 Đã 3.5 tiếng rồi! Nên thay tã cho bé ngay!', label: 'Đã 3h30' },
  { minutesAfter: 240, message: '⚠️ Đã 4 tiếng! Tã có thể đầy rồi, thay ngay cho bé nhé!', label: 'Đã 4h!' }
];

/**
 * Khuyến nghị thời gian thức theo tuổi (phút)
 * Dựa trên nghiên cứu của các chuyên gia giấc ngủ trẻ em
 */
export const AWAKE_TIME_BY_AGE = [
  { minMonths: 0, maxMonths: 1, minMins: 30, maxMins: 60, napDuration: { min: 30, max: 120 } },
  { minMonths: 1, maxMonths: 2, minMins: 45, maxMins: 75, napDuration: { min: 30, max: 120 } },
  { minMonths: 2, maxMonths: 3, minMins: 60, maxMins: 90, napDuration: { min: 45, max: 120 } },
  { minMonths: 3, maxMonths: 4, minMins: 75, maxMins: 120, napDuration: { min: 45, max: 120 } },
  { minMonths: 4, maxMonths: 6, minMins: 90, maxMins: 150, napDuration: { min: 60, max: 120 } },
  { minMonths: 6, maxMonths: 9, minMins: 120, maxMins: 180, napDuration: { min: 60, max: 120 } },
  { minMonths: 9, maxMonths: 12, minMins: 150, maxMins: 240, napDuration: { min: 60, max: 120 } },
  { minMonths: 12, maxMonths: 18, minMins: 180, maxMins: 300, napDuration: { min: 60, max: 150 } },
  { minMonths: 18, maxMonths: 24, minMins: 240, maxMins: 360, napDuration: { min: 60, max: 150 } },
  { minMonths: 24, maxMonths: 999, minMins: 300, maxMins: 420, napDuration: { min: 60, max: 150 } }
];

/**
 * Lấy khuyến nghị thời gian thức theo tuổi
 */
export const getAwakeTimeRecommendation = (ageMonths) => {
  const rec = AWAKE_TIME_BY_AGE.find(r => ageMonths >= r.minMonths && ageMonths < r.maxMonths);
  return rec || AWAKE_TIME_BY_AGE[AWAKE_TIME_BY_AGE.length - 1];
};

/**
 * Kiểm tra có phải ban đêm không (20:00-06:00)
 */
export const isNightTime = () => {
  const hour = dayjs().hour();
  return hour >= 20 || hour < 6;
};

/**
 * Kiểm tra có phải giờ ngủ đêm không (19:00-07:00)
 */
export const isNightSleepTime = () => {
  const hour = dayjs().hour();
  return hour >= 19 || hour < 7;
};

/**
 * Đặt nhiều timer nhắc sữa
 * @param {number} chatId - Chat ID
 * @param {Date|string|number} lastFeedAt - Thời điểm cữ ăn cuối cùng
 * @param {Function} callback - Callback nhận message để gửi
 */
export const setMilkReminder = (chatId, lastFeedAt, callback) => {
  // Xóa timers cũ nếu có
  clearMilkReminder(chatId);
  
  const timers = [];
  const baseTime = lastFeedAt ? new Date(lastFeedAt) : new Date();
  const baseMs = baseTime.getTime();
  const nowMs = Date.now();
  let scheduled = false;
  
  console.log(`[MilkReminder] Setting reminders for chatId=${chatId}, lastFeedAt=${dayjs(baseTime).format('HH:mm:ss')}`);
  
  for (const reminder of MILK_REMINDER_SCHEDULE) {
    const targetMs = baseMs + reminder.minutesAfter * 60 * 1000;
    const timeoutMs = targetMs - nowMs;
    if (timeoutMs <= 0) {
      console.log(`[MilkReminder] Skipping ${reminder.label} (already passed)`);
      continue;
    }
    
    const targetTime = dayjs(targetMs).format('HH:mm:ss');
    console.log(`[MilkReminder] Scheduled "${reminder.label}" at ${targetTime} (in ${Math.round(timeoutMs/60000)}min)`);
    
    const timeoutId = setTimeout(() => {
      console.log(`[MilkReminder] Firing "${reminder.label}" for chatId=${chatId}`);
      if (typeof callback === 'function') {
        callback(reminder.message);
      }
    }, timeoutMs);
    timers.push(timeoutId);
    scheduled = true;
  }

  // Nếu đã qua toàn bộ mốc nhắc -> gửi ngay thông điệp quá giờ cuối cùng
  if (!scheduled && MILK_REMINDER_SCHEDULE.length > 0 && typeof callback === 'function') {
    console.log(`[MilkReminder] All reminders passed, sending last reminder immediately`);
    const lastReminder = MILK_REMINDER_SCHEDULE[MILK_REMINDER_SCHEDULE.length - 1];
    const timeoutId = setTimeout(() => callback(lastReminder.message), 0);
    timers.push(timeoutId);
  }
  
  milkTimers.set(chatId, timers);
  console.log(`[MilkReminder] Total ${timers.length} timers set for chatId=${chatId}`);
};

/**
 * Xoá tất cả timer nhắc sữa của một chatId
 * @param {number} chatId - Chat ID
 */
export const clearMilkReminder = (chatId) => {
  if (milkTimers.has(chatId)) {
    const timers = milkTimers.get(chatId);
    if (Array.isArray(timers)) {
      timers.forEach(t => clearTimeout(t));
    } else {
      clearTimeout(timers);
    }
    milkTimers.delete(chatId);
  }
};

/**
 * Đặt nhiều timer nhắc thay tã
 * @param {number} chatId - Chat ID
 * @param {Date|string|number} lastDiaperAt - Thời điểm thay tã cuối cùng
 * @param {Function} callback - Callback nhận message để gửi
 */
export const setDiaperReminder = (chatId, lastDiaperAt, callback) => {
  // Xóa timers cũ nếu có
  clearDiaperReminder(chatId);
  
  const timers = [];
  const baseTime = lastDiaperAt ? new Date(lastDiaperAt) : new Date();
  const baseMs = baseTime.getTime();
  const nowMs = Date.now();
  let scheduled = false;
  
  console.log(`[DiaperReminder] Setting reminders for chatId=${chatId}, lastDiaperAt=${dayjs(baseTime).format('HH:mm:ss')}`);
  
  for (const reminder of DIAPER_REMINDER_SCHEDULE) {
    const targetMs = baseMs + reminder.minutesAfter * 60 * 1000;
    const timeoutMs = targetMs - nowMs;
    if (timeoutMs <= 0) {
      console.log(`[DiaperReminder] Skipping ${reminder.label} (already passed)`);
      continue;
    }
    
    const targetTime = dayjs(targetMs).format('HH:mm:ss');
    console.log(`[DiaperReminder] Scheduled "${reminder.label}" at ${targetTime} (in ${Math.round(timeoutMs/60000)}min)`);
    
    const timeoutId = setTimeout(() => {
      console.log(`[DiaperReminder] Firing "${reminder.label}" for chatId=${chatId}`);
      if (typeof callback === 'function') {
        callback(reminder.message);
      }
    }, timeoutMs);
    timers.push(timeoutId);
    scheduled = true;
  }

  // Nếu đã qua toàn bộ mốc nhắc -> không gửi gì
  if (!scheduled) {
    console.log(`[DiaperReminder] All reminders passed for chatId=${chatId}`);
  }
  
  diaperTimers.set(chatId, timers);
  console.log(`[DiaperReminder] Total ${timers.length} timers set for chatId=${chatId}`);
};

/**
 * Xoá tất cả timer nhắc tã của một chatId
 * @param {number} chatId - Chat ID
 */
export const clearDiaperReminder = (chatId) => {
  if (diaperTimers.has(chatId)) {
    const timers = diaperTimers.get(chatId);
    if (Array.isArray(timers)) {
      timers.forEach(t => clearTimeout(t));
    } else {
      clearTimeout(timers);
    }
    diaperTimers.delete(chatId);
  }
};

/**
 * Xoá tất cả timers
 */
export const clearAllReminders = () => {
  milkTimers.forEach((timers) => {
    if (Array.isArray(timers)) timers.forEach(t => clearTimeout(t));
    else clearTimeout(timers);
  });
  milkTimers.clear();
  
  diaperTimers.forEach((timers) => {
    if (Array.isArray(timers)) timers.forEach(t => clearTimeout(t));
    else clearTimeout(timers);
  });
  diaperTimers.clear();
  
  awakeTimers.forEach((timers) => {
    if (Array.isArray(timers)) timers.forEach(t => clearTimeout(t));
    else clearTimeout(timers);
  });
  awakeTimers.clear();
  
  sleepTimers.forEach((timers) => {
    if (Array.isArray(timers)) timers.forEach(t => clearTimeout(t));
    else clearTimeout(timers);
  });
  sleepTimers.clear();
};

/**
 * Xóa timer nhắc thức của một chatId
 */
export const clearAwakeReminder = (chatId) => {
  if (awakeTimers.has(chatId)) {
    const timers = awakeTimers.get(chatId);
    if (Array.isArray(timers)) {
      timers.forEach(t => clearTimeout(t));
    } else {
      clearTimeout(timers);
    }
    awakeTimers.delete(chatId);
  }
};

/**
 * Xóa timer nhắc ngủ của một chatId
 */
export const clearSleepReminder = (chatId) => {
  if (sleepTimers.has(chatId)) {
    const timers = sleepTimers.get(chatId);
    if (Array.isArray(timers)) {
      timers.forEach(t => clearTimeout(t));
    } else {
      clearTimeout(timers);
    }
    sleepTimers.delete(chatId);
  }
};

/**
 * Đặt timer nhắc bé thức quá lâu
 * @param {number} chatId - Chat ID
 * @param {Date|string|number} wokeUpAt - Thời điểm bé dậy
 * @param {number} ageMonths - Tuổi bé (tháng)
 * @param {Function} callback - Callback nhận message để gửi
 */
export const setAwakeReminder = (chatId, wokeUpAt, ageMonths, callback) => {
  clearAwakeReminder(chatId);
  
  const rec = getAwakeTimeRecommendation(ageMonths);
  const baseTime = wokeUpAt ? new Date(wokeUpAt) : new Date();
  const baseMs = baseTime.getTime();
  const nowMs = Date.now();
  const timers = [];
  
  // Kiểm tra có phải ban đêm không - ban đêm không nhắc cho ngủ
  const hour = dayjs().hour();
  if (hour >= 20 || hour < 6) {
    console.log(`[AwakeReminder] Skipping - night time (${hour}h)`);
    return;
  }
  
  console.log(`[AwakeReminder] Setting for chatId=${chatId}, age=${ageMonths}m, wokeUp=${dayjs(baseTime).format('HH:mm')}`);
  console.log(`[AwakeReminder] Recommended awake: ${rec.minMins}-${rec.maxMins} mins`);
  
  // Nhắc khi gần đến thời gian thức tối đa (trước 10 phút)
  const warnMs = baseMs + (rec.maxMins - 10) * 60 * 1000;
  const warnTimeoutMs = warnMs - nowMs;
  if (warnTimeoutMs > 0) {
    const warnTime = dayjs(warnMs).format('HH:mm');
    console.log(`[AwakeReminder] Warning at ${warnTime} (in ${Math.round(warnTimeoutMs/60000)}min)`);
    
    const warnId = setTimeout(() => {
      console.log(`[AwakeReminder] Firing warning for chatId=${chatId}`);
      if (typeof callback === 'function') {
        const awakeTime = Math.round((Date.now() - baseMs) / 60000);
        callback(`😴 Bé đã thức ${awakeTime} phút rồi!\n\n💡 Theo chuyên gia, bé ${ageMonths} tháng nên thức ${rec.minMins}-${rec.maxMins} phút.\n\n🛏️ Chuẩn bị cho bé ngủ nhé!`);
      }
    }, warnTimeoutMs);
    timers.push(warnId);
  }
  
  // Nhắc khi quá thời gian thức tối đa
  const maxMs = baseMs + rec.maxMins * 60 * 1000;
  const maxTimeoutMs = maxMs - nowMs;
  if (maxTimeoutMs > 0) {
    const maxTime = dayjs(maxMs).format('HH:mm');
    console.log(`[AwakeReminder] Max alert at ${maxTime} (in ${Math.round(maxTimeoutMs/60000)}min)`);
    
    const maxId = setTimeout(() => {
      console.log(`[AwakeReminder] Firing max alert for chatId=${chatId}`);
      if (typeof callback === 'function') {
        const awakeTime = Math.round((Date.now() - baseMs) / 60000);
        callback(`⚠️ Bé đã thức ${awakeTime} phút - QUÁ THỜI GIAN!\n\n👶 Bé ${ageMonths} tháng nên thức tối đa ${rec.maxMins} phút.\n\n😫 Bé có thể quấy vì quá mệt. Cho bé ngủ ngay nhé!`);
      }
    }, maxTimeoutMs);
    timers.push(maxId);
  }
  
  // Nhắc lần cuối nếu quá 30 phút
  const overMs = baseMs + (rec.maxMins + 30) * 60 * 1000;
  const overTimeoutMs = overMs - nowMs;
  if (overTimeoutMs > 0) {
    const overId = setTimeout(() => {
      console.log(`[AwakeReminder] Firing overtime alert for chatId=${chatId}`);
      if (typeof callback === 'function') {
        const awakeTime = Math.round((Date.now() - baseMs) / 60000);
        callback(`🚨 Bé đã thức ${awakeTime} phút - QUÁ LÂU!\n\n😰 Bé có thể rất mệt và khó ngủ hơn.\n\n💤 Hãy cho bé ngủ ngay, có thể cần ru hoặc bế nhiều hơn.`);
      }
    }, overTimeoutMs);
    timers.push(overId);
  }
  
  awakeTimers.set(chatId, timers);
  console.log(`[AwakeReminder] Total ${timers.length} timers set`);
};

/**
 * Đặt timer nhắc bé ngủ quá lâu
 * @param {number} chatId - Chat ID
 * @param {Date|string|number} sleepStartAt - Thời điểm bé bắt đầu ngủ
 * @param {number} ageMonths - Tuổi bé (tháng)
 * @param {Function} callback - Callback nhận message để gửi
 */
export const setSleepReminder = (chatId, sleepStartAt, ageMonths, callback) => {
  clearSleepReminder(chatId);
  
  const rec = getAwakeTimeRecommendation(ageMonths);
  const baseTime = sleepStartAt ? new Date(sleepStartAt) : new Date();
  const baseMs = baseTime.getTime();
  const nowMs = Date.now();
  const timers = [];
  
  // Kiểm tra có phải giấc ngủ đêm không (19h-7h)
  const startHour = dayjs(baseTime).hour();
  const isNightSleep = startHour >= 19 || startHour < 7;
  
  if (isNightSleep) {
    console.log(`[SleepReminder] Skipping - night sleep (started at ${startHour}h)`);
    return; // Không nhắc giấc ngủ đêm
  }
  
  const maxNapMins = rec.napDuration.max;
  console.log(`[SleepReminder] Setting for chatId=${chatId}, age=${ageMonths}m, started=${dayjs(baseTime).format('HH:mm')}`);
  console.log(`[SleepReminder] Recommended nap: ${rec.napDuration.min}-${maxNapMins} mins`);
  
  // Nhắc khi gần đến thời gian ngủ tối đa (trước 15 phút)
  const warnMs = baseMs + (maxNapMins - 15) * 60 * 1000;
  const warnTimeoutMs = warnMs - nowMs;
  if (warnTimeoutMs > 0) {
    const warnTime = dayjs(warnMs).format('HH:mm');
    console.log(`[SleepReminder] Warning at ${warnTime} (in ${Math.round(warnTimeoutMs/60000)}min)`);
    
    const warnId = setTimeout(() => {
      console.log(`[SleepReminder] Firing warning for chatId=${chatId}`);
      if (typeof callback === 'function') {
        const sleepTime = Math.round((Date.now() - baseMs) / 60000);
        callback(`⏰ Bé đã ngủ ${sleepTime} phút rồi!\n\n💡 Giấc nap nên khoảng ${rec.napDuration.min}-${maxNapMins} phút.\n\n🌞 Chuẩn bị gọi bé dậy nhé!`);
      }
    }, warnTimeoutMs);
    timers.push(warnId);
  }
  
  // Nhắc khi quá thời gian ngủ tối đa
  const maxMs = baseMs + maxNapMins * 60 * 1000;
  const maxTimeoutMs = maxMs - nowMs;
  if (maxTimeoutMs > 0) {
    const maxTime = dayjs(maxMs).format('HH:mm');
    console.log(`[SleepReminder] Max alert at ${maxTime} (in ${Math.round(maxTimeoutMs/60000)}min)`);
    
    const maxId = setTimeout(() => {
      console.log(`[SleepReminder] Firing max alert for chatId=${chatId}`);
      if (typeof callback === 'function') {
        const sleepTime = Math.round((Date.now() - baseMs) / 60000);
        callback(`⚠️ Bé đã ngủ ${sleepTime} phút - KHUYẾN NGHỊ GỌI DẬY!\n\n👶 Nap quá dài có thể ảnh hưởng giấc đêm.\n\n🌞 Gọi bé dậy từ từ nhé!`);
      }
    }, maxTimeoutMs);
    timers.push(maxId);
  }
  
  // Nhắc lần cuối nếu quá 30 phút
  const overMs = baseMs + (maxNapMins + 30) * 60 * 1000;
  const overTimeoutMs = overMs - nowMs;
  if (overTimeoutMs > 0) {
    const overId = setTimeout(() => {
      console.log(`[SleepReminder] Firing overtime alert for chatId=${chatId}`);
      if (typeof callback === 'function') {
        const sleepTime = Math.round((Date.now() - baseMs) / 60000);
        callback(`🚨 Bé đã ngủ ${sleepTime} phút - QUÁ LÂU!\n\n😰 Nap quá dài sẽ làm bé khó ngủ đêm.\n\n☀️ Nên gọi bé dậy ngay!`);
      }
    }, overTimeoutMs);
    timers.push(overId);
  }
  
  sleepTimers.set(chatId, timers);
  console.log(`[SleepReminder] Total ${timers.length} timers set`);
};

/**
 * Khởi tạo lại tất cả reminders từ database khi app start
 * @param {Function} sendReminder - Function(chatId, message) để gửi nhắc nhở
 */
export const initializeRemindersFromDb = async (sendReminder) => {
  try {
    // Import dynamic để tránh circular dependency
    const { Feeding, DiaperLog, SyncGroup, SleepSession, ChatProfile } = await import('../database/models/index.js');
    
    console.log('[Reminder] Initializing reminders from database...');
    
    // Lấy tất cả sync groups active
    const groups = await SyncGroup.find({ isActive: true });
    const allPrimaryChatIds = groups.map(g => g.primaryChatId);
    
    // Thêm các chatId từ các hoạt động gần đây
    const recentFeeds = await Feeding.find({
      recordedAt: { $gte: dayjs().subtract(4, 'hour').toDate() }
    }).distinct('chatId');
    
    const recentDiapers = await DiaperLog.find({
      recordedAt: { $gte: dayjs().subtract(5, 'hour').toDate() }
    }).distinct('chatId');
    
    const recentSleeps = await SleepSession.find({
      $or: [
        { end: { $gte: dayjs().subtract(6, 'hour').toDate() } },
        { start: { $gte: dayjs().subtract(3, 'hour').toDate() }, end: null }
      ]
    }).distinct('chatId');
    
    // Thêm các chatId có profile với ngày sinh
    const profilesWithDob = await ChatProfile.find({
      dateOfBirth: { $exists: true },
      currentSleepStart: { $exists: true }
    }).distinct('chatId');
    
    const allChatIds = [...new Set([...allPrimaryChatIds, ...recentFeeds, ...recentDiapers, ...recentSleeps, ...profilesWithDob])];
    
    let milkCount = 0;
    let diaperCount = 0;
    let awakeCount = 0;
    let sleepCount = 0;
    
    for (const chatId of allChatIds) {
      // Tìm cữ ăn gần nhất trong 4 tiếng
      const lastFeed = await Feeding.findOne({
        chatId,
        recordedAt: { $gte: dayjs().subtract(4, 'hour').toDate() }
      }).sort({ recordedAt: -1 });
      
      if (lastFeed) {
        setMilkReminder(chatId, lastFeed.recordedAt, (message) => {
          sendReminder(chatId, message);
        });
        milkCount++;
      }
      
      // Tìm lần thay tã gần nhất trong 5 tiếng
      const lastDiaper = await DiaperLog.findOne({
        chatId,
        recordedAt: { $gte: dayjs().subtract(5, 'hour').toDate() }
      }).sort({ recordedAt: -1 });
      
      if (lastDiaper) {
        setDiaperReminder(chatId, lastDiaper.recordedAt, (message) => {
          sendReminder(chatId, message);
        });
        diaperCount++;
      }
      
      // Lấy tuổi bé
      const profile = await ChatProfile.findOne({ chatId, dateOfBirth: { $exists: true } });
      if (!profile?.dateOfBirth) continue;
      
      const ageMonths = dayjs().diff(dayjs(profile.dateOfBirth), 'month');
      
      // Kiểm tra bé đang ngủ hay thức
      if (profile.currentSleepStart) {
        // Bé đang ngủ -> set sleep reminder
        setSleepReminder(chatId, profile.currentSleepStart, ageMonths, (message) => {
          sendReminder(chatId, message);
        });
        sleepCount++;
      } else {
        // Bé đang thức -> tìm giấc ngủ gần nhất đã hoàn thành
        const lastSleep = await SleepSession.findOne({
          chatId,
          end: { $exists: true, $ne: null, $gte: dayjs().subtract(6, 'hour').toDate() }
        }).sort({ end: -1 });
        
        if (lastSleep?.end) {
          setAwakeReminder(chatId, lastSleep.end, ageMonths, (message) => {
            sendReminder(chatId, message);
          });
          awakeCount++;
        }
      }
    }
    
    console.log(`[Reminder] Initialized: ${milkCount} milk, ${diaperCount} diaper, ${awakeCount} awake, ${sleepCount} sleep reminders`);
  } catch (error) {
    console.error('[Reminder] Error initializing reminders:', error);
  }
};

export default {
  setMilkReminder,
  clearMilkReminder,
  setDiaperReminder,
  clearDiaperReminder,
  setAwakeReminder,
  clearAwakeReminder,
  setSleepReminder,
  clearSleepReminder,
  clearAllReminders,
  initializeRemindersFromDb,
  getAwakeTimeRecommendation,
  isNightTime,
  isNightSleepTime
};

