import mongoose from 'mongoose';

const syncGroupSchema = new mongoose.Schema(
  {
    // Mã nhóm đồng bộ (6 ký tự)
    groupCode: { 
      type: String, 
      unique: true, 
      required: true,
      uppercase: true,
      minlength: 6,
      maxlength: 6
    },
    // Tên nhóm (tên bé)
    groupName: { 
      type: String, 
      default: 'Gia đình bé' 
    },
    // Thành viên trong nhóm
    members: [{
      chatId: { type: Number, required: true },
      role: { 
        type: String, 
        enum: ['owner', 'member'], 
        default: 'member' 
      },
      displayName: String, // Bố, Mẹ, Bà, Ông...
      joinedAt: { type: Date, default: Date.now }
    }],
    // Chat ID chính (dùng để lấy dữ liệu)
    primaryChatId: { type: Number, required: true },
    // Trạng thái
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Index để tìm nhanh
syncGroupSchema.index({ 'members.chatId': 1 });
syncGroupSchema.index({ groupCode: 1 });

/**
 * Tạo mã nhóm ngẫu nhiên
 */
syncGroupSchema.statics.generateGroupCode = async function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Bỏ O, 0, I, 1 để tránh nhầm
  let code;
  let exists = true;
  
  while (exists) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    exists = await this.findOne({ groupCode: code });
  }
  
  return code;
};

/**
 * Tìm nhóm của một chatId
 */
syncGroupSchema.statics.findGroupByChatId = async function(chatId) {
  return this.findOne({ 
    'members.chatId': chatId,
    isActive: true 
  });
};

/**
 * Lấy tất cả chatId trong nhóm
 */
syncGroupSchema.methods.getAllChatIds = function() {
  return this.members.map(m => m.chatId);
};

/**
 * Lấy chatId khác trong nhóm (để gửi thông báo)
 */
syncGroupSchema.methods.getOtherChatIds = function(excludeChatId) {
  return this.members
    .filter(m => m.chatId !== excludeChatId)
    .map(m => m.chatId);
};

export const SyncGroup = mongoose.model('SyncGroup', syncGroupSchema);
export default SyncGroup;

