import { CONSTANTS } from '../config/index.js';
import { randomDiaperDelayMs } from '../utils/helpers.js';

const milkTimers = new Map();
const diaperTimers = new Map();

/**
 * Đặt timer nhắc sữa
 * @param {number} chatId - Chat ID
 * @param {Function} callback - Callback khi hết giờ
 */
export const setMilkReminder = (chatId, callback) => {
  if (milkTimers.has(chatId)) {
    clearTimeout(milkTimers.get(chatId));
  }
  const timeout = setTimeout(() => {
    callback();
    milkTimers.delete(chatId);
  }, CONSTANTS.MILK_INTERVAL_MINUTES * 60 * 1000);
  milkTimers.set(chatId, timeout);
};

/**
 * Xoá timer nhắc sữa
 * @param {number} chatId - Chat ID
 */
export const clearMilkReminder = (chatId) => {
  if (milkTimers.has(chatId)) {
    clearTimeout(milkTimers.get(chatId));
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

