import { ChatProfile } from '../database/models/index.js';
import { isQuietHours, msUntilMorning } from '../utils/helpers.js';

const nightModeCache = new Map();

/**
 * Lấy trạng thái night mode của chat
 * @param {number} chatId - Chat ID
 * @returns {Promise<boolean>}
 */
export const fetchNightMode = async (chatId) => {
  if (nightModeCache.has(chatId)) {
    return nightModeCache.get(chatId);
  }
  const profile = await ChatProfile.findOne({ chatId });
  const enabled = profile?.nightModeEnabled ?? false;
  nightModeCache.set(chatId, enabled);
  return enabled;
};

/**
 * Cập nhật cache night mode
 * @param {number} chatId - Chat ID
 * @param {boolean} enabled - Trạng thái
 */
export const setNightModeCache = (chatId, enabled) => {
  nightModeCache.set(chatId, enabled);
};

/**
 * Tạo hàm gửi tin nhắn an toàn với night mode
 * @param {TelegramBot} bot - Bot instance
 * @returns {Function}
 */
export const createSafeSendMessage = (bot) => {
  /**
   * Gửi tin nhắn an toàn với xử lý night mode
   * @param {number} chatId - Chat ID
   * @param {string} text - Nội dung tin nhắn
   * @param {Object} options - Options cho sendMessage
   * @param {string} importance - Mức độ quan trọng: 'low', 'normal', 'high'
   */
  return async (chatId, text, options = {}, importance = 'normal') => {
    const isNightEnabled = await fetchNightMode(chatId);
    if (importance === 'low' && isNightEnabled && isQuietHours()) {
      const delay = msUntilMorning();
      setTimeout(() => {
        bot
          .sendMessage(chatId, `🌙 Tin nhắn được gửi sau chế độ night:\n${text}`, options)
          .catch((error) => console.error('Lỗi gửi tin nhắn hoãn:', error));
      }, delay);
      console.info(`[NightMode] Hoãn thông báo low cho chat ${chatId}`);
      return;
    }
    return bot.sendMessage(chatId, text, options);
  };
};

export default {
  fetchNightMode,
  setNightModeCache,
  createSafeSendMessage
};

