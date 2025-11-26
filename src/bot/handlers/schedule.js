import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { DailySchedule } from '../../database/models/index.js';
import { DEFAULT_SCHEDULE_ITEMS } from '../../config/index.js';
import { scheduleInlineKeyboard, buildInlineKeyboard } from '../keyboard.js';
import { formatScheduleItems } from '../../utils/formatters.js';
import { isValidTime, normalizeScheduleType } from '../../utils/validators.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';

/**
 * Đảm bảo có schedule mặc định
 */
const ensureDefaultSchedule = async (chatId) => {
  const schedule = await DailySchedule.findOne({ chatId });
  if (schedule) return schedule;
  return DailySchedule.findOneAndUpdate(
    { chatId },
    { items: DEFAULT_SCHEDULE_ITEMS },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Hiển thị menu schedule
 */
const showScheduleMenu = async (chatId) => {
  const schedule = await ensureDefaultSchedule(chatId);
  const now = dayjs();
  const currentTime = now.format('HH:mm');
  
  // Tìm hoạt động hiện tại và tiếp theo
  const sortedItems = [...schedule.items].sort((a, b) => a.time.localeCompare(b.time));
  let currentActivity = null;
  let nextActivity = null;
  
  for (let i = 0; i < sortedItems.length; i++) {
    if (sortedItems[i].time <= currentTime) {
      currentActivity = sortedItems[i];
    }
    if (sortedItems[i].time > currentTime && !nextActivity) {
      nextActivity = sortedItems[i];
    }
  }

  let statusText = '📊 Trạng thái:\n';
  if (currentActivity) {
    statusText += `▶️ Đang: ${currentActivity.title} (${currentActivity.time})\n`;
  }
  if (nextActivity) {
    statusText += `⏭️ Tiếp: ${nextActivity.title} (${nextActivity.time})`;
  }

  await safeSendMessage(
    chatId,
    `🗓 Lịch chăm bé:\n\n${statusText}\n\n👇 Bấm nút để quản lý:`,
    scheduleInlineKeyboard
  );
};

/**
 * Xem lịch đầy đủ
 */
const handleScheduleView = async (chatId) => {
  const schedule = await ensureDefaultSchedule(chatId);
  const content = formatScheduleItems(schedule.items);
  
  if (!content) {
    await safeSendMessage(
      chatId,
      '🗓 Chưa có lịch nào.\n\n👇 Bấm nút để thêm:',
      scheduleInlineKeyboard
    );
    return;
  }
  
  const now = dayjs().format('HH:mm');
  const lines = content.split('\n').map((line) => {
    const timeMatch = line.match(/^(\d{2}:\d{2})/);
    if (timeMatch && timeMatch[1] <= now) {
      return `✅ ${line}`;
    }
    return `⏳ ${line}`;
  });
  
  await safeSendMessage(
    chatId,
    `🗓 Lịch chăm bé hôm nay:\n\n${lines.join('\n')}\n\n👇 Bấm nút để quản lý:`,
    scheduleInlineKeyboard
  );
};

/**
 * Thêm/sửa lịch
 */
const handleScheduleAdd = async (chatId, timePart, titlePart) => {
  if (!isValidTime(timePart)) {
    await safeSendMessage(chatId, '🗓 Giờ không hợp lệ. Dùng định dạng HH:mm (ví dụ: 09:30)');
    return;
  }
  
  const schedule = await ensureDefaultSchedule(chatId);
  const type = normalizeScheduleType(titlePart);
  const newItems = schedule.items.filter((item) => item.time !== timePart);
  newItems.push({ time: timePart, title: titlePart, type });
  schedule.items = newItems;
  await schedule.save();
  
  await safeSendMessage(
    chatId,
    `🗓 Đã thêm: ${timePart} - ${titlePart}\n\n👇 Bấm nút để tiếp tục:`,
    scheduleInlineKeyboard
  );
};

/**
 * Reset lịch về mặc định
 */
const handleScheduleReset = async (chatId) => {
  await DailySchedule.findOneAndUpdate(
    { chatId },
    { items: DEFAULT_SCHEDULE_ITEMS },
    { upsert: true }
  );
  await safeSendMessage(
    chatId,
    '🗓 Đã khôi phục lịch mẫu!\n\n👇 Bấm nút để xem:',
    scheduleInlineKeyboard
  );
};

/**
 * Đăng ký handlers cho schedule
 */
export const registerScheduleHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    if (text === '🗓 Lịch chăm bé') {
      clearState(chatId);
      await showScheduleMenu(chatId);
      return;
    }
    
    // Xử lý input từ user đang chờ
    const state = getState(chatId);
    if (state?.type === 'schedule_time') {
      if (!isValidTime(text)) {
        await safeSendMessage(chatId, '🗓 Giờ không hợp lệ. Nhập lại theo định dạng HH:mm (ví dụ: 09:30):');
        return;
      }
      setState(chatId, { type: 'schedule_title', time: text });
      await safeSendMessage(chatId, '🗓 Nhập nội dung hoạt động:\n\nVí dụ: Bú + chơi tummy time');
      return;
    }
    
    if (state?.type === 'schedule_title') {
      const time = state.time;
      clearState(chatId);
      await handleScheduleAdd(chatId, time, text);
      return;
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'schedule_view') {
      await bot.answerCallbackQuery(query.id);
      await handleScheduleView(chatId);
      return;
    }
    
    if (query.data === 'schedule_add') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'schedule_time' });
      await safeSendMessage(chatId, '🗓 Nhập giờ (HH:mm):\n\nVí dụ: 09:30');
      return;
    }
    
    if (query.data === 'schedule_reset') {
      await bot.answerCallbackQuery(query.id, { text: 'Đã khôi phục!' });
      await handleScheduleReset(chatId);
      return;
    }
  });

  // Commands
  bot.onText(/\/schedule\s+view/, async (msg) => {
    clearState(msg.chat.id);
    await handleScheduleView(msg.chat.id);
  });

  bot.onText(/\/schedule\s+add\s+(\d{2}:\d{2})\s+(.+)/, async (msg, match) => {
    clearState(msg.chat.id);
    await handleScheduleAdd(msg.chat.id, match?.[1], match?.[2]);
  });

  bot.onText(/\/schedule\s+reset/, async (msg) => {
    clearState(msg.chat.id);
    await handleScheduleReset(msg.chat.id);
  });
  
  // /schedule không có tham số -> hiển thị menu
  bot.onText(/\/schedule\s*$/, async (msg) => {
    clearState(msg.chat.id);
    await showScheduleMenu(msg.chat.id);
  });
};

export default registerScheduleHandler;
