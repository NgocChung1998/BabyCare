import dayjs from 'dayjs';
import { bot, safeSendMessage } from '../index.js';
import { FoodLog, ChatProfile } from '../../database/models/index.js';
import { weanInlineKeyboard, buildInlineKeyboard } from '../keyboard.js';
import { suggestWeanMenuWithAI } from '../../services/aiService.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';

// Lưu gợi ý AI để có thể thêm vào sau
const aiSuggestions = new Map();

/**
 * Hiển thị menu wean
 */
const showWeanMenu = async (chatId) => {
  const today = dayjs().startOf('day').toDate();
  const [todayCount, totalCount, allergyCount] = await Promise.all([
    FoodLog.countDocuments({ chatId, recordedAt: { $gte: today } }),
    FoodLog.countDocuments({ chatId }),
    FoodLog.countDocuments({ chatId, allergicReaction: true })
  ]);

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '🔥 CHẾ ĐỘ ĂN DẶM',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `📊 Hôm nay: ${todayCount} món`,
    `📋 Tổng: ${totalCount} món đã thử`,
    `⚠️ Dị ứng: ${allergyCount} món`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '👇 Bấm nút để quản lý:'
  ];

  await safeSendMessage(
    chatId,
    lines.join('\n'),
    weanInlineKeyboard
  );
};

/**
 * Thêm món ăn dặm
 */
const handleWeanAdd = async (chatId, dishName, note = null) => {
  if (!dishName) {
    await safeSendMessage(chatId, '🔥 Vui lòng nhập tên món ăn.');
    return;
  }
  await FoodLog.create({
    chatId,
    dishName: dishName.trim(),
    note: note?.trim() || null
  });
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '✅ ĐÃ LƯU',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🔥 Món: ${dishName.trim()}`,
    '',
    '💡 Theo dõi phản ứng của bé trong 3 ngày nhé!',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '👇 Bấm nút để tiếp tục:'
  ];
  
  await safeSendMessage(
    chatId,
    lines.join('\n'),
    weanInlineKeyboard
  );
};

/**
 * Xem danh sách món đã ăn
 */
const handleWeanList = async (chatId) => {
  const foods = await FoodLog.find({ chatId }).sort({ recordedAt: -1 }).limit(15);
  if (!foods.length) {
    await safeSendMessage(
      chatId,
      '🔥 Chưa có món ăn dặm nào.\n\n👇 Bấm nút để thêm:',
      weanInlineKeyboard
    );
    return;
  }
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '📋 DANH SÁCH MÓN ĂN DẶM',
    '━━━━━━━━━━━━━━━━━━━━',
    ''
  ];
  
  foods.forEach((item, index) => {
    const allergyTag = item.allergicReaction ? '⚠️' : '✅';
    const date = dayjs(item.recordedAt).format('DD/MM/YYYY');
    lines.push(`${index + 1}. ${allergyTag} ${date}`);
    lines.push(`   └─ ${item.dishName}${item.note ? ` (${item.note})` : ''}`);
    lines.push('');
  });
  
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('👇 Bấm nút để quản lý:');
  
  await safeSendMessage(
    chatId,
    lines.join('\n'),
    weanInlineKeyboard
  );
};

/**
 * Ghi nhận phản ứng dị ứng
 */
const handleWeanAllergy = async (chatId, dishName, reactionNote) => {
  if (!dishName || !reactionNote) {
    await safeSendMessage(chatId, '⚠️ Vui lòng nhập đủ tên món và triệu chứng.');
    return;
  }
  await FoodLog.create({
    chatId,
    dishName: dishName.trim(),
    note: reactionNote.trim(),
    allergicReaction: true,
    reactionNote: reactionNote.trim()
  });
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '⚠️ ĐÃ GHI NHẬN DỊ ỨNG',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🔥 Món: ${dishName.trim()}`,
    `📝 Triệu chứng: ${reactionNote.trim()}`,
    '',
    '⛔ Tạm ngưng món này và theo dõi bé nhé!',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '👇 Bấm nút để tiếp tục:'
  ];
  
  await safeSendMessage(
    chatId,
    lines.join('\n'),
    weanInlineKeyboard
  );
};

