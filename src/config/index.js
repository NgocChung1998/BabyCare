import dotenv from 'dotenv';

dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN,
  geminiApiKey: process.env.GEMINI_API_KEY,
  mongoUri: process.env.MONGO_URI,
  adminChatId: process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : null,
  nodeEnv: process.env.NODE_ENV || 'development'
};

export const CONSTANTS = {
  MILK_INTERVAL_MINUTES: 150,
  DIAPER_MIN_MINUTES: 180,
  DIAPER_MAX_MINUTES: 240,
  SCHEDULE_REMINDER_HOUR: 6,
  WEEKLY_SLEEP_HOUR: 20,
  DEFAULT_TIMEZONE: 'Asia/Ho_Chi_Minh'
};

export const DEFAULT_SCHEDULE_ITEMS = [
  { time: '06:30', title: '🍼 Bú sáng', type: 'milk' },
  { time: '07:00', title: '🌤️ Vitamin D & men vi sinh', type: 'supplement' },
  { time: '08:30', title: '😴 Giấc ngủ sáng', type: 'sleep' },
  { time: '10:00', title: '🎲 Chơi tương tác', type: 'play' },
  { time: '11:30', title: '🍼 Bú trưa', type: 'milk' },
  { time: '13:00', title: '😴 Nap trưa', type: 'sleep' },
  { time: '15:00', title: '🧸 Chơi tummy time', type: 'play' },
  { time: '16:00', title: '🧷 Kiểm tra tã', type: 'diaper' },
  { time: '17:00', title: '🛁 Tắm & massage', type: 'bath' },
  { time: '19:00', title: '🍼 Bú tối', type: 'milk' },
  { time: '20:00', title: '🌙 Chuẩn bị ngủ đêm', type: 'sleep' }
];

export const SLEEP_RECOMMENDATIONS = [
  { min: 0, max: 3, totalHours: '14-17h', naps: '4-6 giấc ngắn' },
  { min: 3, max: 6, totalHours: '14-16h', naps: '3-5 giấc' },
  { min: 6, max: 9, totalHours: '13-15h', naps: '2-4 giấc' },
  { min: 9, max: 12, totalHours: '12-15h', naps: '2-3 giấc' },
  { min: 12, max: 24, totalHours: '12-14h', naps: '1-2 giấc' },
  { min: 24, max: 60, totalHours: '11-13h', naps: '1 giấc' }
];

export const WEAN_SUGGESTIONS = [
  {
    min: 6,
    max: 8,
    ideas: ['Bí đỏ nghiền với yến mạch', 'Súp khoai lang + sữa mẹ', 'Bơ dầm chuối chín']
  },
  {
    min: 8,
    max: 10,
    ideas: ['Cháo cá hồi + rau củ', 'Súp gà nấm', 'Táo hấp quế']
  },
  {
    min: 10,
    max: 12,
    ideas: ['Cháo thịt bò cải bó xôi', 'Khoai tây nghiền phô mai', 'Bánh pancake chuối trứng']
  },
  {
    min: 12,
    max: 36,
    ideas: ['Cơm nắm rong biển', 'Pasta sốt bí đỏ', 'Canh rau củ + thịt viên']
  }
];

export const GIFT_IDEAS = [
  {
    min: 0,
    max: 6,
    toys: ['Thảm nằm chơi', 'Lục lạc mềm', 'Đèn ngủ ru bé'],
    baby: ['Bộ quần áo cotton hữu cơ', 'Khăn muslin cao cấp'],
    parents: ['Gối ôm hỗ trợ cho mẹ', 'Bình giữ nhiệt pha sữa']
  },
  {
    min: 6,
    max: 12,
    toys: ['Xe tập đi mềm', 'Bộ xếp chồng silicon', 'Sách vải tương tác'],
    baby: ['Ghế ăn dặm gọn nhẹ', 'Bộ dụng cụ ăn dặm'],
    parents: ['Phiếu spa thư giãn nhanh', 'Máy ủ ấm khăn']
  },
  {
    min: 12,
    max: 24,
    toys: ['Bộ lego to an toàn', 'Xe chòi chân', 'Đàn gõ mini'],
    baby: ['Balo mini đáng yêu', 'Đồ bơi chống nắng'],
    parents: ['Máy pha cà phê mini', 'Sách nuôi dạy con tích cực']
  },
  {
    min: 24,
    max: 72,
    toys: ['Bộ nấu ăn giả tưởng', 'Đồ chơi STEM đơn giản', 'Tranh ghép gỗ'],
    baby: ['Đồng hồ hoạt hình tập xem giờ', 'Balo mẫu giáo'],
    parents: ['Voucher hẹn hò', 'Khóa học ngắn online']
  }
];

const requiredEnv = ['botToken', 'geminiApiKey', 'mongoUri'];
const missingEnv = requiredEnv.filter((key) => !config[key]);

if (missingEnv.length) {
  throw new Error(`Thiếu biến môi trường: ${missingEnv.join(', ')}`);
}

export default config;

