export const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '🍼 Ăn' }, { text: '😴 Nhật ký ngủ' }],
      [{ text: '📅 Lịch ăn ngủ' }, { text: '👶 Thông tin bé' }],
      [{ text: '💉 Lịch tiêm chủng' }, { text: '🧷 Thay tã' }],
      [{ text: '💩 Bé đi tè / đi ị' }, { text: '🔥 Ăn dặm' }],
      [{ text: '🎁 Gợi ý quà' }, { text: '🧴 Theo dõi da' }],
      [{ text: '🔗 Đồng bộ' }, { text: '🤖 Chat AI' }],
      [{ text: '📊 Tóm tắt ngày' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

// Danh sách các button chính để clear state
export const MAIN_BUTTONS = [
  '🍼 Ăn',
  '😴 Nhật ký ngủ',
  '📅 Lịch ăn ngủ',
  '💩 Bé đi tè / đi ị',
  '👶 Thông tin bé',
  '💉 Lịch tiêm chủng',
  '🧷 Thay tã',
  '🔥 Ăn dặm',
  '🎁 Gợi ý quà',
  '🧴 Theo dõi da',
  '🔗 Đồng bộ',
  '📊 Tóm tắt ngày',
  '🤖 Chat AI'
];

// Inline keyboard builders cho các tính năng
export const buildInlineKeyboard = (buttons) => ({
  reply_markup: {
    inline_keyboard: buttons
  }
});

// ===== MILK/FOOD BUTTONS =====
export const milkAmountKeyboard = buildInlineKeyboard([
  [
    { text: '120ml', callback_data: 'milk_120' },
    { text: '150ml', callback_data: 'milk_150' },
    { text: '170ml', callback_data: 'milk_170' }
  ],
  [
    { text: '180ml', callback_data: 'milk_180' },
    { text: '200ml', callback_data: 'milk_200' },
    { text: '220ml', callback_data: 'milk_220' }
  ],
  [
    { text: '250ml', callback_data: 'milk_250' },
    { text: '300ml', callback_data: 'milk_300' },
    { text: '✏️ Nhập khác', callback_data: 'milk_custom' }
  ],
  [
    { text: '✏️ Sửa giờ ăn', callback_data: 'milk_edit_time' },
    { text: '⏰ Đặt nhắc 2.5h', callback_data: 'milk_reminder' }
  ]
]);

// ===== POTTY BUTTONS =====
export const pottyInlineKeyboard = buildInlineKeyboard([
  [
    { text: '💧 Bé tè', callback_data: 'potty_pee' },
    { text: '💩 Bé ị', callback_data: 'potty_poo' }
  ]
]);

// ===== GROWTH BUTTONS =====
export const growthInlineKeyboard = buildInlineKeyboard([
  [
    { text: '⚖️ Cập nhật cân nặng', callback_data: 'growth_weight' },
    { text: '📏 Cập nhật chiều cao', callback_data: 'growth_height' }
  ],
  [
    { text: '📊 Xem trạng thái', callback_data: 'growth_status' },
    { text: '📋 Lịch sử', callback_data: 'growth_history' }
  ]
]);

// ===== VACCINE BUTTONS =====
export const vaccineInlineKeyboard = buildInlineKeyboard([
  [
    { text: '🔄 Tạo lịch tự động', callback_data: 'vaccine_auto' }
  ],
  [
    { text: '➕ Thêm thủ công', callback_data: 'vaccine_add' },
    { text: '📋 Xem lịch tiêm', callback_data: 'vaccine_list' }
  ],
  [
    { text: '✅ Đánh dấu đã tiêm', callback_data: 'vaccine_complete' }
  ]
]);

// ===== DAILY ROUTINE BUTTONS =====
export const routineInlineKeyboard = buildInlineKeyboard([
  [
    { text: '🍼 Xem lịch ăn', callback_data: 'routine_feeds' },
    { text: '😴 Xem lịch ngủ', callback_data: 'routine_sleeps' }
  ],
  [
    { text: '🔄 Tạo lịch mới', callback_data: 'routine_generate' }
  ]
]);

// ===== SCHEDULE BUTTONS =====
export const scheduleInlineKeyboard = buildInlineKeyboard([
  [
    { text: '📋 Xem lịch hôm nay', callback_data: 'schedule_view' }
  ],
  [
    { text: '➕ Thêm lịch', callback_data: 'schedule_add' },
    { text: '🔄 Khôi phục mẫu', callback_data: 'schedule_reset' }
  ]
]);

// ===== WEAN BUTTONS =====
export const weanInlineKeyboard = buildInlineKeyboard([
  [
    { text: '➕ Thêm món', callback_data: 'wean_add' },
    { text: '📋 Xem danh sách', callback_data: 'wean_list' }
  ],
  [
    { text: '🤖 Gợi ý AI', callback_data: 'wean_suggest' },
    { text: '⚠️ Báo dị ứng', callback_data: 'wean_allergy' }
  ]
]);

// ===== GIFT BUTTONS =====
export const giftAgeKeyboard = buildInlineKeyboard([
  [
    { text: '0-3 tháng', callback_data: 'gift_2' },
    { text: '3-6 tháng', callback_data: 'gift_5' },
    { text: '6-9 tháng', callback_data: 'gift_8' }
  ],
  [
    { text: '9-12 tháng', callback_data: 'gift_11' },
    { text: '12-18 tháng', callback_data: 'gift_15' },
    { text: '18-24 tháng', callback_data: 'gift_21' }
  ],
  [
    { text: '2-3 tuổi', callback_data: 'gift_30' },
    { text: '3-4 tuổi', callback_data: 'gift_42' },
    { text: '4-5 tuổi', callback_data: 'gift_54' }
  ]
]);

// ===== DIAPER BUTTONS =====
export const diaperInlineKeyboard = buildInlineKeyboard([
  [
    { text: '🧷 Ghi nhận thay tã', callback_data: 'diaper_log' },
    { text: '☀️ Vitamin D', callback_data: 'supplement_vd' }
  ]
]);

// ===== AI CHAT BUTTONS =====
export const aiQuickKeyboard = buildInlineKeyboard([
  [
    { text: '😴 Hỏi về giấc ngủ', callback_data: 'ai_sleep' },
    { text: '🍼 Hỏi về sữa', callback_data: 'ai_milk' }
  ],
  [
    { text: '🤒 Hỏi về sức khỏe', callback_data: 'ai_health' },
    { text: '🌡️ Hỏi về nhiệt độ', callback_data: 'ai_fever' }
  ],
  [
    { text: '✏️ Nhập câu hỏi tự do', callback_data: 'ai_custom' }
  ]
]);

// Null values = handled directly in specific handlers
export const buttonGuides = {
  '😴 Nhật ký ngủ': null,
  '🍼 Ăn': null,
  '📅 Lịch ăn ngủ': null,
  '📊 Tóm tắt ngày': null,
  '💩 Bé đi tè / đi ị': null,
  '👶 Thông tin bé': null,
  '💉 Lịch tiêm chủng': null,
  '🧷 Thay tã': null,
  '🔥 Ăn dặm': null,
  '🎁 Gợi ý quà': null,
  '🧴 Theo dõi da': '🏥 Phân tích hình ảnh y tế:\n\n📸 Gửi ảnh vùng da/bệnh cần kiểm tra\n🤖 AI bác sĩ chuyên khoa sẽ phân tích\n👨‍👩‍👧 Áp dụng cho cả trẻ em và người lớn\n\n⚠️ Chỉ tham khảo, không thay thế khám bác sĩ!',
  '🔗 Đồng bộ': null,
  '🤖 Chat AI': null
};

export default { 
  mainKeyboard, 
  MAIN_BUTTONS,
  buttonGuides,
  milkAmountKeyboard,
  pottyInlineKeyboard,
  growthInlineKeyboard,
  vaccineInlineKeyboard,
  scheduleInlineKeyboard,
  weanInlineKeyboard,
  giftAgeKeyboard,
  diaperInlineKeyboard,
  aiQuickKeyboard,
  routineInlineKeyboard,
  buildInlineKeyboard
};
