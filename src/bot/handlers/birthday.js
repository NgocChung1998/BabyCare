import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { ChatProfile } from '../../database/models/index.js';
import { parseDate } from '../../utils/validators.js';
import { formatAge } from '../../utils/formatters.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';
import { mainKeyboard } from '../keyboard.js';

/**
 * Lưu ngày sinh bé
 */
const handleBirthdaySet = async (chatId, dateText) => {
  const date = parseDate(dateText);
  if (!date) {
    await safeSendMessage(chatId, '🎂 Ngày sinh không hợp lệ. Dùng định dạng:\n\n• YYYY-MM-DD (ví dụ: 2024-05-10)\n• DD/MM/YYYY (ví dụ: 10/05/2024)\n• DD-MM-YYYY (ví dụ: 10-05-2024)');
    return;
  }
  
  // Kiểm tra ngày không được trong tương lai
  if (date.isAfter(dayjs())) {
    await safeSendMessage(chatId, '🎂 Ngày sinh không thể là ngày trong tương lai.');
    return;
  }
  
  await ChatProfile.findOneAndUpdate(
    { chatId }, 
    { dateOfBirth: date.toDate() }, 
    { upsert: true, new: true }
  );
  
  const ageText = formatAge(date.toDate());
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '✅ CẬP NHẬT THÀNH CÔNG',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🎂 Ngày sinh: ${date.format('DD/MM/YYYY')}`,
    `👶 Tuổi hiện tại: ${ageText}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    'Em sẽ tính tuổi bé chính xác hơn!'
  ];
  
  await safeSendMessage(
    chatId, 
    lines.join('\n'),
    mainKeyboard
  );
};

/**
 * Xem ngày sinh hiện tại
 */
const handleBirthdayView = async (chatId) => {
  const profile = await ChatProfile.findOne({ chatId });
  
  if (!profile?.dateOfBirth) {
    const lines = [
      '━━━━━━━━━━━━━━━━━━━━',
      '🎂 NGÀY SINH BÉ',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '❌ Chưa có ngày sinh',
      '',
      '📝 Cách thêm:',
      '   └─ /birthday set YYYY-MM-DD',
      '',
      '💡 Ví dụ: /birthday set 2024-05-10'
    ];
    
    await safeSendMessage(
      chatId,
      lines.join('\n'),
      mainKeyboard
    );
    return;
  }
  
  const birthDate = dayjs(profile.dateOfBirth);
  const ageText = formatAge(profile.dateOfBirth);
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '🎂 NGÀY SINH BÉ',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `📅 Ngày sinh: ${birthDate.format('DD/MM/YYYY')}`,
    `👶 Tuổi hiện tại: ${ageText}`
  ];
  
  await safeSendMessage(
    chatId,
    lines.join('\n'),
    mainKeyboard
  );
};

/**
 * Đăng ký handler cho birthday
 */
export const registerBirthdayHandler = () => {
  // Command với tham số
  bot.onText(/\/birthday\s+set\s+(.+)/, async (msg, match) => {
    clearState(msg.chat.id);
    await handleBirthdaySet(msg.chat.id, match?.[1]);
  });
  
  // Command không có tham số -> xem ngày sinh
  bot.onText(/\/birthday\s*$/, async (msg) => {
    clearState(msg.chat.id);
    await handleBirthdayView(msg.chat.id);
  });
  
  // Xử lý input từ user đang chờ nhập ngày sinh
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    const state = getState(chatId);
    if (state?.type === 'birthday_set') {
      clearState(chatId);
      await handleBirthdaySet(chatId, text);
      return;
    }
  });
  
  // Nếu user gõ /birthday set không có tham số, hỏi nhập
  bot.onText(/\/birthday\s+set\s*$/, async (msg) => {
    clearState(msg.chat.id);
    setState(msg.chat.id, { type: 'birthday_set' });
    await safeSendMessage(
      msg.chat.id,
      '🎂 Nhập ngày sinh bé:\n\nVí dụ: 2024-05-10 hoặc 10/05/2024'
    );
  });
};

export default registerBirthdayHandler;
