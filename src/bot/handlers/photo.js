import { bot, safeSendMessage } from '../index.js';
import { config } from '../../config/index.js';
import { PhotoAnalysisLog } from '../../database/models/index.js';
import { downloadTelegramPhoto, analyzeImageWithGemini } from '../../services/aiService.js';

/**
 * Phân tích ảnh y tế
 */
const analyzePhoto = async (chatId, photoId) => {
  const file = await bot.getFile(photoId);
  const base64 = await downloadTelegramPhoto(config.botToken, file.file_path);
  const analysis = await analyzeImageWithGemini(base64);

  // Lưu log
  await PhotoAnalysisLog.create({ chatId, fileId: photoId, analysis });

  // Forward đến admin nếu có
  if (config.adminChatId) {
    await bot
      .sendMessage(
        config.adminChatId,
        `📸 Phân tích ảnh từ chat ${chatId}:\n\n${analysis}\n\n📁 File: ${file.file_path}`
      )
      .catch((error) => console.error('Không gửi được báo cáo admin:', error));
  }

  return analysis;
};

/**
 * Đăng ký handler cho photo
 */
export const registerPhotoHandler = () => {
  bot.on('photo', async (msg) => {
    try {
      const photo = msg.photo?.at(-1);
      if (!photo) return;

      await safeSendMessage(
        msg.chat.id, 
        '🔬 Em đang phân tích ảnh với AI bác sĩ chuyên khoa, chờ xíu nhé...', 
        {}, 
        'low'
      );
      
      const analysis = await analyzePhoto(msg.chat.id, photo.file_id);
      
      await safeSendMessage(
        msg.chat.id,
        `🏥 **KẾT QUẢ PHÂN TÍCH:**\n\n${analysis}\n\n` +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        '⚠️ **LƯU Ý QUAN TRỌNG:**\n' +
        '• Đây chỉ là tham khảo từ AI, không thay thế khám bác sĩ\n' +
        '• Nếu triệu chứng nặng hoặc kéo dài, hãy đến cơ sở y tế\n' +
        '• Gửi thêm ảnh nếu cần phân tích tiếp',
        { parse_mode: 'Markdown' },
        'high'
      );
    } catch (error) {
      console.error('Lỗi phân tích ảnh:', error);
      await safeSendMessage(
        msg.chat.id, 
        '🔬 Em chưa xem được ảnh này. Bố/mẹ thử gửi lại ảnh rõ hơn nhé.\n\n' +
        '💡 Mẹo chụp ảnh:\n' +
        '• Chụp gần, rõ nét vùng cần kiểm tra\n' +
        '• Đủ ánh sáng tự nhiên\n' +
        '• Không bị mờ hoặc rung',
        {}, 
        'normal'
      );
    }
  });
};

export default registerPhotoHandler;
