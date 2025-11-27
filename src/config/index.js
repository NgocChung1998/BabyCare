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

// ===== LỊCH TIÊM CHỦNG VIỆT NAM THEO THÁNG TUỔI (VNVC 2024) =====
// Dựa trên lịch tiêm chủng của Hệ thống tiêm chủng VNVC
export const VACCINATION_SCHEDULE = [
  // ========== SƠ SINH (24h đầu) ==========
  { ageMonths: 0, ageDays: 0, name: 'Viêm gan B (mũi sơ sinh)', required: true, note: 'Tiêm trong vòng 24h sau sinh' },
  { ageMonths: 0, ageDays: 0, name: 'Lao (BCG)', required: true, note: 'Tiêm trong vòng 24h sau sinh' },
  
  // ========== 6 TUẦN TUỔI (1.5 tháng) ==========
  { ageMonths: 1, ageDays: 14, name: '6in1 Infanrix/Hexaxim (mũi 1)', required: true, note: 'Bạch hầu, ho gà, uốn ván, bại liệt, viêm gan B, Hib' },
  { ageMonths: 1, ageDays: 14, name: 'Rotavirus (liều 1)', required: false, note: 'Phòng tiêu chảy cấp' },
  { ageMonths: 1, ageDays: 14, name: 'Phế cầu Synflorix/Prevenar (mũi 1)', required: false, note: 'Phòng viêm phổi, viêm tai giữa, viêm màng não' },
  { ageMonths: 1, ageDays: 14, name: 'Não mô cầu ACYW-135 Nimenrix (mũi 1)', required: false, note: 'Phòng viêm màng não do não mô cầu' },
  
  // ========== 2 THÁNG TUỔI ==========
  { ageMonths: 2, name: 'Não mô cầu B Bexsero (mũi 1)', required: false, note: 'Phòng viêm màng não do não mô cầu nhóm B' },
  
  // ========== 3 THÁNG TUỔI ==========
  { ageMonths: 3, name: '6in1 Infanrix/Hexaxim (mũi 2)', required: true },
  { ageMonths: 3, name: 'Rotavirus (liều 2)', required: false },
  { ageMonths: 3, name: 'Phế cầu Synflorix/Prevenar (mũi 2)', required: false },
  
  // ========== 4 THÁNG TUỔI ==========
  { ageMonths: 4, name: '6in1 Infanrix/Hexaxim (mũi 3)', required: true },
  { ageMonths: 4, name: 'Rotavirus (liều 3)', required: false },
  { ageMonths: 4, name: 'Phế cầu Synflorix/Prevenar (mũi 3)', required: false },
  { ageMonths: 4, name: 'Não mô cầu B Bexsero (mũi 2)', required: false },
  { ageMonths: 4, name: 'Não mô cầu ACYW-135 Nimenrix (mũi 2)', required: false },
  
  // ========== 6 THÁNG TUỔI ==========
  { ageMonths: 6, name: 'Cúm mùa (mũi 1)', required: false, note: 'Trẻ < 9 tuổi tiêm lần đầu cần 2 mũi cách 1 tháng' },
  { ageMonths: 6, name: 'Não mô cầu B+C VA-MENGOC (mũi 1)', required: false, note: 'Nếu chưa tiêm Bexsero' },
  { ageMonths: 6, name: 'Não mô cầu ACYW-135 MenQuadfi (mũi 3)', required: false },
  
  // ========== 7 THÁNG TUỔI ==========
  { ageMonths: 7, name: 'Cúm mùa (mũi 2)', required: false },
  
  // ========== 9 THÁNG TUỔI ==========
  { ageMonths: 9, name: 'Sởi-Quai bị-Rubella Priorix (mũi 1)', required: true, note: 'Hoặc tiêm Sởi đơn' },
  { ageMonths: 9, name: 'Thủy đậu Varilrix (mũi 1)', required: false },
  { ageMonths: 9, name: 'Viêm não Nhật Bản Imojev (mũi 1)', required: true, note: 'Vắc xin sống giảm độc lực' },
  { ageMonths: 9, name: 'Não mô cầu ACYW-135 Menactra (mũi 1)', required: false, note: 'Nếu chưa tiêm Nimenrix/MenQuadfi' },
  
  // ========== 12 THÁNG TUỔI (1 tuổi) ==========
  { ageMonths: 12, name: 'Sởi-Quai bị-Rubella Priorix/MMR-II (mũi 2)', required: true, note: 'Mũi 2 nếu đã tiêm Priorix lúc 9 tháng' },
  { ageMonths: 12, name: 'Thủy đậu (mũi 2)', required: false },
  { ageMonths: 12, name: 'Viêm não Nhật Bản Jevax (mũi 1+2)', required: true, note: '2 mũi cách nhau 1-2 tuần. Nếu chưa tiêm Imojev' },
  { ageMonths: 12, name: 'Viêm gan A Avaxim (mũi 1)', required: false },
  { ageMonths: 12, name: 'Phế cầu (mũi 4 - nhắc lại)', required: false },
  { ageMonths: 12, name: 'Viêm gan A+B Twinrix (mũi 1)', required: false },
  { ageMonths: 12, name: 'Não mô cầu B Bexsero (mũi 3)', required: false },
  { ageMonths: 12, name: 'Não mô cầu ACYW-135 Menactra (mũi 2)', required: false, note: 'Nếu tiêm mũi 1 lúc 9 tháng' },
  { ageMonths: 12, name: 'Não mô cầu ACYW-135 Nimenrix (mũi 3)', required: false },
  
  // ========== 15-18 THÁNG TUỔI ==========
  { ageMonths: 15, name: '6in1/5in1 (mũi 4 - nhắc lại)', required: true },
  { ageMonths: 18, name: 'Viêm gan A Avaxim (mũi 2)', required: false },
  { ageMonths: 18, name: 'Viêm gan A+B Twinrix (mũi 2)', required: false },
  { ageMonths: 18, name: 'Sởi-Quai bị-Rubella MMR-II (mũi 2)', required: true, note: 'Nếu chưa tiêm đủ 2 mũi' },
  
  // ========== 24 THÁNG TUỔI (2 tuổi) ==========
  { ageMonths: 24, name: 'Viêm não Nhật Bản Jevax (mũi 3)', required: true, note: 'Nếu tiêm Jevax' },
  { ageMonths: 24, name: 'Viêm não Nhật Bản Imojev (mũi 2)', required: true, note: 'Nếu tiêm Imojev' },
  { ageMonths: 24, name: 'Thương hàn Typhim VI (1 mũi)', required: false, note: 'Tiêm nhắc mỗi 3 năm' },
  { ageMonths: 24, name: 'Tả Morcvax (2 liều)', required: false, note: '2 liều cách nhau tối thiểu 2 tuần' },
  { ageMonths: 24, name: 'Phế cầu Pneumovax 23 (1 mũi)', required: false, note: 'Cho trẻ từ 2 tuổi' },
  
  // ========== 4 TUỔI TRỞ LÊN ==========
  { ageMonths: 48, name: 'Sốt xuất huyết Qdenga (mũi 1)', required: false, note: '2 mũi cách nhau 3 tháng' },
  { ageMonths: 48, name: 'Sởi-Quai bị-Rubella Priorix (mũi 3)', required: false, note: 'Mũi khuyến cáo' },
  { ageMonths: 51, name: 'Sốt xuất huyết Qdenga (mũi 2)', required: false },
  
  // ========== 5 TUỔI ==========
  { ageMonths: 60, name: 'Viêm não Nhật Bản Jevax (mũi nhắc)', required: true },
  { ageMonths: 60, name: 'DPT (Bạch hầu-Ho gà-Uốn ván) nhắc lại', required: true },
  { ageMonths: 60, name: 'Bại liệt IPV nhắc lại', required: true },
  
  // ========== HÀNG NĂM ==========
  { ageMonths: 6, name: 'Cúm mùa (tiêm nhắc hàng năm)', required: false, recurring: true, note: 'Tiêm nhắc 1 mũi mỗi năm' }
];

