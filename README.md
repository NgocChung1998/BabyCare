# Bot Telegram Chăm Bé 👶

Trợ lý Telegram chăm bé bằng Node.js (ESM), MongoDB, Gemini AI và hệ thống reminder.

## Cấu trúc thư mục

```
src/
├── index.js              # Entry point
├── config/               # Cấu hình, constants
│   └── index.js
├── database/             # Kết nối DB, models
│   ├── connection.js
│   └── models/
│       ├── index.js
│       ├── ChatProfile.js
│       ├── Feeding.js
│       ├── SleepSession.js
│       ├── PottyLog.js
│       ├── DiaperLog.js
│       ├── GrowthLog.js
│       ├── VaccineSchedule.js
│       ├── SupplementLog.js
│       ├── DailySchedule.js
│       ├── FoodLog.js
│       └── PhotoAnalysisLog.js
├── bot/                  # Bot instance, keyboard, handlers
│   ├── index.js
│   ├── keyboard.js
│   └── handlers/
│       ├── index.js
│       ├── start.js
│       ├── milk.js
│       ├── sleep.js
│       ├── potty.js
│       ├── growth.js
│       ├── vaccine.js
│       ├── diaper.js
│       ├── nightMode.js
│       ├── summary.js
│       ├── schedule.js
│       ├── wean.js
│       ├── gift.js
│       ├── ai.js
│       ├── photo.js
│       └── birthday.js
├── services/             # AI, message, reminder services
│   ├── index.js
│   ├── aiService.js
│   ├── messageService.js
│   └── reminderService.js
├── jobs/                 # Cron jobs
│   └── index.js
└── utils/                # Formatters, validators, helpers
    ├── index.js
    ├── formatters.js
    ├── validators.js
    └── helpers.js
```

## Cài đặt

```bash
npm install
```

## Cấu hình môi trường

Tạo file `.env` tại thư mục gốc:

```env
BOT_TOKEN=telegram_bot_token
MONGO_URI=mongodb+srv://...
GEMINI_API_KEY=your_gemini_key
ADMIN_CHAT_ID=your_chat_id
NODE_ENV=development
```

- `BOT_TOKEN`: Lấy từ @BotFather
- `MONGO_URI`: Chuỗi kết nối MongoDB (Atlas/local)
- `GEMINI_API_KEY`: Key từ https://ai.google.dev
- `ADMIN_CHAT_ID`: Chat ID nhận báo cáo phân tích ảnh (tuỳ chọn)

## Chạy bot

```bash
npm run start
```

## Menu Reply Keyboard

Bot có 12 nút menu:
- 🍼 Nhắc pha sữa
- 😴 Nhật ký ngủ
- 💩 Bé đi tè / đi ị
- 👶 Cân nặng & Chiều cao
- 💉 Lịch tiêm chủng
- 🧷 Thay tã
- 🗓 Lịch chăm bé
- 🔥 Ăn dặm
- 🎁 Gợi ý quà
- 🧴 Theo dõi da
- 📊 Tóm tắt ngày
- 🤖 Chat AI

## Các lệnh chính

### Nhắc sữa
- **Bấm nút "🍼 Nhắc pha sữa"**: Tự động đặt lịch nhắc 2.5 tiếng
- Gõ `a` hoặc `A`: Đặt nhắc nhanh
- `/milk 150`: Ghi nhận bé uống 150ml

### Nhật ký ngủ
- **Bấm nút "😴 Nhật ký ngủ"**: Toggle bắt đầu/kết thúc ngủ
- `/sleep start`: Bắt đầu ngủ
- `/sleep stop`: Kết thúc ngủ
- `/sleep status`: Xem trạng thái hiện tại
- `/sleep stats`: Xem thống kê giấc ngủ tuần

### Theo dõi tè/ị
- `/pee`: Ghi nhận bé tè
- `/poo`: Ghi nhận bé ị

### Cân nặng & Chiều cao
- `/weight 6.2`: Ghi nhận 6.2kg
- `/height 62`: Ghi nhận 62cm
- `/growth`: Xem trạng thái tăng trưởng (nhắc bổ sung nếu thiếu)
- `/growth history`: Xem lịch sử tăng trưởng

### Lịch tiêm chủng
- `/vaccine add 2025-03-10 5in1`: Thêm lịch tiêm
- `/vaccine list`: Xem danh sách

### Thay tã & Vitamin D
- `/diaper`: Ghi nhận thay tã (nhắc sau 3-4h)
- `/vd`: Ghi nhận uống Vitamin D

### Lịch chăm bé
- `/schedule view`: Xem lịch hôm nay
- `/schedule add 09:30 Nội dung`: Thêm/sửa lịch
- `/schedule reset`: Khôi phục lịch mẫu

### Ăn dặm
- `/wean add Cháo bí | ghi chú`: Thêm món
- `/wean list`: Xem danh sách món
- `/wean suggest 8`: Gợi ý món cho bé 8 tháng
- `/wean allergy Món | triệu chứng`: Ghi nhận dị ứng

### Gợi ý quà
- `/gift 12`: Gợi ý quà cho bé 12 tháng (dùng AI)

### Phân tích hình ảnh y tế
- Gửi ảnh vùng da/bệnh cần kiểm tra
- AI bác sĩ chuyên khoa phân tích chi tiết
- Áp dụng cho cả trẻ em và người lớn
- Nhận diện: rôm sảy, hăm tã, chàm, mẩn ngứa, viêm da, nhiễm trùng...

### Tóm tắt & AI
- `/summary`: Tóm tắt ngày
- `/ai <câu hỏi>`: Hỏi Gemini
- `/status`: Xem thông tin hồ sơ bé và nhắc bổ sung nếu thiếu

### Night mode
- `/night on`: Bật chế độ đêm (23:00-06:00)
- `/night off`: Tắt chế độ đêm

### Ngày sinh
- `/birthday set 2024-05-10`: Lưu ngày sinh bé

## Cron Jobs

- **6:00**: Gửi lịch chăm bé hàng ngày
- **7:00**: Nhắc uống Vitamin D
- **9:00**: Nhắc lịch tiêm vaccine
- **20:00 Chủ nhật**: Báo cáo giấc ngủ tuần

## Deploy lên Railway

### Bước 1: Chuẩn bị
1. Đảm bảo code đã commit lên Git (GitHub/GitLab)
2. Có tài khoản Railway: https://railway.app

### Bước 2: Tạo project trên Railway
1. Đăng nhập Railway
2. Click "New Project" → "Deploy from GitHub repo"
3. Chọn repository của bạn
4. Railway sẽ tự động detect và build

### Bước 3: Cấu hình Environment Variables
Trong Railway dashboard, thêm các biến môi trường:
- `BOT_TOKEN`: Token từ @BotFather
- `MONGO_URI`: MongoDB connection string
- `GEMINI_API_KEY`: API key từ Google AI Studio
- `ADMIN_CHAT_ID`: (Optional) Chat ID nhận báo cáo
- `NODE_ENV`: `production`

### Bước 4: Deploy
Railway sẽ tự động:
- Detect Node.js project
- Chạy `npm install`
- Chạy `node ./src/index.js` (từ Procfile)

### Lưu ý:
- Railway tự động detect từ `package.json` và `Procfile`
- Bot sẽ tự động restart khi có lỗi
- Logs có thể xem trong Railway dashboard

## License

ISC
