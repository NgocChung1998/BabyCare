import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { Feeding } from '../../database/models/index.js';
import { mainKeyboard, buildInlineKeyboard } from '../keyboard.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';
import { setMilkReminder } from '../../services/reminderService.js';
import { sleepSessionTracker } from './sleep.js';

/**
 * Parse thời gian từ input đơn giản
 */
const parseSimpleTime = (input) => {
  if (!input) return null;
  const text = input.trim();
  
  const fullMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (fullMatch) {
    const h = parseInt(fullMatch[1], 10);
    const m = parseInt(fullMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }
  
  const hourOnly = text.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const h = parseInt(hourOnly[1], 10);
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, '0')}:00`;
    }
    return null;
  }
  
  const spaceFormat = text.match(/^(\d{1,2})\s+(\d{1,2})$/);
  if (spaceFormat) {
    const h = parseInt(spaceFormat[1], 10);
    const m = parseInt(spaceFormat[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }
  
  return null;
};

/**
 * Tạo các button thời gian để chọn
 */
const generateTimeButtons = (minutesBefore = 25, stepMinutes = 5, prefix = 'milk') => {
  const now = dayjs();
  const row1 = [];
  const row2 = [];
  let count = 0;
  
  for (let i = minutesBefore; i >= 0; i -= stepMinutes) {
    const time = now.subtract(i, 'minute');
    const timeStr = time.format('HH:mm');
    const btn = { text: timeStr, callback_data: `${prefix}_time_${timeStr}` };
    
    if (count < 3) {
      row1.push(btn);
    } else {
      row2.push(btn);
    }
    count++;
  }
  
  const result = [row1];
  if (row2.length) result.push(row2);
  result.push([{ text: '✏️ Nhập giờ khác', callback_data: `${prefix}_custom_time` }]);
  result.push([{ text: '❌ Hủy', callback_data: `${prefix}_cancel` }]);
  
  return buildInlineKeyboard(result);
};

// Các mức ml để chọn
const MILK_AMOUNTS = [120, 150, 170, 180, 200, 220, 250, 300];

/**
 * Hiển thị menu ăn với trạng thái
 */
const showMilkMenu = async (chatId) => {
  const lastFeed = await Feeding.findOne({ chatId }).sort({ recordedAt: -1 });
  const isSleeping = sleepSessionTracker.has(chatId);
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '🍼 GHI NHẬN CỮ ĂN',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];
  
  // Trạng thái ngủ
  if (isSleeping) {
    const startTime = sleepSessionTracker.get(chatId);
    const startStr = dayjs(startTime).format('HH:mm');
    lines.push(`😴 Bé đang ngủ (từ ${startStr})`);
    lines.push('');
  }
  
  // Cữ ăn gần nhất
  if (lastFeed) {
    const feedTime = dayjs(lastFeed.recordedAt);
    const feedTimeStr = feedTime.format('HH:mm');
    const minutesSince = Math.round((Date.now() - feedTime.toDate().getTime()) / 60000);
    const hoursSince = Math.floor(minutesSince / 60);
    const minsSince = minutesSince % 60;
    
    let sinceStr;
    if (hoursSince > 0) {
      sinceStr = `${hoursSince}h${minsSince > 0 ? `${minsSince}p` : ''} trước`;
    } else {
      sinceStr = `${minsSince}p trước`;
    }
    
    // Dự đoán cữ tiếp theo (3-3.5h)
    const nextFeedTime = feedTime.add(3, 'hour').format('HH:mm');
    const nextFeedTime2 = feedTime.add(3.5, 'hour').format('HH:mm');
    
    lines.push(`🍼 Cữ gần nhất: ${feedTimeStr} (${lastFeed.amountMl}ml)`);
    lines.push(`   └─ ${sinceStr}`);
    lines.push('');
    lines.push(`⏰ Cữ tiếp theo: ~${nextFeedTime} - ${nextFeedTime2}`);
  } else {
    lines.push('📋 Chưa có cữ ăn nào được ghi nhận');
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('👇 Chọn lượng sữa:');
  
  // Tạo keyboard chọn ml
  const amountButtons = [];
  for (let i = 0; i < MILK_AMOUNTS.length; i += 4) {
    const row = [];
    for (let j = i; j < i + 4 && j < MILK_AMOUNTS.length; j++) {
      row.push({ 
        text: `${MILK_AMOUNTS[j]}ml`, 
        callback_data: `milk_amount_${MILK_AMOUNTS[j]}` 
      });
    }
    amountButtons.push(row);
  }
  amountButtons.push([{ text: '✏️ Nhập số khác', callback_data: 'milk_custom_amount' }]);
  amountButtons.push([{ text: '📝 Sửa giờ cữ trước', callback_data: 'milk_edit_time' }]);
  
  await safeSendMessage(chatId, lines.join('\n'), buildInlineKeyboard(amountButtons));
};

/**
 * Ghi nhận cữ ăn
 */
const handleMilkLog = async (chatId, amountMl, timeStr = null) => {
  if (!amountMl || amountMl <= 0) {
    await safeSendMessage(chatId, '❌ Số ml không hợp lệ!', mainKeyboard);
    return;
  }
  
  let recordedAt;
  if (timeStr) {
    const now = dayjs();
    recordedAt = dayjs(`${now.format('YYYY-MM-DD')} ${timeStr}`).toDate();
  } else {
    recordedAt = new Date();
  }
  
  await Feeding.create({ chatId, amountMl, recordedAt });
  
  const timeDisplay = dayjs(recordedAt).format('HH:mm');
  
  // Đặt nhắc nhở sau 2.5h
  setMilkReminder(chatId, 150); // 150 phút = 2.5h
  
  const nextFeedTime = dayjs(recordedAt).add(2.5, 'hour').format('HH:mm');
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '✅ ĐÃ GHI NHẬN',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🍼 ${amountMl}ml lúc ${timeDisplay}`,
    '',
    `⏰ Nhắc cữ tiếp: ~${nextFeedTime}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━'
  ];
  
  await safeSendMessage(chatId, lines.join('\n'), mainKeyboard);
};

/**
 * Đăng ký handlers cho milk
 */
export const registerMilkHandler = () => {
  // Bấm nút "🍼 Ăn" -> hiển thị menu chọn ml
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();
    
    if (text === '🍼 Ăn') {
      clearState(msg.chat.id);
      await showMilkMenu(msg.chat.id);
      return;
    }
  });

  // Command /milk
  bot.onText(/\/milk\s+(\d+)\s*(?:ml)?/i, async (msg, match) => {
    const chatId = msg.chat.id;
    clearState(chatId);
    const amount = parseInt(match?.[1], 10);
    await handleMilkLog(chatId, amount);
  });

  bot.onText(/\/milk\s*$/, async (msg) => {
    clearState(msg.chat.id);
    await showMilkMenu(msg.chat.id);
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    // Chọn lượng ml
    if (query.data.startsWith('milk_amount_')) {
      const amount = parseInt(query.data.replace('milk_amount_', ''), 10);
      await bot.answerCallbackQuery(query.id, { text: `🍼 Ghi nhận ${amount}ml` });
      await handleMilkLog(chatId, amount);
      return;
    }
    
    // Nhập số ml thủ công
    if (query.data === 'milk_custom_amount') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'milk_input_amount' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập số ml:\n\nVí dụ: 160'
      );
      return;
    }
    
    // Sửa giờ cữ trước - hiển thị các button chọn giờ
    if (query.data === 'milk_edit_time') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'milk_select_time_for_edit' });
      await safeSendMessage(
        chatId,
        '✏️ THÊM/SỬA CỮ ĂN\n\n⏰ Bé ăn lúc mấy giờ?\n\n👇 Chọn giờ:',
        generateTimeButtons(30, 5, 'milk_edit')
      );
      return;
    }
    
    // Chọn giờ cho việc sửa
    if (query.data.startsWith('milk_edit_time_')) {
      const timeStr = query.data.replace('milk_edit_time_', '');
      await bot.answerCallbackQuery(query.id, { text: `⏰ Giờ: ${timeStr}` });
      setState(chatId, { type: 'milk_input_amount_for_edit', timeStr });
      
      // Hiển thị keyboard chọn ml
      const amountButtons = [];
      for (let i = 0; i < MILK_AMOUNTS.length; i += 4) {
        const row = [];
        for (let j = i; j < i + 4 && j < MILK_AMOUNTS.length; j++) {
          row.push({ 
            text: `${MILK_AMOUNTS[j]}ml`, 
            callback_data: `milk_edit_amount_${MILK_AMOUNTS[j]}` 
          });
        }
        amountButtons.push(row);
      }
      amountButtons.push([{ text: '✏️ Nhập số khác', callback_data: 'milk_edit_custom_amount' }]);
      amountButtons.push([{ text: '❌ Hủy', callback_data: 'milk_cancel' }]);
      
      await safeSendMessage(
        chatId,
        `⏰ Giờ ăn: ${timeStr}\n\n👇 Chọn số ml:`,
        buildInlineKeyboard(amountButtons)
      );
      return;
    }
    
    // Chọn ml cho việc sửa
    if (query.data.startsWith('milk_edit_amount_')) {
      const amount = parseInt(query.data.replace('milk_edit_amount_', ''), 10);
      const state = getState(chatId);
      const timeStr = state?.timeStr;
      
      await bot.answerCallbackQuery(query.id, { text: `🍼 ${amount}ml lúc ${timeStr}` });
      clearState(chatId);
      await handleMilkLog(chatId, amount, timeStr);
      return;
    }
    
    // Nhập ml thủ công cho việc sửa
    if (query.data === 'milk_edit_custom_amount') {
      await bot.answerCallbackQuery(query.id);
      const state = getState(chatId);
      setState(chatId, { type: 'milk_edit_input_amount', timeStr: state?.timeStr });
      await safeSendMessage(chatId, '✏️ Nhập số ml:\n\nVí dụ: 160');
      return;
    }
    
    // Nhập giờ thủ công
    if (query.data === 'milk_edit_custom_time') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'milk_edit_input_time' });
      await safeSendMessage(
        chatId,
        '✏️ Nhập giờ bé ăn:\n\n📝 Ví dụ:\n• 9 → 09:00\n• 9 30 → 09:30\n• 14:15 → 14:15'
      );
      return;
    }
    
    // Hủy
    if (query.data === 'milk_cancel' || query.data === 'milk_edit_cancel') {
      await bot.answerCallbackQuery(query.id, { text: 'Đã hủy' });
      clearState(chatId);
      await showMilkMenu(chatId);
      return;
    }
  });
  
  // Xử lý input
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const state = getState(chatId);
    
    // Nhập ml thông thường
    if (state?.type === 'milk_input_amount') {
      const amount = parseInt(text, 10);
      if (isNaN(amount) || amount <= 0) {
        await safeSendMessage(chatId, '❌ Số không hợp lệ! Nhập lại số ml (ví dụ: 160)');
        return;
      }
      clearState(chatId);
      await handleMilkLog(chatId, amount);
      return;
    }
    
    // Nhập ml cho việc sửa (đã có giờ)
    if (state?.type === 'milk_edit_input_amount') {
      const amount = parseInt(text, 10);
      if (isNaN(amount) || amount <= 0) {
        await safeSendMessage(chatId, '❌ Số không hợp lệ! Nhập lại số ml (ví dụ: 160)');
        return;
      }
      const timeStr = state.timeStr;
      clearState(chatId);
      await handleMilkLog(chatId, amount, timeStr);
      return;
    }
    
    // Nhập giờ thủ công
    if (state?.type === 'milk_edit_input_time') {
      const timeStr = parseSimpleTime(text);
      if (!timeStr) {
        await safeSendMessage(
          chatId, 
          '❌ Không hiểu!\n\nNhập lại:\n• 9 → 09:00\n• 9 30 → 09:30\n• 14:15 → 14:15'
        );
        return;
      }
      
      setState(chatId, { type: 'milk_input_amount_for_edit', timeStr });
      
      // Hiển thị keyboard chọn ml
      const amountButtons = [];
      for (let i = 0; i < MILK_AMOUNTS.length; i += 4) {
        const row = [];
        for (let j = i; j < i + 4 && j < MILK_AMOUNTS.length; j++) {
          row.push({ 
            text: `${MILK_AMOUNTS[j]}ml`, 
            callback_data: `milk_edit_amount_${MILK_AMOUNTS[j]}` 
          });
        }
        amountButtons.push(row);
      }
      amountButtons.push([{ text: '✏️ Nhập số khác', callback_data: 'milk_edit_custom_amount' }]);
      amountButtons.push([{ text: '❌ Hủy', callback_data: 'milk_cancel' }]);
      
      await safeSendMessage(
        chatId,
        `⏰ Giờ ăn: ${timeStr}\n\n👇 Chọn số ml:`,
        buildInlineKeyboard(amountButtons)
      );
      return;
    }
  });
};

export { showMilkMenu };
export default registerMilkHandler;
