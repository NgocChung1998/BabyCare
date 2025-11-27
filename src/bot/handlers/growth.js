import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { GrowthLog, ChatProfile, VaccineSchedule } from '../../database/models/index.js';
import { growthInlineKeyboard } from '../keyboard.js';
import { parseFloatStrict } from '../../utils/validators.js';
import { formatNumber, formatAge } from '../../utils/formatters.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';
import { getGroupChatIds, notifySyncMembers } from './sync.js';

/**
 * Hiển thị menu thông tin bé
 */
const showBabyInfoMenu = async (chatId) => {
  // Lấy tất cả chatId trong nhóm
  const groupChatIds = await getGroupChatIds(chatId);
  
  const profile = await ChatProfile.findOne({ chatId: { $in: groupChatIds } });
  const latestWeight = await GrowthLog.findOne({ chatId: { $in: groupChatIds }, weightKg: { $exists: true } }).sort({ recordedAt: -1 });
  const latestHeight = await GrowthLog.findOne({ chatId: { $in: groupChatIds }, heightCm: { $exists: true } }).sort({ recordedAt: -1 });
  
  // Lấy lịch tiêm sắp đến
  const upcomingVaccine = await VaccineSchedule.findOne({
    chatId: { $in: groupChatIds },
    date: { $gte: new Date() }
  }).sort({ date: 1 });

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '👶 THÔNG TIN BÉ',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];
  
  // Tuổi
  if (profile?.dateOfBirth) {
    const ageText = formatAge(profile.dateOfBirth);
    lines.push(`🎂 Tuổi: ${ageText}`);
  } else {
    lines.push('🎂 Tuổi: Chưa có');
    lines.push('   └─ Dùng: /birthday set YYYY-MM-DD');
  }
  
  lines.push('');
  
  // Cân nặng
  if (latestWeight?.weightKg) {
    const date = dayjs(latestWeight.recordedAt).format('DD/MM/YYYY');
    lines.push(`⚖️ Cân nặng: ${formatNumber(latestWeight.weightKg)}kg`);
    lines.push(`   └─ Cập nhật: ${date}`);
  } else {
    lines.push('⚖️ Cân nặng: Chưa có');
  }
  
  lines.push('');
  
  // Chiều cao
  if (latestHeight?.heightCm) {
    const date = dayjs(latestHeight.recordedAt).format('DD/MM/YYYY');
    lines.push(`📏 Chiều cao: ${formatNumber(latestHeight.heightCm, 0)}cm`);
    lines.push(`   └─ Cập nhật: ${date}`);
  } else {
    lines.push('📏 Chiều cao: Chưa có');
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  
  // Lịch tiêm sắp đến
  if (upcomingVaccine) {
    const date = dayjs(upcomingVaccine.date).format('DD/MM/YYYY');
    const daysLeft = dayjs(upcomingVaccine.date).diff(dayjs(), 'day');
    if (daysLeft === 0) {
      lines.push('💉 Tiêm chủng: HÔM NAY');
      lines.push(`   └─ ${upcomingVaccine.vaccineName}`);
    } else if (daysLeft <= 3) {
      lines.push(`💉 Tiêm chủng: ${date}`);
      lines.push(`   └─ ${upcomingVaccine.vaccineName} (còn ${daysLeft} ngày)`);
    } else {
      lines.push(`💉 Tiêm chủng: ${date}`);
      lines.push(`   └─ ${upcomingVaccine.vaccineName} (còn ${daysLeft} ngày)`);
    }
  } else {
    lines.push('💉 Tiêm chủng: Chưa có lịch sắp đến');
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('👇 Bấm nút để cập nhật:');
  
  await safeSendMessage(
    chatId,
    lines.join('\n'),
    growthInlineKeyboard
  );
};

/**
 * Xử lý cập nhật cân nặng
 */
const handleWeight = async (chatId, weightText) => {
  const weight = parseFloatStrict(weightText);
  if (!weight || weight > 50) {
    await safeSendMessage(chatId, '⚖️ Vui lòng nhập cân nặng hợp lệ (kg), ví dụ: 6.5');
    return;
  }
  
  // Lấy primary chatId để lưu dữ liệu chung
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  
  await GrowthLog.create({ chatId: primaryChatId, weightKg: weight });
  await safeSendMessage(
    chatId,
    `✅ Cập nhật thành công!\n\n⚖️ Cân nặng: ${formatNumber(weight)}kg\n\n💡 Bấm nút để tiếp tục:`,
    growthInlineKeyboard
  );
  
  // Thông báo cho thành viên khác
  await notifySyncMembers(chatId, `Cập nhật cân nặng bé: ${formatNumber(weight)}kg`);
};

/**
 * Xử lý cập nhật chiều cao
 */
const handleHeight = async (chatId, heightText) => {
  const height = parseFloatStrict(heightText);
  if (!height || height > 200) {
    await safeSendMessage(chatId, '📏 Vui lòng nhập chiều cao hợp lệ (cm), ví dụ: 62');
    return;
  }
  
  // Lấy primary chatId để lưu dữ liệu chung
  const groupChatIds = await getGroupChatIds(chatId);
  const primaryChatId = groupChatIds[0];
  
  await GrowthLog.create({ chatId: primaryChatId, heightCm: height });
  await safeSendMessage(
    chatId,
    `✅ Cập nhật thành công!\n\n📏 Chiều cao: ${formatNumber(height)}cm\n\n💡 Bấm nút để tiếp tục:`,
    growthInlineKeyboard
  );
  
  // Thông báo cho thành viên khác
  await notifySyncMembers(chatId, `Cập nhật chiều cao bé: ${formatNumber(height)}cm`);
};

/**
 * Xem trạng thái hiện tại
 */
const handleBabyInfoStatus = async (chatId) => {
  await showBabyInfoMenu(chatId);
};

/**
 * Xem lịch sử (chỉ hiển thị lịch sử cân nặng, không có lịch tiêm chủng)
 */
const handleGrowthHistory = async (chatId) => {
  // Lấy tất cả chatId trong nhóm
  const groupChatIds = await getGroupChatIds(chatId);
  
  const logs = await GrowthLog.find({ chatId: { $in: groupChatIds }, weightKg: { $exists: true } }).sort({ recordedAt: -1 }).limit(10);
  
  if (!logs.length) {
    await safeSendMessage(
      chatId,
      '📋 Chưa có lịch sử cân nặng.\n\n👇 Bấm nút để bắt đầu ghi nhận:',
      growthInlineKeyboard
    );
    return;
  }
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '📋 LỊCH SỬ CÂN NẶNG',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];
  
  logs.forEach((log, index) => {
    const date = dayjs(log.recordedAt).format('DD/MM/YYYY');
    lines.push(`${index + 1}. ${date} ─ ${formatNumber(log.weightKg)}kg`);
  });
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('👇 Bấm nút để cập nhật:');
  
  await safeSendMessage(
    chatId,
    lines.join('\n'),
    growthInlineKeyboard
  );
};

