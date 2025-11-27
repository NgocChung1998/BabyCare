import { bot, safeSendMessage } from '../index.js';
import { SyncGroup, ChatProfile } from '../../database/models/index.js';
import { buildInlineKeyboard, mainKeyboard } from '../keyboard.js';
import { clearState, setState, getState } from '../../utils/stateManager.js';

/**
 * Hiển thị menu đồng bộ
 */
const showSyncMenu = async (chatId) => {
  const group = await SyncGroup.findGroupByChatId(chatId);
  
  if (group) {
    // Đã có nhóm
    const memberLines = group.members.map((m, i) => {
      const roleIcon = m.role === 'owner' ? '👑' : '👤';
      const isMe = m.chatId === chatId ? ' (Bạn)' : '';
      return `   ${i + 1}. ${roleIcon} ${m.displayName || 'Thành viên'}${isMe}`;
    });
    
    const lines = [
      '━━━━━━━━━━━━━━━━━━━━',
      '🔗 ĐỒNG BỘ GIA ĐÌNH',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `📛 Nhóm: ${group.groupName}`,
      `🔑 Mã: ${group.groupCode}`,
      '',
      '👥 Thành viên:',
      ...memberLines,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '💡 Chia sẻ mã nhóm để người khác tham gia!'
    ];
    
    const keyboard = buildInlineKeyboard([
      [
        { text: '📤 Chia sẻ mã', callback_data: 'sync_share' },
        { text: '✏️ Đổi tên', callback_data: 'sync_rename' }
      ],
      [
        { text: '🔔 Bật thông báo', callback_data: 'sync_notify_on' },
        { text: '🔕 Tắt thông báo', callback_data: 'sync_notify_off' }
      ],
      [
        { text: '🚪 Rời nhóm', callback_data: 'sync_leave' }
      ]
    ]);
    
    await safeSendMessage(chatId, lines.join('\n'), keyboard);
  } else {
    // Chưa có nhóm
    const lines = [
      '━━━━━━━━━━━━━━━━━━━━',
      '🔗 ĐỒNG BỘ GIA ĐÌNH',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '👨‍👩‍👧 Đồng bộ thông tin giữa bố và mẹ!',
      '',
      '✨ Khi đồng bộ:',
      '   • Cả 2 đều thấy lịch ăn, ngủ, tiêm chủng',
      '   • Nhận thông báo khi người kia cập nhật',
      '   • Dùng chung dữ liệu theo dõi bé',
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '👇 Chọn một trong hai:'
    ];
    
    const keyboard = buildInlineKeyboard([
      [
        { text: '➕ Tạo nhóm mới', callback_data: 'sync_create' }
      ],
      [
        { text: '🔗 Tham gia nhóm', callback_data: 'sync_join' }
      ]
    ]);
    
    await safeSendMessage(chatId, lines.join('\n'), keyboard);
  }
};

/**
 * Tạo nhóm mới
 */
