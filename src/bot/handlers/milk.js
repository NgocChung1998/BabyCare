import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { Feeding } from '../../database/models/index.js';
import { mainKeyboard, milkAmountKeyboard } from '../keyboard.js';
import { setMilkReminder } from '../../services/reminderService.js';
import { parseFloatStrict } from '../../utils/validators.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';
import { CONSTANTS } from '../../config/index.js';
import { sleepSessionTracker } from './sleep.js';

/**
 * Hiển thị menu ăn với trạng thái
 */
const showMilkMenu = async (chatId) => {
  const today = dayjs().startOf('day').toDate();
  const [todayFeeds, totalMl] = await Promise.all([
    Feeding.countDocuments({ chatId, recordedAt: { $gte: today } }),
    Feeding.aggregate([
      { $match: { chatId, recordedAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amountMl' } } }
    ])
  ]);

  const total = totalMl[0]?.total || 0;
  const lastFeed = await Feeding.findOne({ chatId }).sort({ recordedAt: -1 });

  // Kiểm tra trạng thái ngủ
  const isSleeping = sleepSessionTracker.has(chatId);
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '🍼 GHI NHẬN BÉ ĂN',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `📊 Hôm nay: ${todayFeeds} lần • ${total}ml`,
    ''
  ];
  
  if (lastFeed) {
    const lastTime = dayjs(lastFeed.recordedAt).format('HH:mm');
    const nextTime = dayjs(lastFeed.recordedAt).add(CONSTANTS.MILK_INTERVAL_MINUTES, 'minute');
    const hoursUntilNext = Math.round(dayjs(nextTime).diff(dayjs(), 'hour', true));
    
    if (isSleeping) {
      const sleepStart = sleepSessionTracker.get(chatId);
      const sleepStartStr = dayjs(sleepStart).format('HH:mm');
      const elapsed = Math.round((Date.now() - sleepStart.getTime()) / 60000);
      const elapsedHours = Math.floor(elapsed / 60);
      const elapsedMins = elapsed % 60;
      const elapsedStr = elapsedHours > 0 
        ? `${elapsedHours}h${elapsedMins > 0 ? `${elapsedMins}p` : ''}`.trim()
        : `${elapsedMins}p`;
      
      lines.push('🟢 TRẠNG THÁI: ĐANG NGỦ');
      lines.push('');
      lines.push(`   └─ Từ ${sleepStartStr}, đã ${elapsedStr}`);
      lines.push('');
      lines.push(`🍼 Vừa ăn lúc: ${lastTime}`);
      lines.push(`   └─ ${lastFeed.amountMl}ml`);
    } else {
      lines.push('⚪ TRẠNG THÁI: ĐANG THỨC');
      lines.push('');
      lines.push(`⏰ Lần cuối: ${lastTime}`);
      lines.push(`⏰ Cữ tiếp: ~${nextTime.format('HH:mm')} (còn ~${hoursUntilNext}h)`);
    }
  } else {
    if (isSleeping) {
      const sleepStart = sleepSessionTracker.get(chatId);
      const sleepStartStr = dayjs(sleepStart).format('HH:mm');
      const elapsed = Math.round((Date.now() - sleepStart.getTime()) / 60000);
      const elapsedHours = Math.floor(elapsed / 60);
      const elapsedMins = elapsed % 60;
      const elapsedStr = elapsedHours > 0 
        ? `${elapsedHours}h${elapsedMins > 0 ? `${elapsedMins}p` : ''}`.trim()
        : `${elapsedMins}p`;
      
      lines.push('🟢 TRẠNG THÁI: ĐANG NGỦ');
      lines.push('');
      lines.push(`   └─ Từ ${sleepStartStr}, đã ${elapsedStr}`);
      lines.push('');
      lines.push('🍼 Chưa có dữ liệu ăn hôm nay');
    } else {
      lines.push('⚪ TRẠNG THÁI: ĐANG THỨC');
      lines.push('');
      lines.push('⏰ Chưa có dữ liệu ăn hôm nay');
    }
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('👇 Chọn lượng sữa:');

  await safeSendMessage(
    chatId,
    lines.join('\n'),
    milkAmountKeyboard
  );
};

/**
 * Đặt timer nhắc sữa
 */
const handleMilkReminder = async (chatId) => {
  setMilkReminder(chatId, () => {
    safeSendMessage(chatId, '🍼 Đến giờ pha sữa cho bé rồi bố/mẹ ơi!', {}, 'high').catch((error) =>
      console.error('Lỗi nhắc sữa:', error)
    );
  });
  await safeSendMessage(
    chatId,
    '⏰ Đã đặt nhắc pha sữa trong 2.5 giờ nữa nhé!\n\n👇 Chọn lượng sữa:',
    milkAmountKeyboard
  );
};

/**
 * Ghi nhận lượng sữa và tự động đặt nhắc
 */
const handleMilkLog = async (chatId, amount) => {
  const amountNum = typeof amount === 'string' ? parseFloatStrict(amount.replace(/ml/i, '')) : amount;
  
  if (!amountNum || amountNum <= 0) {
    await safeSendMessage(
      chatId,
      '🍼 Vui lòng nhập lượng sữa hợp lệ (ml).\n\n👇 Chọn từ menu hoặc nhập số:',
      milkAmountKeyboard
    );
    return;
  }

  await Feeding.create({ chatId, amountMl: amountNum });
  console.info(`[Milk] ${chatId} ghi ${amountNum}ml`);

  // Tự động đặt nhắc pha sữa sau 2.5 giờ
  setMilkReminder(chatId, () => {
    safeSendMessage(chatId, '🍼 Đến giờ pha sữa cho bé rồi bố/mẹ ơi!', {}, 'high').catch((error) =>
      console.error('Lỗi nhắc sữa:', error)
    );
  });

  const today = dayjs().startOf('day').toDate();
  const [todayCount, todayTotal] = await Promise.all([
    Feeding.countDocuments({ chatId, recordedAt: { $gte: today } }),
    Feeding.aggregate([
      { $match: { chatId, recordedAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amountMl' } } }
    ])
  ]);

  const total = todayTotal[0]?.total || 0;
  const nextTime = dayjs().add(CONSTANTS.MILK_INTERVAL_MINUTES, 'minute');

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '✅ GHI NHẬN THÀNH CÔNG',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🍼 Lượng sữa: ${amountNum}ml`,
    '',
    `📊 Hôm nay: ${todayCount} lần • ${total}ml`,
    `⏰ Cữ tiếp theo: ~${nextTime.format('HH:mm')}`,
    `🔔 Đã đặt nhắc pha sữa sau 2.5 giờ`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '👇 Chọn lượng sữa tiếp theo:'
  ];

  await safeSendMessage(
    chatId,
    lines.join('\n'),
    milkAmountKeyboard
  );
};

/**
 * Đăng ký handlers cho milk
 */
export const registerMilkHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    // Bấm nút "🍼 Ăn" -> hiển thị menu chọn ml với trạng thái
    if (text === '🍼 Ăn') {
      clearState(chatId);
      await showMilkMenu(chatId);
      return;
    }
    
    // Gõ "a" để đặt timer
    if (text === 'a' || text === 'A') {
      clearState(chatId);
      await handleMilkReminder(chatId);
      return;
    }
    
    // Xử lý input từ user đang chờ nhập lượng sữa
    const state = getState(chatId);
    if (state?.type === 'milk_custom') {
      clearState(chatId);
      await handleMilkLog(chatId, text);
      return;
    }
    
    // Xử lý sửa giờ ăn
    if (state?.type === 'milk_edit_time') {
      clearState(chatId);
      // Parse: HH:mm SỐml
      const parts = text.split(/\s+/);
      const timeMatch = parts[0]?.match(/^(\d{1,2}):(\d{2})$/);
      
      if (!timeMatch) {
        await safeSendMessage(chatId, '❌ Sai định dạng. Nhập: HH:mm SỐml (ví dụ: 09:30 150)');
        return;
      }
      
      const newTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      const amount = parts[1] ? parseInt(parts[1], 10) : 150;
      
      // Tạo feeding record với thời gian đã sửa
      const now = dayjs();
      const newDateTime = dayjs(`${now.format('YYYY-MM-DD')} ${newTime}`);
      
      await Feeding.create({
        chatId,
        amountMl: amount,
        recordedAt: newDateTime.toDate(),
        note: `Sửa thủ công`
      });
      
      await safeSendMessage(
        chatId,
        `✅ Đã ghi nhận bữa ăn!\n\n⏰ Thời gian: ${newTime}\n🍼 Lượng sữa: ${amount}ml`,
        milkAmountKeyboard
      );
      return;
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    // Chọn lượng sữa từ button
    if (query.data.startsWith('milk_')) {
      const amount = query.data.replace('milk_', '');
      
      if (amount === 'reminder') {
        await bot.answerCallbackQuery(query.id, { text: '⏰ Đã đặt nhắc!' });
        await handleMilkReminder(chatId);
        return;
      }
      
      if (amount === 'custom') {
        await bot.answerCallbackQuery(query.id);
        setState(chatId, { type: 'milk_custom' });
        await safeSendMessage(chatId, '🍼 Nhập lượng sữa (ml):\n\nVí dụ: 180');
        return;
      }
      
      if (amount === 'edit_time') {
        await bot.answerCallbackQuery(query.id);
        setState(chatId, { type: 'milk_edit_time' });
        await safeSendMessage(
          chatId,
          '✏️ Sửa giờ ăn:\n\n' +
          'Nhập theo định dạng: HH:mm SỐml\n\n' +
          'Ví dụ:\n' +
          '• 09:30 150\n' +
          '• 14:00 180\n' +
          '• 07:00 120'
        );
        return;
      }
      
      const amountNum = parseInt(amount, 10);
      if (!isNaN(amountNum)) {
        await bot.answerCallbackQuery(query.id, { text: `🍼 Đã ghi ${amountNum}ml!` });
        await handleMilkLog(chatId, amountNum);
        return;
      }
    }
  });

  // Commands
  bot.onText(/\/milk(?:\s+(.+))?/, async (msg, match) => {
    clearState(msg.chat.id);
    if (match?.[1]) {
      await handleMilkLog(msg.chat.id, match[1]);
    } else {
      await showMilkMenu(msg.chat.id);
    }
  });
};

export default registerMilkHandler;
