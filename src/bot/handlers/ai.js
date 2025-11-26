import { bot, safeSendMessage } from '../index.js';
import { aiQuickKeyboard, mainKeyboard } from '../keyboard.js';
import { askGemini } from '../../services/aiService.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';

// Các câu hỏi nhanh
const quickQuestions = {
  ai_sleep: 'Bé ngủ bao nhiêu giờ mỗi ngày là đủ? Làm sao để bé ngủ ngon hơn?',
  ai_milk: 'Bé cần uống bao nhiêu sữa mỗi ngày? Khoảng cách giữa các cữ bú nên là bao lâu?',
  ai_health: 'Dấu hiệu nào cho thấy bé bị ốm cần đưa đi khám? Cách chăm sóc bé khi bị cảm?',
  ai_fever: 'Nhiệt độ bao nhiêu là sốt? Khi nào cần đưa bé đi cấp cứu?'
};

/**
 * Hiển thị menu AI
 */
const showAiMenu = async (chatId) => {
  await safeSendMessage(
    chatId,
    `🤖 Chat với AI:\n\n` +
    `Em có thể tư vấn cho bố/mẹ về:\n` +
    `• Giấc ngủ của bé\n` +
    `• Chế độ sữa & ăn dặm\n` +
    `• Sức khỏe & bệnh thường gặp\n` +
    `• Và nhiều câu hỏi khác!\n\n` +
    `👇 Chọn chủ đề hoặc nhập câu hỏi tự do:`,
    aiQuickKeyboard
  );
};

/**
 * Xử lý câu hỏi AI
 */
const handleAiQuestion = async (chatId, question) => {
  if (!question || question.trim().length < 3) {
    await safeSendMessage(chatId, '🤖 Bố/mẹ hỏi gì em nhỉ? Nhập câu hỏi dài hơn nhé!');
    return;
  }

  await safeSendMessage(chatId, '🤖 Em đang suy nghĩ...', {}, 'low');

  try {
    const answer = await askGemini(question);
    await safeSendMessage(
      chatId,
      `🤖 ${answer}\n\n👇 Hỏi thêm câu khác:`,
      aiQuickKeyboard
    );
  } catch (error) {
    console.error('Lỗi AI:', error);
    await safeSendMessage(
      chatId,
      '🤖 Em đang bận một chút. Bố/mẹ thử lại sau ít phút nhé!',
      aiQuickKeyboard
    );
  }
};

/**
 * Đăng ký handlers cho AI
 */
export const registerAiHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    if (text === '🤖 Chat AI') {
      clearState(chatId);
      await showAiMenu(chatId);
      return;
    }
    
    // Xử lý câu hỏi từ user đang chờ
    const state = getState(chatId);
    if (state?.type === 'ai_question') {
      clearState(chatId);
      await handleAiQuestion(chatId, text);
      return;
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    // Xử lý câu hỏi nhanh
    if (quickQuestions[query.data]) {
      await bot.answerCallbackQuery(query.id, { text: 'Đang trả lời...' });
      await handleAiQuestion(chatId, quickQuestions[query.data]);
      return;
    }
    
    // Nhập câu hỏi tự do
    if (query.data === 'ai_custom') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'ai_question' });
      await safeSendMessage(chatId, '🤖 Nhập câu hỏi của bố/mẹ:\n\nVí dụ: Bé 6 tháng nên ăn dặm như thế nào?');
      return;
    }
  });

  // Command /ai
  bot.onText(/\/ai(?:\s+(.+))?/, async (msg, match) => {
    clearState(msg.chat.id);
    const question = match?.[1];
    if (question) {
      await handleAiQuestion(msg.chat.id, question);
    } else {
      await showAiMenu(msg.chat.id);
    }
  });
};

export default registerAiHandler;