/**
 * Gợi ý menu ăn dặm bằng AI
 */
const handleWeanSuggest = async (chatId, months = null) => {
  let ageMonths = months;
  
  // Nếu không có tháng tuổi, thử lấy từ profile
  if (!ageMonths) {
    const profile = await ChatProfile.findOne({ chatId });
    if (profile?.dateOfBirth) {
      ageMonths = dayjs().diff(dayjs(profile.dateOfBirth), 'month');
    }
  }
  
  // Nếu vẫn không có, hiển thị menu chọn tuổi
  if (!ageMonths) {
    const ageButtons = buildInlineKeyboard([
      [
        { text: '6 tháng', callback_data: 'wean_age_6' },
        { text: '7 tháng', callback_data: 'wean_age_7' },
        { text: '8 tháng', callback_data: 'wean_age_8' }
      ],
      [
        { text: '9 tháng', callback_data: 'wean_age_9' },
        { text: '10 tháng', callback_data: 'wean_age_10' },
        { text: '11 tháng', callback_data: 'wean_age_11' }
      ],
      [
        { text: '12 tháng', callback_data: 'wean_age_12' },
        { text: '18 tháng', callback_data: 'wean_age_18' },
        { text: '24 tháng', callback_data: 'wean_age_24' }
      ]
    ]);
    await safeSendMessage(chatId, '🔥 Chọn tháng tuổi của bé:', ageButtons);
    return;
  }

  await safeSendMessage(chatId, '🔥 Em đang chuẩn bị thực đơn ăn dặm cho bé...', {}, 'low');

  try {
    const suggestion = await suggestWeanMenuWithAI(ageMonths);
    
    // Lưu gợi ý để có thể thêm vào sau
    aiSuggestions.set(chatId, { suggestion, ageMonths });
    
    // Tạo keyboard với nút thêm món từ gợi ý
    const suggestKeyboard = buildInlineKeyboard([
      [
        { text: '➕ Thêm món từ gợi ý', callback_data: 'wean_add_from_suggestion' }
      ],
      [
        { text: '➕ Thêm món', callback_data: 'wean_add' },
        { text: '📋 Xem danh sách', callback_data: 'wean_list' }
      ],
      [
        { text: '🤖 Gợi ý AI', callback_data: 'wean_suggest' },
        { text: '⚠️ Báo dị ứng', callback_data: 'wean_allergy' }
      ]
    ]);
    
    const lines = [
      '━━━━━━━━━━━━━━━━━━━━',
      `🔥 GỢI Ý ĂN DẶM (${ageMonths} tháng)`,
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      suggestion,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '👇 Bấm nút để thêm món từ gợi ý:'
    ];
    
    await safeSendMessage(
      chatId,
      lines.join('\n'),
      suggestKeyboard
    );
  } catch (error) {
    console.error('Lỗi gợi ý ăn dặm AI:', error);
    await safeSendMessage(
      chatId,
      '🔥 Em đang bận một chút. Bố/mẹ thử lại sau ít phút nhé!',
      weanInlineKeyboard
    );
  }
};

/**
 * Parse món ăn từ format mới: 🍽️ [TÊN] | [NGUYÊN LIỆU] | [CÁCH NẤU] | [KHẨU PHẦN]
 */
const parseDishFromLine = (line) => {
  // Loại bỏ emoji đầu dòng
  let content = line.replace(/^🍽️\s*/, '').trim();
  
  // Thử parse theo format mới (dùng |)
  if (content.includes('|')) {
    const parts = content.split('|').map(p => p.trim());
    if (parts.length >= 2) {
      return {
        name: parts[0],
        ingredients: parts[1] || null,
        recipe: parts[2] || null,
        portion: parts[3] || null,
        note: parts.slice(1).filter(p => p).join(' | ')
      };
    }
  }
  
  // Fallback: parse theo format cũ (dùng -)
  const parts = content.split(' - ');
  return {
    name: parts[0]?.trim() || content,
    note: parts.slice(1).join(' - ').trim() || null
  };
};

