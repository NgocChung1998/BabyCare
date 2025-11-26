import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { DiaperLog, SupplementLog } from '../../database/models/index.js';
import { diaperInlineKeyboard } from '../keyboard.js';
import { setDiaperReminder } from '../../services/reminderService.js';
import { clearState } from '../../utils/stateManager.js';

/**
 * Hiển thị menu diaper
 */
const showDiaperMenu = async (chatId) => {
  const today = dayjs().startOf('day').toDate();
  const [diaperCount, vdToday] = await Promise.all([
    DiaperLog.countDocuments({ chatId, recordedAt: { $gte: today } }),
    SupplementLog.findOne({ chatId, type: 'vitaminD', recordedAt: { $gte: today } })
  ]);

  await safeSendMessage(
    chatId,
    `🧷 Thay tã & Vitamin D:\n\n` +
    `🧷 Hôm nay: ${diaperCount} lần thay tã\n` +
    `☀️ Vitamin D: ${vdToday ? '✅ Đã uống' : '❌ Chưa uống'}\n\n` +
    `👇 Bấm nút để ghi nhận:`,
    diaperInlineKeyboard
  );
};

/**
 * Ghi nhận thay tã
 */
const handleDiaperLog = async (chatId) => {
  await DiaperLog.create({ chatId });
  
  // Đặt nhắc sau 3-4 tiếng
  setDiaperReminder(chatId, () => {
    safeSendMessage(chatId, '🧷 Đã 3-4 tiếng rồi, bố/mẹ kiểm tra tã cho bé nhé!', {}, 'normal').catch((error) =>
      console.error('Lỗi nhắc tã:', error)
    );
  });

  const today = await DiaperLog.countDocuments({
    chatId,
    recordedAt: { $gte: dayjs().startOf('day').toDate() }
  });

  await safeSendMessage(
    chatId,
    `🧷 Đã ghi nhận thay tã! (Hôm nay: ${today} lần)\n\n🔔 Em sẽ nhắc sau 3-4 tiếng nữa nhé!\n\n👇 Bấm nút để tiếp tục:`,
    diaperInlineKeyboard
  );
};

/**
 * Ghi nhận Vitamin D
 */
const handleVitaminD = async (chatId) => {
  const today = dayjs().startOf('day').toDate();
  const existing = await SupplementLog.findOne({ chatId, type: 'vitaminD', recordedAt: { $gte: today } });
  
  if (existing) {
    await safeSendMessage(
      chatId,
      '☀️ Hôm nay bé đã uống Vitamin D rồi nhé!\n\n👇 Bấm nút để tiếp tục:',
      diaperInlineKeyboard
    );
    return;
  }

  await SupplementLog.create({ chatId, type: 'vitaminD' });
  await safeSendMessage(
    chatId,
    '☀️ Đã ghi nhận bé uống Vitamin D hôm nay!\n\n💡 Vitamin D giúp bé hấp thụ canxi tốt hơn.\n\n👇 Bấm nút để tiếp tục:',
    diaperInlineKeyboard
  );
};

/**
 * Đăng ký handlers cho diaper
 */
export const registerDiaperHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    if (msg.text === '🧷 Thay tã') {
      clearState(msg.chat.id);
      await showDiaperMenu(msg.chat.id);
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'diaper_log') {
      await bot.answerCallbackQuery(query.id, { text: '🧷 Đã ghi nhận!' });
      await handleDiaperLog(chatId);
      return;
    }
    
    if (query.data === 'supplement_vd') {
      await bot.answerCallbackQuery(query.id, { text: '☀️ Đã ghi nhận!' });
      await handleVitaminD(chatId);
      return;
    }
  });

  // Commands
  bot.onText(/\/diaper/, async (msg) => {
    clearState(msg.chat.id);
    await handleDiaperLog(msg.chat.id);
  });

  bot.onText(/\/vd/, async (msg) => {
    clearState(msg.chat.id);
    await handleVitaminD(msg.chat.id);
  });
};

export default registerDiaperHandler;