const handleCreateGroup = async (chatId, displayName = 'Bố/Mẹ') => {
  // Kiểm tra đã có nhóm chưa
  const existingGroup = await SyncGroup.findGroupByChatId(chatId);
  if (existingGroup) {
    await safeSendMessage(
      chatId,
      `❌ Bạn đã trong nhóm "${existingGroup.groupName}".\n\nRời nhóm trước để tạo nhóm mới.`,
      mainKeyboard
    );
    return;
  }
  
  // Tạo mã nhóm
  const groupCode = await SyncGroup.generateGroupCode();
  
  // Lấy thông tin profile
  const profile = await ChatProfile.findOne({ chatId });
  
  // Tạo nhóm
  const group = await SyncGroup.create({
    groupCode,
    groupName: profile?.firstName ? `Gia đình bé của ${profile.firstName}` : 'Gia đình bé',
    primaryChatId: chatId,
    members: [{
      chatId,
      role: 'owner',
      displayName
    }]
  });
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '✅ ĐÃ TẠO NHÓM',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `📛 Nhóm: ${group.groupName}`,
    '',
    `🔑 MÃ NHÓM: ${groupCode}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '📤 Gửi mã này cho bố/mẹ để tham gia!',
    '',
    '💡 Họ chỉ cần nhập: /sync join ' + groupCode
  ];
  
  const keyboard = buildInlineKeyboard([
    [{ text: '📤 Chia sẻ mã', callback_data: 'sync_share' }],
    [{ text: '◀️ Quay lại', callback_data: 'sync_menu' }]
  ]);
  
  await safeSendMessage(chatId, lines.join('\n'), keyboard);
};

/**
 * Tham gia nhóm
 */
const handleJoinGroup = async (chatId, groupCode, displayName = 'Bố/Mẹ') => {
  // Kiểm tra đã có nhóm chưa
  const existingGroup = await SyncGroup.findGroupByChatId(chatId);
  if (existingGroup) {
    await safeSendMessage(
      chatId,
      `❌ Bạn đã trong nhóm "${existingGroup.groupName}".\n\nRời nhóm trước để tham gia nhóm khác.`,
      mainKeyboard
    );
    return;
  }
  
  // Tìm nhóm
  const group = await SyncGroup.findOne({ 
    groupCode: groupCode.toUpperCase(),
    isActive: true 
  });
  
  if (!group) {
    await safeSendMessage(
      chatId,
      '❌ Không tìm thấy nhóm với mã này.\n\nKiểm tra lại mã và thử lại!',
      mainKeyboard
    );
    return;
  }
  
  // Kiểm tra đã là thành viên chưa
  if (group.members.some(m => m.chatId === chatId)) {
    await safeSendMessage(
      chatId,
      '✅ Bạn đã là thành viên của nhóm này rồi!',
      mainKeyboard
    );
    return;
  }
  
  // Thêm vào nhóm
  group.members.push({
    chatId,
    role: 'member',
    displayName
  });
  await group.save();
  
  // Thông báo cho các thành viên khác
  const otherChatIds = group.getOtherChatIds(chatId);
  for (const otherId of otherChatIds) {
    await safeSendMessage(
      otherId,
      `🔔 ${displayName} đã tham gia nhóm "${group.groupName}"!`
    );
  }
  
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    '✅ ĐÃ THAM GIA NHÓM',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `📛 Nhóm: ${group.groupName}`,
    `👥 Số thành viên: ${group.members.length}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '🎉 Bây giờ bạn có thể xem và cập nhật thông tin bé!',
    '',
    '💡 Mọi thay đổi sẽ được đồng bộ cho tất cả thành viên.'
  ];
  
  await safeSendMessage(chatId, lines.join('\n'), mainKeyboard);
};

/**
 * Rời nhóm
 */
const handleLeaveGroup = async (chatId) => {
  const group = await SyncGroup.findGroupByChatId(chatId);
  
  if (!group) {
    await safeSendMessage(chatId, '❌ Bạn chưa tham gia nhóm nào.', mainKeyboard);
    return;
  }
  
  const member = group.members.find(m => m.chatId === chatId);
  const isOwner = member?.role === 'owner';
  
  // Nếu là owner và còn thành viên khác
  if (isOwner && group.members.length > 1) {
    // Chuyển quyền cho thành viên tiếp theo
    const newOwner = group.members.find(m => m.chatId !== chatId);
    if (newOwner) {
      newOwner.role = 'owner';
      group.primaryChatId = newOwner.chatId;
    }
  }
  
  // Xóa khỏi nhóm
  group.members = group.members.filter(m => m.chatId !== chatId);
  
  // Nếu không còn ai, xóa nhóm
  if (group.members.length === 0) {
    group.isActive = false;
  }
  
  await group.save();
  
  // Thông báo cho các thành viên còn lại
  const displayName = member?.displayName || 'Thành viên';
  for (const otherId of group.getOtherChatIds(chatId)) {
    await safeSendMessage(
      otherId,
      `🔔 ${displayName} đã rời khỏi nhóm.`
    );
  }
  
  await safeSendMessage(
    chatId,
    '✅ Đã rời khỏi nhóm.\n\nBạn có thể tạo nhóm mới hoặc tham gia nhóm khác.',
    mainKeyboard
  );
};

/**
 * Gửi thông báo đồng bộ cho các thành viên khác
 * @param {number} fromChatId - Chat ID người gửi
 * @param {string} message - Nội dung thông báo
 */
