import { bot, safeSendMessage } from '../index.js';
import { ChatProfile } from '../../database/models/index.js';
import { giftAgeKeyboard, mainKeyboard } from '../keyboard.js';
import { suggestGiftWithAI } from '../../services/aiService.js';
import dayjs from 'dayjs';
import { clearState } from '../../utils/stateManager.js';

/**
 * Hiển thị menu chọn tuổi
 */
const showGiftMenu = async (chatId) => {
  // Kiểm tra xem có ngày sinh không
  const profile = await ChatProfile.findOne({ chatId });
  
  if (profile?.dateOfBirth) {
    const months = dayjs().diff(dayjs(profile.dateOfBirth), 'month');
    await safeSendMessage(
      chatId,
      `🎁 Gợi ý quà tặng:\n\n` +
      `🎂 Bé hiện ${months} tháng tuổi\n\n` +
      `👇 Chọn độ tuổi để nhận gợi ý:`,
      giftAgeKeyboard
    );
  } else {
    await safeSendMessage(
      chatId,
      `🎁 Gợi ý quà tặng:\n\n👇 Chọn độ tuổi của bé để nhận gợi ý phù hợp:`,
      giftAgeKeyboard
    );
  }
};

/**
 * Gợi ý quà theo tháng tuổi
 */
const handleGiftSuggest = async (chatId, months) => {
  await safeSendMessage(chatId, '🎁 Em đang tìm quà phù hợp cho bé...', {}, 'low');

  try {
    const suggestion = await suggestGiftWithAI(months);
    await safeSendMessage(
      chatId,
      `🎁 Gợi ý quà cho bé ${months} tháng tuổi:\n\n${suggestion}\n\n👇 Chọn độ tuổi khác:`,
      giftAgeKeyboard
    );
  } catch (error) {
    console.error('Lỗi gợi ý quà AI:', error);
    await safeSendMessage(
      chatId,
      '🎁 Em đang bận một chút. Bố/mẹ thử lại sau ít phút nhé!',
      giftAgeKeyboard
    );
  }
};

/**
 * Đăng ký handlers cho gift
 */
export const registerGiftHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    if (msg.text === '🎁 Gợi ý quà') {
      clearState(msg.chat.id);
      await showGiftMenu(msg.chat.id);
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data.startsWith('gift_')) {
      const months = parseInt(query.data.replace('gift_', ''), 10);
      await bot.answerCallbackQuery(query.id, { text: `Đang tìm quà cho bé ${months} tháng...` });
      await handleGiftSuggest(chatId, months);
      return;
    }
  });

  // Commands
  bot.onText(/\/gift(?:\s+(\d+))?/, async (msg, match) => {
    clearState(msg.chat.id);
    const months = match?.[1] ? parseInt(match[1], 10) : null;
    if (months) {
      await handleGiftSuggest(msg.chat.id, months);
    } else {
      await showGiftMenu(msg.chat.id);
    }
  });
};

export default registerGiftHandler;
