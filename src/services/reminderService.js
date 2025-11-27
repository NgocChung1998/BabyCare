import { CONSTANTS } from '../config/index.js';
import { randomDiaperDelayMs } from '../utils/helpers.js';

const milkTimers = new Map(); // Map<chatId, Array<timeoutId>>
const diaperTimers = new Map();

// Cấu hình nhắc nhở sữa (phút)
const MILK_REMINDER_SCHEDULE = [
  { minutesAfter: 120, message: '🍼 Còn 30 phút nữa tới cữ ăn tiếp theo!' },
  { minutesAfter: 140, message: '🍼 Còn 10 phút nữa tới cữ ăn tiếp theo!' },
  { minutesAfter: 150, message: '🍼 Đến giờ cho bé ăn rồi bố mẹ ơi!' },
  { minutesAfter: 165, message: '⚠️ Bé đã quá giờ ăn 15 phút! Nhớ cho bé bú nhé!' },
  { minutesAfter: 180, message: '⚠️ Bé đã quá giờ ăn 30 phút! Bố/mẹ cho bé ăn ngay nhé!' }
];

/**
 * Đặt nhiều timer nhắc sữa
 * @param {number} chatId - Chat ID
 * @param {Function} callback - Callback nhận message để gửi
 */
export const setMilkReminder = (chatId, callback) => {
  // Xóa timers cũ nếu có
  clearMilkReminder(chatId);
  
  const timers = [];
  
  for (const reminder of MILK_REMINDER_SCHEDULE) {
    const timeoutMs = reminder.minutesAfter * 60 * 1000;
    const timeoutId = setTimeout(() => {
      if (typeof callback === 'function') {
        callback(reminder.message);
      }
    }, timeoutMs);
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

