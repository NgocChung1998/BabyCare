/**
 * State Manager - Quản lý trạng thái input của user
 * Khi user chuyển chức năng khác, tự động clear state cũ
 */

const userStates = new Map();

/**
 * Lưu state cho user
 */
export const setState = (chatId, state) => {
  userStates.set(chatId, state);
};

/**
 * Lấy state của user
 */
export const getState = (chatId) => {
  return userStates.get(chatId);
};

/**
 * Xóa state của user
 */
export const clearState = (chatId) => {
  userStates.delete(chatId);
};

/**
 * Kiểm tra và clear state nếu user chuyển chức năng
 * @param {number} chatId - Chat ID
 * @param {string} action - Hành động mới (button press, callback, etc.)
 */
export const checkAndClearState = (chatId, action) => {
  const currentState = getState(chatId);
  
  // Nếu có state đang chờ input và user chuyển sang chức năng khác
  if (currentState && action !== 'input') {
    clearState(chatId);
    return true; // Đã clear state
  }
  
  return false; // Không có state hoặc vẫn đang input
};

/**
 * Đăng ký handler để tự động clear state khi user bấm button chính
 */
export const registerStateCleaner = (bot, mainButtons) => {
  bot.on('message', (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();
    
    // Nếu user bấm button chính, clear state
    if (mainButtons.includes(text)) {
      clearState(msg.chat.id);
    }
  });
  
  // Clear state khi user bấm callback query
  bot.on('callback_query', (query) => {
    clearState(query.message.chat.id);
  });
};

export default {
  setState,
  getState,
  clearState,
  checkAndClearState,
  registerStateCleaner
};

