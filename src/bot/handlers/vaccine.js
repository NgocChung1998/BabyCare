import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { bot, safeSendMessage } from '../index.js';
import { VaccineSchedule, ChatProfile } from '../../database/models/index.js';
import { vaccineInlineKeyboard, buildInlineKeyboard, mainKeyboard } from '../keyboard.js';
import { parseDate } from '../../utils/validators.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';
import { generateVaccinationSchedule } from '../../services/routineService.js';
import { formatAge } from '../../utils/formatters.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

// Danh sách vaccine phổ biến
const commonVaccines = [
  '5in1', '6in1', 'BCG', 'Viêm gan B', 'Rotavirus', 
  'Phế cầu', 'Sởi-Quai bị-Rubella', 'Thủy đậu', 'Viêm não Nhật Bản'
];

/**
 * Hiển thị menu vaccine
 */
const showVaccineMenu = async (chatId) => {
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  
  // Lấy thông tin bé
  const profile = await ChatProfile.findOne({ chatId });
  let babyInfo = '';
  if (profile?.dateOfBirth) {
    const ageText = formatAge(profile.dateOfBirth);
    babyInfo = `👶 Tuổi bé: ${ageText}\n\n`;
  }
  
  // Đếm vaccine
  const [totalCount, completedCount, upcomingCount] = await Promise.all([
    VaccineSchedule.countDocuments({ chatId }),
    VaccineSchedule.countDocuments({ chatId, completed: true }),
    VaccineSchedule.countDocuments({ chatId, completed: false, date: { $gte: now.toDate() } })
  ]);
  
  // Lấy lịch tiêm sắp tới
  const upcoming = await VaccineSchedule.find({
    chatId,
    completed: false,
    date: { $gte: now.subtract(7, 'day').toDate() }
  }).sort({ date: 1 }).limit(5);

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '💉 LỊCH TIÊM CHỦNG',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];
  
  if (babyInfo) lines.push(babyInfo);
  
  lines.push(`📊 Tổng: ${totalCount} mũi`);
  lines.push(`✅ Đã tiêm: ${completedCount} mũi`);
  lines.push(`⏳ Sắp tiêm: ${upcomingCount} mũi`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  
  if (upcoming.length) {
    lines.push('📅 SẮP TỚI:');
    lines.push('');
    upcoming.forEach((item, i) => {
      const date = dayjs.tz(item.date, VIETNAM_TZ).format('DD/MM/YYYY');
      const daysLeft = dayjs.tz(item.date, VIETNAM_TZ).diff(now, 'day');
      const required = item.required ? '🔴' : '🔵';
      let status = '';
      if (daysLeft === 0) status = ' ⚠️ HÔM NAY';
      else if (daysLeft < 0) status = ` ⚠️ QUÁ ${Math.abs(daysLeft)} ngày`;
      else if (daysLeft <= 3) status = ` 🔔 còn ${daysLeft} ngày`;
      else status = ` còn ${daysLeft} ngày`;
      
      lines.push(`${i + 1}. ${required} ${date}${status}`);
      lines.push(`   └─ ${item.vaccineName}`);
    });
  } else {
    lines.push('📅 Chưa có lịch tiêm sắp tới');
    lines.push('');
    lines.push('💡 Bấm "Tạo lịch tự động" để tạo lịch tiêm\n   theo ngày sinh của bé');
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('🔴 Bắt buộc | 🔵 Khuyến cáo');
  lines.push('');
  lines.push('👇 Bấm nút để quản lý:');

  await safeSendMessage(chatId, lines.join('\n'), vaccineInlineKeyboard);
};

/**
 * Tạo lịch tiêm tự động từ ngày sinh
 */
const handleAutoGenerate = async (chatId) => {
  try {
    const profile = await ChatProfile.findOne({ chatId });
    
    if (!profile?.dateOfBirth) {
      await safeSendMessage(
        chatId,
        '━━━━━━━━━━━━━━━━━━━━\n' +
        '❌ CHƯA CÓ NGÀY SINH\n' +
        '━━━━━━━━━━━━━━━━━━━━\n\n' +
        '📝 Để tạo lịch tiêm tự động, vui lòng cập nhật ngày sinh:\n\n' +
        '/birthday set YYYY-MM-DD\n\n' +
        'Ví dụ: /birthday set 2024-05-10',
        mainKeyboard
      );
      return;
    }
    
    console.log(`[Vaccine] Tạo lịch tiêm cho chatId=${chatId}, dateOfBirth=${profile.dateOfBirth}`);
    
    const count = await generateVaccinationSchedule(chatId, profile.dateOfBirth);
    const ageText = formatAge(profile.dateOfBirth);
    
    if (count === 0) {
      await safeSendMessage(
        chatId,
        '━━━━━━━━━━━━━━━━━━━━\n' +
        '⚠️ KHÔNG CÓ MŨI TIÊM MỚI\n' +
        '━━━━━━━━━━━━━━━━━━━━\n\n' +
        `👶 Tuổi bé: ${ageText}\n\n` +
        '💡 Bé có thể đã tiêm hết các mũi cơ bản\n' +
        'hoặc các mũi còn lại đã quá hạn > 30 ngày.\n\n' +
        '📝 Bấm "Thêm thủ công" để thêm lịch tiêm mới.',
        vaccineInlineKeyboard
      );
      return;
    }
    
    await safeSendMessage(
      chatId,
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '✅ TẠO LỊCH TIÊM THÀNH CÔNG\n' +
      '━━━━━━━━━━━━━━━━━━━━\n\n' +
      `👶 Tuổi bé: ${ageText}\n` +
      `💉 Đã tạo: ${count} mũi tiêm\n\n` +
      '🔔 Em sẽ nhắc bố/mẹ:\n' +
      '   └─ Trước 7 ngày\n' +
      '   └─ Trước 3 ngày\n' +
      '   └─ Đúng ngày tiêm\n\n' +
      '👇 Bấm để xem chi tiết:',
      vaccineInlineKeyboard
    );
  } catch (error) {
    console.error('[Vaccine] Lỗi tạo lịch tiêm:', error);
    await safeSendMessage(
      chatId,
      '❌ Có lỗi xảy ra khi tạo lịch tiêm.\n\nVui lòng thử lại sau!',
      mainKeyboard
    );
  }
};

/**
 * Thêm lịch tiêm thủ công
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
    date: date.toDate(),
    required: true,
    autoGenerated: false
  });
  
  // Hiển thị thông báo thành công
  await safeSendMessage(
    chatId,
    `✅ Đã lưu lịch tiêm!\n\n` +
    `💉 ${vaccineName.trim()}\n` +
    `📅 ${date.format('DD/MM/YYYY')}\n\n` +
    `🔔 Em sẽ nhắc bố/mẹ trước 3 ngày và đúng ngày nhé!`
  );
  
  // Tự động hiển thị lại danh sách lịch tiêm
  await handleVaccineList(chatId);
};

/**
 * Xem danh sách lịch tiêm chi tiết
 */
const handleVaccineList = async (chatId) => {
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  const schedules = await VaccineSchedule.find({ chatId }).sort({ date: 1 });
  
  if (!schedules.length) {
    await safeSendMessage(
      chatId,
      '💉 Chưa có lịch tiêm nào.\n\n👇 Bấm nút để thêm:',
      vaccineInlineKeyboard
    );
    return;
  }
  
  const upcoming = schedules.filter((s) => !s.completed && dayjs.tz(s.date, VIETNAM_TZ).isAfter(now.subtract(7, 'day')));
  const completed = schedules.filter((s) => s.completed);
  const overdue = schedules.filter((s) => !s.completed && dayjs.tz(s.date, VIETNAM_TZ).isBefore(now.subtract(7, 'day')));
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '💉 CHI TIẾT LỊCH TIÊM',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];
  
  if (upcoming.length) {
    lines.push('📅 SẮP TIÊM:');
    lines.push('');
    upcoming.slice(0, 10).forEach((item, i) => {
      const date = dayjs.tz(item.date, VIETNAM_TZ).format('DD/MM/YYYY');
      const daysLeft = dayjs.tz(item.date, VIETNAM_TZ).diff(now, 'day');
      const required = item.required ? '🔴' : '🔵';
      lines.push(`${i + 1}. ${required} ${date} (${daysLeft >= 0 ? `còn ${daysLeft}` : `quá ${Math.abs(daysLeft)}`} ngày)`);
      lines.push(`   └─ ${item.vaccineName}`);
    });
    if (upcoming.length > 10) {
      lines.push(`   ... và ${upcoming.length - 10} mũi khác`);
    }
    lines.push('');
  }
  
  if (overdue.length) {
    lines.push('⚠️ QUÁ HẠN:');
    lines.push('');
    overdue.slice(0, 5).forEach((item, i) => {
      const date = dayjs.tz(item.date, VIETNAM_TZ).format('DD/MM/YYYY');
      lines.push(`${i + 1}. ${date} - ${item.vaccineName}`);
    });
    lines.push('');
  }
  
  if (completed.length) {
    lines.push('✅ ĐÃ TIÊM:');
    lines.push('');
    completed.slice(-5).forEach((item, i) => {
      const date = dayjs.tz(item.completedDate || item.date, VIETNAM_TZ).format('DD/MM/YYYY');
      lines.push(`${i + 1}. ${date} - ${item.vaccineName}`);
    });
    if (completed.length > 5) {
      lines.push(`   ... và ${completed.length - 5} mũi khác`);
    }
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('👇 Bấm nút để quản lý:');
  
  await safeSendMessage(chatId, lines.join('\n'), vaccineInlineKeyboard);
};

/**
 * Hiển thị danh sách vaccine để đánh dấu đã tiêm
 */
const showVaccinesToComplete = async (chatId) => {
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  
  const upcoming = await VaccineSchedule.find({
    chatId,
    completed: false,
    date: { $lte: now.add(7, 'day').toDate() }
  }).sort({ date: 1 }).limit(10);
  
  if (!upcoming.length) {
    await safeSendMessage(
      chatId,
      '💉 Không có mũi tiêm nào cần đánh dấu.\n\n' +
      '(Chỉ hiển thị các mũi trong 7 ngày tới)',
      vaccineInlineKeyboard
    );
    return;
  }
  
  const buttons = upcoming.map((item, i) => [{
    text: `${dayjs.tz(item.date, VIETNAM_TZ).format('DD/MM')} - ${item.vaccineName}`,
    callback_data: `vaccine_done_${item._id}`
  }]);
  
  buttons.push([{ text: '🔙 Quay lại', callback_data: 'vaccine_back' }]);
  
  await safeSendMessage(
    chatId,
    '✅ Chọn mũi tiêm đã hoàn thành:',
    buildInlineKeyboard(buttons)
  );
};

/**
 * Đánh dấu vaccine đã tiêm
 */
const markVaccineComplete = async (chatId, vaccineId) => {
  const vaccine = await VaccineSchedule.findByIdAndUpdate(
    vaccineId,
    {
      completed: true,
      completedDate: new Date()
    },
    { new: true }
  );
  
  if (vaccine) {
    await safeSendMessage(
      chatId,
      `✅ Đã đánh dấu hoàn thành!\n\n` +
      `💉 ${vaccine.vaccineName}\n` +
      `📅 Tiêm ngày: ${dayjs.tz(new Date(), VIETNAM_TZ).format('DD/MM/YYYY')}\n\n` +
      `Bé giỏi lắm! 👶💪`,
      vaccineInlineKeyboard
    );
  }
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
    
    // Bước 1: Nhập ngày tiêm
    if (state?.type === 'vaccine_date') {
      const date = parseDate(text);
      if (!date) {
        await safeSendMessage(chatId, '💉 Ngày không hợp lệ. Nhập lại theo định dạng YYYY-MM-DD hoặc DD/MM/YYYY:');
        return;
      }
      // Lưu ngày và chuyển sang chọn vaccine
      const dateText = text; // Lưu text gốc để dùng lại
      console.log(`[Vaccine] User nhập ngày: ${dateText}, parsed: ${date.format('YYYY-MM-DD')}`);
      setState(chatId, { type: 'vaccine_name', date: dateText });
      await showVaccineSelection(chatId);
      return;
    }
    
    // Bước 2: Nhập tên vaccine thủ công (sau khi đã có ngày)
    if (state?.type === 'vaccine_name') {
      if (!state.date) {
        // Nếu không có date trong state, có thể state bị mất -> hỏi lại ngày
        setState(chatId, { type: 'vaccine_date' });
        await safeSendMessage(chatId, '💉 Vui lòng nhập lại ngày tiêm:\n\nVí dụ: 2025-03-10 hoặc 10/03/2025');
        return;
      }
      const date = state.date;
      clearState(chatId);
      await handleVaccineAdd(chatId, date, text);
      return;
    }
    
    // Nhập ngày sau khi đã chọn vaccine từ button (trường hợp chọn vaccine trước)
    if (state?.type === 'vaccine_date_for_name') {
      const date = parseDate(text);
      if (!date) {
        await safeSendMessage(chatId, '💉 Ngày không hợp lệ. Nhập lại theo định dạng YYYY-MM-DD hoặc DD/MM/YYYY:');
        return;
      }
      const vaccineName = state.vaccineName;
      if (!vaccineName) {
        clearState(chatId);
        await safeSendMessage(chatId, '❌ Có lỗi xảy ra. Vui lòng thử lại!', vaccineInlineKeyboard);
        return;
      }
      clearState(chatId);
      await handleVaccineAdd(chatId, text, vaccineName);
      return;
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'vaccine_auto') {
      await bot.answerCallbackQuery(query.id, { text: 'Đang tạo lịch tiêm...' });
      await handleAutoGenerate(chatId);
      return;
    }
    
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
    
    if (query.data === 'vaccine_complete') {
      await bot.answerCallbackQuery(query.id);
      await showVaccinesToComplete(chatId);
      return;
    }
    
    if (query.data === 'vaccine_back') {
      await bot.answerCallbackQuery(query.id);
      await showVaccineMenu(chatId);
      return;
    }
    
    if (query.data.startsWith('vaccine_done_')) {
      const vaccineId = query.data.replace('vaccine_done_', '');
      await bot.answerCallbackQuery(query.id, { text: 'Đang cập nhật...' });
      await markVaccineComplete(chatId, vaccineId);
      return;
    }
    
    if (query.data.startsWith('vaccine_select_')) {
      const index = parseInt(query.data.replace('vaccine_select_', ''), 10);
      const vaccineName = commonVaccines[index];
      const state = getState(chatId);
      console.log(`[Vaccine] vaccine_select callback, index=${index}, vaccineName=${vaccineName}, state=`, JSON.stringify(state));
      
      // Kiểm tra xem có date trong state không (check cả type và date)
      if (state && (state.date || (state.type === 'vaccine_name' && state.date))) {
        // Đã có ngày -> thêm luôn
        const date = state.date;
        console.log(`[Vaccine] Đã có ngày trong state: ${date}, thêm vaccine ${vaccineName}`);
        await bot.answerCallbackQuery(query.id, { text: `Đã chọn ${vaccineName}` });
        clearState(chatId);
        await handleVaccineAdd(chatId, date, vaccineName);
      } else {
        // Chưa có ngày -> hỏi ngày trước
        console.log(`[Vaccine] Chưa có ngày trong state, hỏi lại ngày cho vaccine ${vaccineName}`);
        await bot.answerCallbackQuery(query.id, { text: `Chọn ${vaccineName}! Nhập ngày tiêm...` });
        clearState(chatId); // Clear state cũ để tránh conflict
        setState(chatId, { type: 'vaccine_date_for_name', vaccineName });
        await safeSendMessage(
          chatId,
          `💉 Vaccine: ${vaccineName}\n\n📅 Nhập ngày tiêm:\n\nVí dụ: 2025-03-10 hoặc 10/03/2025`
        );
      }
      return;
    }
    
    if (query.data === 'vaccine_custom') {
      await bot.answerCallbackQuery(query.id);
      const state = getState(chatId);
      console.log(`[Vaccine] vaccine_custom callback, state=`, JSON.stringify(state));
      
      if (state && state.date) {
        // Đã có ngày -> chỉ cần nhập tên vaccine (giữ nguyên date)
        setState(chatId, { type: 'vaccine_name', date: state.date });
        await safeSendMessage(chatId, '💉 Nhập tên vaccine:');
      } else {
        // Chưa có ngày -> hỏi lại ngày
        console.log(`[Vaccine] Chưa có ngày, hỏi lại ngày`);
        clearState(chatId);
        setState(chatId, { type: 'vaccine_date' });
        await safeSendMessage(
          chatId,
          '💉 Vui lòng nhập ngày tiêm trước:\n\nVí dụ: 2025-03-10 hoặc 10/03/2025'
        );
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
  
  bot.onText(/\/vaccine\s+auto/, async (msg) => {
    clearState(msg.chat.id);
    await handleAutoGenerate(msg.chat.id);
  });
  
  // /vaccine không có tham số -> hiển thị menu
  bot.onText(/\/vaccine\s*$/, async (msg) => {
    clearState(msg.chat.id);
    await showVaccineMenu(msg.chat.id);
  });
};

export default registerVaccineHandler;