export const notifySyncMembers = async (fromChatId, message) => {
  const group = await SyncGroup.findGroupByChatId(fromChatId);
  if (!group) return;
  
  const member = group.members.find(m => m.chatId === fromChatId);
  const displayName = member?.displayName || 'Bố/Mẹ';
  
  const otherChatIds = group.getOtherChatIds(fromChatId);
  for (const otherId of otherChatIds) {
    await safeSendMessage(
      otherId,
      `🔔 ${displayName}: ${message}`
    );
  }
};

/**
 * Lấy primary chatId của nhóm (để query dữ liệu)
 * @param {number} chatId - Chat ID hiện tại
 * @returns {number} - Primary chatId hoặc chatId gốc nếu không có nhóm
 */
export const getPrimaryChatId = async (chatId) => {
  const group = await SyncGroup.findGroupByChatId(chatId);
  return group ? group.primaryChatId : chatId;
};

/**
 * Lấy tất cả chatId trong nhóm (để query dữ liệu từ tất cả thành viên)
 * @param {number} chatId - Chat ID hiện tại
 * @returns {number[]} - Danh sách chatId
 */
export const getGroupChatIds = async (chatId) => {
  const group = await SyncGroup.findGroupByChatId(chatId);
  return group ? group.getAllChatIds() : [chatId];
};

/**
 * Đăng ký handlers cho sync
 */
