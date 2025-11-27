import { CONSTANTS } from '../config/index.js';
import { randomDiaperDelayMs } from '../utils/helpers.js';

const milkTimers = new Map(); // Map<chatId, Array<timeoutId>>
const diaperTimers = new Map();

// Cấu hình nhắc nhở sữa (phút)
export const MILK_REMINDER_SCHEDULE = [
  { minutesAfter: 120, message: '🍼 Còn 30 phút nữa tới cữ ăn tiếp theo!' },
  { minutesAfter: 140, message: '🍼 Còn 10 phút nữa tới cữ ăn tiếp theo!' },
  { minutesAfter: 150, message: '🍼 Đến giờ cho bé ăn rồi bố mẹ ơi!' },
  { minutesAfter: 165, message: '⚠️ Bé đã quá giờ ăn 15 phút! Nhớ cho bé bú nhé!' },
  { minutesAfter: 180, message: '⚠️ Bé đã quá giờ ăn 30 phút! Bố/mẹ cho bé ăn ngay nhé!' }
];

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
  
  for (const reminder of MILK_REMINDER_SCHEDULE) {
    const targetMs = baseMs + reminder.minutesAfter * 60 * 1000;
    const timeoutMs = targetMs - nowMs;
    if (timeoutMs <= 0) {
      continue;
    }
    const timeoutId = setTimeout(() => {
      if (typeof callback === 'function') {
        callback(reminder.message);
      }
    }, timeoutMs);
    timers.push(timeoutId);
    scheduled = true;
  }

  // Nếu đã qua toàn bộ mốc nhắc -> gửi ngay thông điệp quá giờ cuối cùng
  if (!scheduled && MILK_REMINDER_SCHEDULE.length > 0 && typeof callback === 'function') {
    const lastReminder = MILK_REMINDER_SCHEDULE[MILK_REMINDER_SCHEDULE.length - 1];
    const timeoutId = setTimeout(() => callback(lastReminder.message), 0);
    timers.push(timeoutId);
  }
  
  milkTimers.set(chatId, timers);
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
 * Đặt timer nhắc thay tã
 * @param {number} chatId - Chat ID
 * @param {Function} callback - Callback khi hết giờ
 */
export const setDiaperReminder = (chatId, callback) => {
  if (diaperTimers.has(chatId)) {
    clearTimeout(diaperTimers.get(chatId));
  }
  const timeout = setTimeout(() => {
    callback();
    diaperTimers.delete(chatId);
  }, randomDiaperDelayMs());
  diaperTimers.set(chatId, timeout);
};

/**
 * Xoá timer nhắc tã
 * @param {number} chatId - Chat ID
 */
export const clearDiaperReminder = (chatId) => {
  if (diaperTimers.has(chatId)) {
    clearTimeout(diaperTimers.get(chatId));
    diaperTimers.delete(chatId);
  }
};

/**
 * Xoá tất cả timers
 */
export const clearAllReminders = () => {
  milkTimers.forEach((timer) => clearTimeout(timer));
  milkTimers.clear();
  diaperTimers.forEach((timer) => clearTimeout(timer));
  diaperTimers.clear();
};

export default {
  setMilkReminder,
  clearMilkReminder,
  setDiaperReminder,
  clearDiaperReminder,
  clearAllReminders
};

