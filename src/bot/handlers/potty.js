import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { PottyLog } from '../../database/models/index.js';
import { mainKeyboard, pottyInlineKeyboard } from '../keyboard.js';
import { clearState } from '../../utils/stateManager.js';
import { getGroupChatIds, notifySyncMembers } from './sync.js';

/**
 * Ghi nhận tè
 */
const handlePee = async (chatId) => {
  // Lấy primary chatId để lưu dữ liệu chung
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  
  await PottyLog.create({ chatId: primaryChatId, type: 'pee' });
  const today = await PottyLog.countDocuments({
    chatId: { $in: groupChatIds },
    type: 'pee',
    recordedAt: { $gte: dayjs().startOf('day').toDate() }
  });
  await safeSendMessage(
    chatId,
    `💧 Đã ghi nhận bé tè! (Hôm nay: ${today} lần)\n\n💡 Bấm nút bên dưới để ghi tiếp:`,
    pottyInlineKeyboard
  );
  
  // Thông báo cho thành viên khác
  await notifySyncMembers(chatId, `Bé vừa tè (hôm nay: ${today} lần)`);
};

/**
 * Ghi nhận ị
 */
const handlePoo = async (chatId) => {
  // Lấy primary chatId để lưu dữ liệu chung
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  
  await PottyLog.create({ chatId: primaryChatId, type: 'poo' });
  const today = await PottyLog.countDocuments({
    chatId: { $in: groupChatIds },
    type: 'poo',
    recordedAt: { $gte: dayjs().startOf('day').toDate() }
  });
  await safeSendMessage(
    chatId,
    `💩 Đã ghi nhận bé ị! (Hôm nay: ${today} lần)\n\n💡 Bấm nút bên dưới để ghi tiếp:`,
    pottyInlineKeyboard
  );
  
  // Thông báo cho thành viên khác
  await notifySyncMembers(chatId, `Bé vừa ị (hôm nay: ${today} lần)`);
};

/**
 * Hiển thị menu potty
 */
const showPottyMenu = async (chatId) => {
  // Lấy tất cả chatId trong nhóm
  const groupChatIds = await getGroupChatIds(chatId);
  
  // Lấy số liệu hôm nay từ cả nhóm
  const today = dayjs().startOf('day').toDate();
  const [peeCount, pooCount] = await Promise.all([
    PottyLog.countDocuments({ chatId: { $in: groupChatIds }, type: 'pee', recordedAt: { $gte: today } }),
    PottyLog.countDocuments({ chatId: { $in: groupChatIds }, type: 'poo', recordedAt: { $gte: today } })
  ]);

  await safeSendMessage(
    chatId,
    `💩 Theo dõi bé tè/ị:\n\n` +
    `📊 Hôm nay: 💧 ${peeCount} lần tè • 💩 ${pooCount} lần ị\n\n` +
    `👇 Bấm nút để ghi nhận:`,
    pottyInlineKeyboard
  );
};

/**
 * Đăng ký handlers cho potty
 */
export const registerPottyHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    if (msg.text === '💩 Bé đi tè / đi ị') {
      clearState(msg.chat.id);
      await showPottyMenu(msg.chat.id);
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'potty_pee') {
      await bot.answerCallbackQuery(query.id, { text: '💧 Đã ghi nhận!' });
      await handlePee(chatId);
      return;
    }
    
    if (query.data === 'potty_poo') {
      await bot.answerCallbackQuery(query.id, { text: '💩 Đã ghi nhận!' });
      await handlePoo(chatId);
      return;
    }
  });

  // Commands
  bot.onText(/\/pee/, async (msg) => {
    clearState(msg.chat.id);
    await handlePee(msg.chat.id);
  });

  bot.onText(/\/poo/, async (msg) => {
    clearState(msg.chat.id);
    await handlePoo(msg.chat.id);
  });
};

export default registerPottyHandler;