export const registerSyncHandler = () => {
  // Button press
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    if (text === '🔗 Đồng bộ') {
      clearState(chatId);
      await showSyncMenu(chatId);
      return;
    }
    
    // Xử lý input từ user
    const state = getState(chatId);
    
    if (state?.type === 'sync_input_code') {
      clearState(chatId);
      const code = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 6) {
        await safeSendMessage(chatId, '❌ Mã nhóm phải có 6 ký tự!\n\nNhập lại:');
        setState(chatId, { type: 'sync_input_code' });
        return;
      }
      await handleJoinGroup(chatId, code, state.displayName || 'Bố/Mẹ');
      return;
    }
    
    if (state?.type === 'sync_input_name') {
      const displayName = text.trim().slice(0, 20);
      const action = state.action; // Lưu action trước khi clear
      clearState(chatId);
      
      if (action === 'create') {
        await handleCreateGroup(chatId, displayName);
      } else if (action === 'join') {
        setState(chatId, { type: 'sync_input_code', displayName });
        await safeSendMessage(chatId, '🔑 Nhập mã nhóm (6 ký tự):');
      } else {
        await showSyncMenu(chatId);
      }
      return;
    }
    
    if (state?.type === 'sync_rename') {
      clearState(chatId);
      const group = await SyncGroup.findGroupByChatId(chatId);
      if (group) {
        group.groupName = text.trim().slice(0, 50);
        await group.save();
        await safeSendMessage(chatId, `✅ Đã đổi tên nhóm thành: ${group.groupName}`, mainKeyboard);
      }
      return;
    }
  });

  // Callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'sync_menu') {
      await bot.answerCallbackQuery(query.id);
      clearState(chatId);
      await showSyncMenu(chatId);
      return;
    }
    
    if (query.data === 'sync_create') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'sync_input_name', action: 'create' });
      
      const keyboard = buildInlineKeyboard([
        [
          { text: '👨 Bố', callback_data: 'sync_role_bo' },
          { text: '👩 Mẹ', callback_data: 'sync_role_me' }
        ],
        [
          { text: '👴 Ông', callback_data: 'sync_role_ong' },
          { text: '👵 Bà', callback_data: 'sync_role_ba' }
        ],
        [
          { text: '❌ Hủy', callback_data: 'sync_menu' }
        ]
      ]);
      
      await safeSendMessage(
        chatId,
        '👤 Bạn là ai trong gia đình?\n\n(Hoặc nhập tên khác)',
        keyboard
      );
      return;
    }
    
    if (query.data === 'sync_join') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'sync_input_name', action: 'join' });
      
      const keyboard = buildInlineKeyboard([
        [
          { text: '👨 Bố', callback_data: 'sync_role_bo' },
          { text: '👩 Mẹ', callback_data: 'sync_role_me' }
        ],
        [
          { text: '👴 Ông', callback_data: 'sync_role_ong' },
          { text: '👵 Bà', callback_data: 'sync_role_ba' }
        ],
        [
          { text: '❌ Hủy', callback_data: 'sync_menu' }
        ]
      ]);
      
      await safeSendMessage(
        chatId,
        '👤 Bạn là ai trong gia đình?\n\n(Hoặc nhập tên khác)',
        keyboard
      );
      return;
    }
    
    // Chọn vai trò nhanh (dùng mã ASCII thay vì tiếng Việt)
    if (query.data.startsWith('sync_role_')) {
      const roleMap = {
        'bo': 'Bố',
        'me': 'Mẹ',
        'ong': 'Ông',
        'ba': 'Bà'
      };
      const roleKey = query.data.replace('sync_role_', '');
      const displayName = roleMap[roleKey] || roleKey;
      
      await bot.answerCallbackQuery(query.id, { text: `Đã chọn: ${displayName}` });
      
      // Lấy state TRƯỚC khi clear
      const state = getState(chatId);
      const action = state?.action;
      clearState(chatId);
      
      console.log(`[Sync] Role selected: ${displayName}, action: ${action}, chatId: ${chatId}`);
      
      if (action === 'create') {
        await handleCreateGroup(chatId, displayName);
      } else if (action === 'join') {
        setState(chatId, { type: 'sync_input_code', displayName });
        await safeSendMessage(chatId, '🔑 Nhập mã nhóm (6 ký tự):');
      } else {
        // Nếu không có action, quay lại menu
        console.log(`[Sync] No action found, showing menu`);
        await showSyncMenu(chatId);
      }
      return;
    }
    
    if (query.data === 'sync_share') {
      await bot.answerCallbackQuery(query.id);
      const group = await SyncGroup.findGroupByChatId(chatId);
      if (group) {
        const shareText = `🔗 Tham gia nhóm "${group.groupName}" để cùng theo dõi bé!\n\n🔑 Mã nhóm: ${group.groupCode}\n\n📱 Nhập lệnh: /sync join ${group.groupCode}`;
        await safeSendMessage(chatId, shareText, mainKeyboard);
      }
      return;
    }
    
    if (query.data === 'sync_rename') {
      await bot.answerCallbackQuery(query.id);
      setState(chatId, { type: 'sync_rename' });
      await safeSendMessage(chatId, '✏️ Nhập tên mới cho nhóm:');
      return;
    }
    
    if (query.data === 'sync_leave') {
      await bot.answerCallbackQuery(query.id);
      
      const confirmKeyboard = buildInlineKeyboard([
        [
          { text: '✅ Xác nhận rời', callback_data: 'sync_leave_confirm' },
          { text: '❌ Hủy', callback_data: 'sync_menu' }
        ]
      ]);
      
      await safeSendMessage(
        chatId,
        '⚠️ Bạn có chắc muốn rời khỏi nhóm?\n\nBạn sẽ không còn nhận thông báo từ các thành viên khác.',
        confirmKeyboard
      );
      return;
    }
    
    if (query.data === 'sync_leave_confirm') {
      await bot.answerCallbackQuery(query.id);
      await handleLeaveGroup(chatId);
      return;
    }
  });

  // Commands
  bot.onText(/\/sync\s+create(?:\s+(.+))?/, async (msg, match) => {
    clearState(msg.chat.id);
    const displayName = match?.[1]?.trim() || 'Bố/Mẹ';
    await handleCreateGroup(msg.chat.id, displayName);
  });

  bot.onText(/\/sync\s+join\s+(\w+)(?:\s+(.+))?/, async (msg, match) => {
    clearState(msg.chat.id);
    const code = match?.[1] || '';
    const displayName = match?.[2]?.trim() || 'Bố/Mẹ';
    await handleJoinGroup(msg.chat.id, code, displayName);
  });

  bot.onText(/\/sync\s+leave/, async (msg) => {
    clearState(msg.chat.id);
    await handleLeaveGroup(msg.chat.id);
  });
  
  bot.onText(/\/sync\s*$/, async (msg) => {
    clearState(msg.chat.id);
    await showSyncMenu(msg.chat.id);
  });
};

export default registerSyncHandler;