// ===== LỊCH ĂN NGỦ THEO ĐỘ TUỔI =====
export const DAILY_SCHEDULE_BY_AGE = [
  {
    minMonths: 0, maxMonths: 3,
    feedingIntervalHours: 2.5,
    feeds: ['06:00', '08:30', '11:00', '13:30', '16:00', '18:30', '21:00', '00:00', '03:00'],
    sleeps: [
      { start: '07:00', duration: 60, name: 'Nap 1' },
      { start: '09:30', duration: 60, name: 'Nap 2' },
      { start: '12:00', duration: 90, name: 'Nap 3' },
      { start: '15:00', duration: 60, name: 'Nap 4' },
      { start: '17:30', duration: 45, name: 'Nap 5' },
      { start: '20:00', duration: 600, name: 'Ngủ đêm' }
    ],
    totalSleep: '14-17h', nightSleep: '8-10h', naps: '4-6 giấc'
  },
  {
    minMonths: 3, maxMonths: 6,
    feedingIntervalHours: 3,
    feeds: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '03:00'],
    sleeps: [
      { start: '08:00', duration: 90, name: 'Nap sáng' },
      { start: '12:00', duration: 120, name: 'Nap trưa' },
      { start: '16:00', duration: 60, name: 'Nap chiều' },
      { start: '19:30', duration: 660, name: 'Ngủ đêm' }
    ],
    totalSleep: '14-16h', nightSleep: '10-12h', naps: '3-4 giấc'
  },
  {
    minMonths: 6, maxMonths: 9,
    feedingIntervalHours: 3.5,
    feeds: ['06:30', '10:00', '13:30', '17:00', '20:30'],
    sleeps: [
      { start: '09:00', duration: 90, name: 'Nap sáng' },
      { start: '13:00', duration: 120, name: 'Nap trưa' },
      { start: '17:00', duration: 45, name: 'Nap chiều (nếu cần)' },
      { start: '19:30', duration: 660, name: 'Ngủ đêm' }
    ],
    totalSleep: '13-15h', nightSleep: '10-12h', naps: '2-3 giấc'
  },
  {
    minMonths: 9, maxMonths: 12,
    feedingIntervalHours: 3.5,
    feeds: ['07:00', '10:30', '14:00', '17:30', '20:00'],
    sleeps: [
      { start: '09:30', duration: 90, name: 'Nap sáng' },
      { start: '14:00', duration: 120, name: 'Nap trưa' },
      { start: '19:30', duration: 660, name: 'Ngủ đêm' }
    ],
    totalSleep: '12-15h', nightSleep: '10-12h', naps: '2 giấc'
  },
  {
    minMonths: 12, maxMonths: 24,
    feedingIntervalHours: 4,
    feeds: ['07:00', '11:00', '15:00', '19:00'],
    sleeps: [
      { start: '12:30', duration: 120, name: 'Nap trưa' },
      { start: '19:30', duration: 660, name: 'Ngủ đêm' }
    ],
    totalSleep: '12-14h', nightSleep: '11-12h', naps: '1-2 giấc'
  },
  {
    minMonths: 24, maxMonths: 60,
    feedingIntervalHours: 4,
    feeds: ['07:00', '11:30', '15:30', '19:00'],
    sleeps: [
      { start: '13:00', duration: 90, name: 'Nap trưa' },
      { start: '20:00', duration: 600, name: 'Ngủ đêm' }
    ],
    totalSleep: '11-13h', nightSleep: '10-11h', naps: '1 giấc'
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

