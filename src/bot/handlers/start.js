import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { mainKeyboard, buttonGuides } from '../keyboard.js';
import { ChatProfile, DailySchedule, GrowthLog } from '../../database/models/index.js';
import { DEFAULT_SCHEDULE_ITEMS } from '../../config/index.js';
import { setNightModeCache } from '../../services/messageService.js';
import { formatNumber } from '../../utils/formatters.js';

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
 * Đăng ký chat profile
 */
export const registerChat = async (chat) => {
  if (!chat) return;
  const profile = await ChatProfile.findOneAndUpdate(
    { chatId: chat.id },
    {
      firstName: chat.first_name,
      username: chat.username,
      lastInteraction: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  setNightModeCache(chat.id, profile.nightModeEnabled);
  await ensureDefaultSchedule(chat.id);
};

/**
 * Kiểm tra thông tin còn thiếu và nhắc nhở
 */
const checkMissingInfo = async (chatId) => {
  const profile = await ChatProfile.findOne({ chatId });
  const latestGrowth = await GrowthLog.findOne({ chatId }).sort({ recordedAt: -1 });

  const missingItems = [];

  // Kiểm tra ngày sinh
  if (!profile?.dateOfBirth) {
    missingItems.push({
      icon: '🎂',
      label: 'Ngày sinh bé',
      command: '/birthday set YYYY-MM-DD'
    });
  }

  // Kiểm tra cân nặng (nếu chưa có hoặc quá 30 ngày)
  if (!latestGrowth?.weightKg) {
    missingItems.push({
      icon: '⚖️',
      label: 'Cân nặng',
      command: '/weight <kg>'
    });
  } else {
    const daysSince = dayjs().diff(dayjs(latestGrowth.recordedAt), 'day');
    if (daysSince > 30) {
      missingItems.push({
        icon: '⚖️',
        label: 'Cân nặng (đã lâu chưa cập nhật)',
        command: '/weight <kg>'
      });
    }
  }

  // Kiểm tra chiều cao
  const latestHeight = await GrowthLog.findOne({ 
    chatId, 
    heightCm: { $exists: true, $ne: null } 
  }).sort({ recordedAt: -1 });
  
  if (!latestHeight?.heightCm) {
    missingItems.push({
      icon: '📏',
      label: 'Chiều cao',
      command: '/height <cm>'
    });
  } else {
    const daysSince = dayjs().diff(dayjs(latestHeight.recordedAt), 'day');
    if (daysSince > 30) {
      missingItems.push({
        icon: '📏',
        label: 'Chiều cao (đã lâu chưa cập nhật)',
        command: '/height <cm>'
      });
    }
  }

  return missingItems;
};

/**
 * Build thông tin hiện tại của bé
 */
const buildBabyInfo = async (chatId) => {
  const profile = await ChatProfile.findOne({ chatId });
  const latestGrowth = await GrowthLog.findOne({ chatId }).sort({ recordedAt: -1 });
  const latestHeight = await GrowthLog.findOne({ 
    chatId, 
    heightCm: { $exists: true, $ne: null } 
  }).sort({ recordedAt: -1 });

  const info = [];

  if (profile?.dateOfBirth) {
    const ageMonths = dayjs().diff(dayjs(profile.dateOfBirth), 'month');
    info.push(`🎂 ${ageMonths} tháng tuổi`);
  }

  if (latestGrowth?.weightKg) {
    info.push(`⚖️ ${formatNumber(latestGrowth.weightKg)}kg`);
  }

  if (latestHeight?.heightCm) {
    info.push(`📏 ${formatNumber(latestHeight.heightCm, 0)}cm`);
  }

  return info;
};

/**
 * Đăng ký handler /start
 */
export const registerStartHandler = () => {
  bot.onText(/\/start/, async (msg) => {
    await registerChat(msg.chat);
    
    const babyInfo = await buildBabyInfo(msg.chat.id);
    const missingInfo = await checkMissingInfo(msg.chat.id);

    let greeting = [
      `Chào bố/mẹ ${msg.from.first_name || ''}! 👶`,
      'Em là trợ lý chăm bé.'
    ];

    // Hiển thị thông tin bé nếu có
    if (babyInfo.length) {
      greeting.push('');
      greeting.push(`👶 Thông tin bé: ${babyInfo.join(' • ')}`);
    }

    // Nhắc nhở thông tin còn thiếu
    if (missingInfo.length) {
      greeting.push('');
      greeting.push('📝 Bố/mẹ bổ sung thêm để em hỗ trợ tốt hơn:');
      missingInfo.forEach((item) => {
        greeting.push(`${item.icon} ${item.label}: ${item.command}`);
      });
    }

    greeting.push('');
    greeting.push('Dùng menu bên dưới để xem hướng dẫn từng chức năng nhé!');

    await safeSendMessage(msg.chat.id, greeting.join('\n'), mainKeyboard);
  });

  // Handle button guides (skip null values - handled by specific handlers)
  bot.on('message', async (msg) => {
    try {
      await registerChat(msg.chat);
      if (!msg.text) return;
      const text = msg.text.trim();
      
      // Skip if handled by specific handlers (value is null)
      if (buttonGuides[text] === null) {
        return;
      }
      
      if (buttonGuides[text]) {
        await safeSendMessage(msg.chat.id, buttonGuides[text], mainKeyboard);
        return;
      }
    } catch (error) {
      console.error('Lỗi xử lý message:', error);
    }
  });

  // Lệnh /status để xem thông tin tổng quan
  bot.onText(/\/status/, async (msg) => {
    await registerChat(msg.chat);
    
    const babyInfo = await buildBabyInfo(msg.chat.id);
    const missingInfo = await checkMissingInfo(msg.chat.id);

    let message = '📋 Thông tin hồ sơ bé:\n\n';

    if (babyInfo.length) {
      message += babyInfo.join('\n') + '\n';
    } else {
      message += '(Chưa có thông tin)\n';
    }

    if (missingInfo.length) {
      message += '\n📝 Cần bổ sung:\n';
      missingInfo.forEach((item) => {
        message += `${item.icon} ${item.label}: ${item.command}\n`;
      });
    } else {
      message += '\n✅ Thông tin đầy đủ!';
    }

    await safeSendMessage(msg.chat.id, message, mainKeyboard);
  });
};

export default registerStartHandler;