/**
 * Đăng ký handlers cho growth
 */
export const registerGrowthHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    if (text === '👶 Thông tin bé') {
      clearState(chatId);
      await showBabyInfoMenu(chatId);
      return;
    }
    
    // Xử lý input từ user đang chờ
    const state = getState(chatId);
    if (state?.type === 'weight') {
      clearState(chatId);
      await handleWeight(chatId, text);
      return;
    }
    
    if (state?.type === 'height') {
      clearState(chatId);
      await handleHeight(chatId, text);
      return;
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'growth_weight') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'weight' });
      await safeSendMessage(chatId, '⚖️ Nhập cân nặng bé (kg):\n\nVí dụ: 6.5');
      return;
    }
    
    if (query.data === 'growth_height') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'height' });
      await safeSendMessage(chatId, '📏 Nhập chiều cao bé (cm):\n\nVí dụ: 62');
      return;
    }
    
    if (query.data === 'growth_status') {
      await bot.answerCallbackQuery(query.id);
      await handleBabyInfoStatus(chatId);
      return;
    }
    
    if (query.data === 'growth_history') {
      await bot.answerCallbackQuery(query.id);
      await handleGrowthHistory(chatId);
      return;
    }
  });

  // Commands
  bot.onText(/\/weight(?:\s+(.+))?/, async (msg, match) => {
    clearState(msg.chat.id);
    const value = match?.[1];
    if (value) {
      await handleWeight(msg.chat.id, value);
    } else {
      setState(msg.chat.id, { type: 'weight' });
      await safeSendMessage(msg.chat.id, '⚖️ Nhập cân nặng bé (kg):\n\nVí dụ: 6.5');
    }
  });

  bot.onText(/\/height(?:\s+(.+))?/, async (msg, match) => {
    clearState(msg.chat.id);
    const value = match?.[1];
    if (value) {
      await handleHeight(msg.chat.id, value);
    } else {
      setState(msg.chat.id, { type: 'height' });
      await safeSendMessage(msg.chat.id, '📏 Nhập chiều cao bé (cm):\n\nVí dụ: 62');
    }
  });

  bot.onText(/\/growth(?:\s+history)?/, async (msg, match) => {
    clearState(msg.chat.id);
    if (match?.[0]?.includes('history')) {
      await handleGrowthHistory(msg.chat.id);
    } else {
      await handleBabyInfoStatus(msg.chat.id);
    }
  });
};

export default registerGrowthHandler;
