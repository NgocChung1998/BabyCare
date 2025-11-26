import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { VaccineSchedule } from '../../database/models/index.js';
import { vaccineInlineKeyboard, buildInlineKeyboard } from '../keyboard.js';
import { parseDate } from '../../utils/validators.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';

// Danh sách vaccine phổ biến
const commonVaccines = [
  '5in1', '6in1', 'BCG', 'Viêm gan B', 'Rotavirus', 
  'Phế cầu', 'Sởi-Quai bị-Rubella', 'Thủy đậu', 'Viêm não Nhật Bản'
];

/**
 * Hiển thị menu vaccine
 */
const showVaccineMenu = async (chatId) => {
  const upcoming = await VaccineSchedule.find({
    chatId,
    date: { $gte: new Date() }
  }).sort({ date: 1 }).limit(3);

  let upcomingText = '📅 Chưa có lịch tiêm sắp tới';
  if (upcoming.length) {
    upcomingText = '📅 Sắp tới:\n' + upcoming.map((item) => {
      const date = dayjs(item.date).format('DD/MM/YYYY');
      const daysLeft = dayjs(item.date).diff(dayjs(), 'day');
      return `• ${date} - ${item.vaccineName} (còn ${daysLeft} ngày)`;
    }).join('\n');
  }

  await safeSendMessage(
    chatId,
    `💉 Lịch tiêm chủng:\n\n${upcomingText}\n\n👇 Bấm nút để quản lý:`,
    vaccineInlineKeyboard
  );
};

/**
 * Thêm lịch tiêm
 */
const handleVaccineAdd = async (chatId, dateText, vaccineName) => {
  const date = parseDate(dateText);
  if (!date) {
    await safeSendMessage(chatId, '💉 Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD hoặc DD/MM/YYYY nhé.');
    return;
  }
  await VaccineSchedule.create({
    chatId,
    vaccineName: vaccineName.trim(),
    date: date.toDate()
  });
  await safeSendMessage(
    chatId,
    `💉 Đã lưu lịch tiêm ${vaccineName.trim()} vào ${date.format('DD/MM/YYYY')}.\n\n🔔 Em sẽ nhắc bố/mẹ trước 3 ngày và đúng ngày nhé!\n\n👇 Bấm nút để tiếp tục:`,
    vaccineInlineKeyboard
  );
};

/**
 * Xem danh sách lịch tiêm
 */
const handleVaccineList = async (chatId) => {
  const schedules = await VaccineSchedule.find({ chatId }).sort({ date: 1 });
  if (!schedules.length) {
    await safeSendMessage(
      chatId,
      '💉 Chưa có lịch tiêm nào.\n\n👇 Bấm nút để thêm:',
      vaccineInlineKeyboard
    );
    return;
  }
  
  const now = dayjs();
  const upcoming = schedules.filter((s) => dayjs(s.date).isAfter(now));
  const past = schedules.filter((s) => dayjs(s.date).isBefore(now));
  
  let message = '💉 Lịch tiêm của bé:\n\n';
  
  if (upcoming.length) {
    message += '📅 Sắp tới:\n';
    message += upcoming.map((item) => {
      const date = dayjs(item.date).format('DD/MM/YYYY');
      const daysLeft = dayjs(item.date).diff(now, 'day');
      return `• ${date} - ${item.vaccineName} (còn ${daysLeft} ngày)`;
    }).join('\n');
    message += '\n\n';
  }
  
  if (past.length) {
    message += '✅ Đã tiêm:\n';
    message += past.slice(-5).map((item) => {
      const date = dayjs(item.date).format('DD/MM/YYYY');
      return `• ${date} - ${item.vaccineName}`;
    }).join('\n');
  }
  
  message += '\n\n👇 Bấm nút để quản lý:';
  
  await safeSendMessage(chatId, message, vaccineInlineKeyboard);
};

/**
 * Hiển thị danh sách vaccine phổ biến để chọn
 */
const showVaccineSelection = async (chatId) => {
  const buttons = [];
  for (let i = 0; i < commonVaccines.length; i += 2) {
    const row = [{ text: commonVaccines[i], callback_data: `vaccine_select_${i}` }];
    if (commonVaccines[i + 1]) {
      row.push({ text: commonVaccines[i + 1], callback_data: `vaccine_select_${i + 1}` });
    }
    buttons.push(row);
  }
  buttons.push([{ text: '✏️ Nhập tên khác', callback_data: 'vaccine_custom' }]);
  
  await safeSendMessage(
    chatId,
    '💉 Chọn loại vaccine:',
    buildInlineKeyboard(buttons)
  );
};

/**
 * Đăng ký handlers cho vaccine
 */
export const registerVaccineHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    if (text === '💉 Lịch tiêm chủng') {
      clearState(chatId);
      await showVaccineMenu(chatId);
      return;
    }
    
    // Xử lý input từ user đang chờ
    const state = getState(chatId);
    if (state?.type === 'vaccine_date') {
      const date = parseDate(text);
      if (!date) {
        await safeSendMessage(chatId, '💉 Ngày không hợp lệ. Nhập lại theo định dạng YYYY-MM-DD hoặc DD/MM/YYYY:');
        return;
      }
      clearState(chatId);
      setState(chatId, { type: 'vaccine_name', date: text });
      await showVaccineSelection(chatId);
      return;
    }
    
    if (state?.type === 'vaccine_name') {
      const date = state.date;
      clearState(chatId);
      await handleVaccineAdd(chatId, date, text);
      return;
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'vaccine_add') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'vaccine_date' });
      await safeSendMessage(
        chatId,
        '💉 Nhập ngày tiêm:\n\nVí dụ: 2025-03-10 hoặc 10/03/2025'
      );
      return;
    }
    
    if (query.data === 'vaccine_list') {
      await bot.answerCallbackQuery(query.id);
      await handleVaccineList(chatId);
      return;
    }
    
    if (query.data.startsWith('vaccine_select_')) {
      const index = parseInt(query.data.replace('vaccine_select_', ''), 10);
      const vaccineName = commonVaccines[index];
      const state = getState(chatId);
      if (state?.date) {
        await bot.answerCallbackQuery(query.id, { text: `Đã chọn ${vaccineName}` });
        const date = state.date;
        clearState(chatId);
        await handleVaccineAdd(chatId, date, vaccineName);
      }
      return;
    }
    
    if (query.data === 'vaccine_custom') {
      await bot.answerCallbackQuery(query.id);
      const state = getState(chatId);
      if (state) {
        setState(chatId, { type: 'vaccine_name', date: state.date });
        await safeSendMessage(chatId, '💉 Nhập tên vaccine:');
      }
      return;
    }
  });

  // Commands
  bot.onText(/\/vaccine\s+add\s+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s+(.+)/, async (msg, match) => {
    clearState(msg.chat.id);
    await handleVaccineAdd(msg.chat.id, match?.[1], match?.[2]);
  });

  bot.onText(/\/vaccine\s+list/, async (msg) => {
    clearState(msg.chat.id);
    await handleVaccineList(msg.chat.id);
  });
  
  // /vaccine không có tham số -> hiển thị menu
  bot.onText(/\/vaccine\s*$/, async (msg) => {
    clearState(msg.chat.id);
    await showVaccineMenu(msg.chat.id);
  });
};

export default registerVaccineHandler;
