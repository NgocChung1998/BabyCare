import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { DiaperLog, SupplementLog } from '../../database/models/index.js';
import { diaperInlineKeyboard, mainKeyboard } from '../keyboard.js';
import { setDiaperReminder } from '../../services/reminderService.js';
import { clearState } from '../../utils/stateManager.js';
import { getGroupChatIds, notifySyncMembers } from './sync.js';

/**
 * Gửi nhắc tã cho cả nhóm
 */
const sendDiaperReminderToGroup = async (chatId, message) => {
  const groupChatIds = await getGroupChatIds(chatId);
  for (const memberId of groupChatIds) {
    try {
      await safeSendMessage(memberId, message, mainKeyboard);
    } catch (error) {
      console.error(`[Diaper] Error sending reminder to ${memberId}:`, error);
    }
  }
};

/**
 * Hiển thị menu diaper
 */
const showDiaperMenu = async (chatId) => {
  // Lấy tất cả chatId trong nhóm
  const groupChatIds = await getGroupChatIds(chatId);
  
  const today = dayjs().startOf('day').toDate();
  const [diaperCount, vdToday] = await Promise.all([
    DiaperLog.countDocuments({ chatId: { $in: groupChatIds }, recordedAt: { $gte: today } }),
    SupplementLog.findOne({ chatId: { $in: groupChatIds }, type: 'vitaminD', recordedAt: { $gte: today } })
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
  // Lấy primary chatId để lưu dữ liệu chung
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  
  await DiaperLog.create({ chatId: primaryChatId });
  
  // Đặt nhắc sau 3-4 tiếng cho cả nhóm
  setDiaperReminder(primaryChatId, () => {
    sendDiaperReminderToGroup(chatId, '🧷 Đã 3-4 tiếng rồi, bố/mẹ kiểm tra tã cho bé nhé!').catch((error) =>
      console.error('Lỗi nhắc tã:', error)
    );
  });

  const today = await DiaperLog.countDocuments({
    chatId: { $in: groupChatIds },
    recordedAt: { $gte: dayjs().startOf('day').toDate() }
  });

  await safeSendMessage(
    chatId,
    `🧷 Đã ghi nhận thay tã! (Hôm nay: ${today} lần)\n\n🔔 Em sẽ nhắc sau 3-4 tiếng nữa nhé!\n\n👇 Bấm nút để tiếp tục:`,
    diaperInlineKeyboard
  );
  
  // Thông báo cho thành viên khác
  await notifySyncMembers(chatId, `Đã thay tã cho bé (hôm nay: ${today} lần)`);
};

/**
 * Ghi nhận Vitamin D
 */
const handleVitaminD = async (chatId) => {
  // Lấy tất cả chatId trong nhóm
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  
  const today = dayjs().startOf('day').toDate();
  const existing = await SupplementLog.findOne({ chatId: { $in: groupChatIds }, type: 'vitaminD', recordedAt: { $gte: today } });
  
  if (existing) {
    await safeSendMessage(
      chatId,
      '☀️ Hôm nay bé đã uống Vitamin D rồi nhé!\n\n👇 Bấm nút để tiếp tục:',
      diaperInlineKeyboard
    );
    return;
  }

  await SupplementLog.create({ chatId: primaryChatId, type: 'vitaminD' });
  await safeSendMessage(
    chatId,
    '☀️ Đã ghi nhận bé uống Vitamin D hôm nay!\n\n💡 Vitamin D giúp bé hấp thụ canxi tốt hơn.\n\n👇 Bấm nút để tiếp tục:',
    diaperInlineKeyboard
  );
  
  // Thông báo cho thành viên khác
  await notifySyncMembers(chatId, 'Đã cho bé uống Vitamin D');
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