/**
 * Thêm món từ gợi ý AI
 */
const handleAddFromSuggestion = async (chatId) => {
  const suggestionData = aiSuggestions.get(chatId);
  if (!suggestionData) {
    await safeSendMessage(
      chatId,
      '🔥 Không có gợi ý nào. Vui lòng gợi ý lại.',
      weanInlineKeyboard
    );
    return;
  }
  
  // Parse gợi ý để lấy danh sách món
  const { suggestion, ageMonths } = suggestionData;
  
  // Tìm các dòng bắt đầu bằng 🍽️
  let dishes = suggestion
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('🍽️'))
    .map(parseDishFromLine)
    .filter(d => d.name && d.name.length > 0 && d.name.length < 100);
    
  if (dishes.length === 0) {
    // Fallback: thử parse theo các pattern khác
    const fallbackDishes = suggestion
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        // Tìm dòng có vẻ là món ăn (bắt đầu bằng số hoặc bullet)
        return line && 
               (line.match(/^\d+[\.\)]\s*/) || line.match(/^[•\-\*]\s*/)) &&
               !line.includes('bữa/ngày') &&
               !line.includes('Số bữa') &&
               !line.includes('Lượng/bữa') &&
               line.length > 5 && 
               line.length < 200;
      })
      .map(line => {
        // Loại bỏ bullet points, số thứ tự
        let clean = line
          .replace(/^\d+[\.\)]\s*/, '')
          .replace(/^[•\-\*]\s*/, '')
          .replace(/^[🔥🍼🥄🥣🍲🥗🍽️]\s*/g, '')
          .trim();
        return parseDishFromLine('🍽️ ' + clean);
      })
      .filter(d => d.name && d.name.length > 0 && d.name.length < 100);
      
    if (fallbackDishes.length > 0) {
      dishes = fallbackDishes.slice(0, 5);
    }
  }
  
  if (dishes.length === 0) {
    await safeSendMessage(
      chatId,
      '🔥 Không thể parse gợi ý. Vui lòng thêm món thủ công.',
      weanInlineKeyboard
    );
    return;
  }
  
  // Thêm từng món vào database
  let addedCount = 0;
  const addedDishes = [];
  
  for (const dish of dishes.slice(0, 5)) { // Giới hạn 5 món
    try {
      // Tạo note chi tiết
      let fullNote = '';
      if (dish.ingredients) fullNote += `Nguyên liệu: ${dish.ingredients}`;
      if (dish.recipe) fullNote += `${fullNote ? '\n' : ''}Cách nấu: ${dish.recipe}`;
      if (dish.portion) fullNote += `${fullNote ? '\n' : ''}Khẩu phần: ${dish.portion}`;
      if (!fullNote && dish.note) fullNote = dish.note;
      if (!fullNote) fullNote = `Từ gợi ý AI (${ageMonths} tháng)`;
      
      await FoodLog.create({
        chatId,
        dishName: dish.name,
        note: fullNote
      });
      addedCount++;
      addedDishes.push({
        name: dish.name,
        portion: dish.portion || ''
      });
    } catch (error) {
      console.error(`Lỗi thêm món ${dish.name}:`, error);
    }
  }
  
  // Xóa gợi ý đã dùng
  aiSuggestions.delete(chatId);
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '✅ ĐÃ THÊM MÓN TỪ GỢI Ý',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🔥 Đã thêm ${addedCount} món:`,
    ''
  ];
  
  addedDishes.forEach((dish, i) => {
    const portionInfo = dish.portion ? ` (${dish.portion})` : '';
    lines.push(`   ${i + 1}. ${dish.name}${portionInfo}`);
  });
  
  lines.push('');
  lines.push('💡 Theo dõi phản ứng của bé trong 3 ngày nhé!');
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('👇 Bấm nút để tiếp tục:');
  
  await safeSendMessage(
    chatId,
    lines.join('\n'),
    weanInlineKeyboard
  );
};

/**
 * Đăng ký handlers cho wean
 */
export const registerWeanHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    if (text === '🔥 Ăn dặm') {
      clearState(chatId);
      await showWeanMenu(chatId);
      return;
    }
    
    // Xử lý input từ user đang chờ
    const state = getState(chatId);
    if (state?.type === 'wean_add') {
      clearState(chatId);
      const [dishPart, notePart] = text.split('|');
      await handleWeanAdd(chatId, dishPart, notePart);
      return;
    }
    
    if (state?.type === 'wean_allergy_dish') {
      setState(chatId, { type: 'wean_allergy_note', dishName: text });
      await safeSendMessage(chatId, '⚠️ Nhập triệu chứng dị ứng:\n\nVí dụ: Nổi mẩn đỏ quanh miệng');
      return;
    }
    
    if (state?.type === 'wean_allergy_note') {
      const dishName = state.dishName;
      clearState(chatId);
      await handleWeanAllergy(chatId, dishName, text);
      return;
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'wean_add') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'wean_add' });
      await safeSendMessage(
        chatId,
        '🔥 Nhập món ăn dặm:\n\nVí dụ: Cháo bí đỏ | 50ml sữa mẹ + bí đỏ hấp\n\n(Ghi chú sau dấu | là tùy chọn)'
      );
      return;
    }
    
    if (query.data === 'wean_list') {
      await bot.answerCallbackQuery(query.id);
      await handleWeanList(chatId);
      return;
    }
    
    if (query.data === 'wean_suggest') {
      await bot.answerCallbackQuery(query.id);
      await handleWeanSuggest(chatId);
      return;
    }
    
    if (query.data === 'wean_add_from_suggestion') {
      await bot.answerCallbackQuery(query.id, { text: 'Đang thêm món...' });
      await handleAddFromSuggestion(chatId);
      return;
    }
    
    if (query.data === 'wean_allergy') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'wean_allergy_dish' });
      await safeSendMessage(chatId, '⚠️ Nhập tên món gây dị ứng:');
      return;
    }
    
    // Xử lý chọn tuổi cho gợi ý
    if (query.data.startsWith('wean_age_')) {
      const months = parseInt(query.data.replace('wean_age_', ''), 10);
      await bot.answerCallbackQuery(query.id, { text: `Đã chọn ${months} tháng` });
      await handleWeanSuggest(chatId, months);
      return;
    }
  });

  // Commands
  bot.onText(/\/wean\s+add\s+(.+)/, async (msg, match) => {
    clearState(msg.chat.id);
    const [dishPart, notePart] = (match?.[1] || '').split('|');
    await handleWeanAdd(msg.chat.id, dishPart, notePart);
  });

  bot.onText(/\/wean\s+list/, async (msg) => {
    clearState(msg.chat.id);
    await handleWeanList(msg.chat.id);
  });

  bot.onText(/\/wean\s+allergy\s+(.+)/, async (msg, match) => {
    clearState(msg.chat.id);
    const [dishPart, notePart] = (match?.[1] || '').split('|');
    await handleWeanAllergy(msg.chat.id, dishPart, notePart);
  });

  bot.onText(/\/wean\s+suggest(?:\s+(\d+))?/, async (msg, match) => {
    clearState(msg.chat.id);
    const months = match?.[1] ? parseInt(match[1], 10) : null;
    await handleWeanSuggest(msg.chat.id, months);
  });
  
  // /wean không có tham số -> hiển thị menu
  bot.onText(/\/wean\s*$/, async (msg) => {
    clearState(msg.chat.id);
    await showWeanMenu(msg.chat.id);
  });
};

export default registerWeanHandler;
