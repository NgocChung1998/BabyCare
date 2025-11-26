import { bot, safeSendMessage } from '../index.js';
import { ChatProfile } from '../../database/models/index.js';
import { setNightModeCache } from '../../services/messageService.js';

/**
 * Cập nhật night mode
 */
const updateNightMode = async (chatId, enabled) => {
  await ChatProfile.findOneAndUpdate({ chatId }, { nightModeEnabled: enabled }, { upsert: true });
  setNightModeCache(chatId, enabled);
  const statusText = enabled
    ? '🌙 Đã bật night mode: 23:00-06:00 mình chỉ gửi thông báo quan trọng.'
    : '🌞 Đã tắt night mode. Mọi thông báo sẽ gửi bình thường.';
  await safeSendMessage(chatId, statusText);
};

/**
 * Đăng ký handler cho night mode
 */
export const registerNightModeHandler = () => {
  bot.onText(/\/night\s+(on|off)/, async (msg, match) => {
    const enabled = match?.[1] === 'on';
    await updateNightMode(msg.chat.id, enabled);
  });
};

export default registerNightModeHandler;

