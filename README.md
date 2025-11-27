# Bot Telegram Chăm Bé 👶

Trợ lý Telegram chăm bé bằng Node.js (ESM), MongoDB, Gemini AI và hệ thống reminder.

## Tính năng nổi bật

### 🆕 Lịch tiêm chủng tự động
- Tự động tạo lịch tiêm theo ngày sinh bé
- Dựa trên lịch tiêm chủng mở rộng quốc gia Việt Nam
- Nhắc trước 7 ngày, 3 ngày và đúng ngày tiêm
- Đánh dấu đã tiêm và theo dõi tiến độ

### 🆕 Lịch ăn ngủ thông minh
- Tự động tạo lịch ăn/ngủ theo độ tuổi bé
- Nhắc nhở nếu quên ghi nhận ăn/ngủ
- Sửa giờ ăn/ngủ nếu quên bấm nút
- Hiển thị lịch dự kiến và thực tế trong ngày

### 🆕 Sửa giờ bắt đầu
- Sửa giờ bắt đầu ăn: Bấm "Sửa giờ ăn" trong menu
- Sửa giờ bắt đầu ngủ: Bấm "Sửa giờ ngủ" trong menu

## Cấu trúc thư mục

```
src/
├── index.js              # Entry point
├── config/               # Cấu hình, constants, lịch tiêm/ăn/ngủ
├── database/             # Kết nối DB, models
├── bot/                  # Bot instance, keyboard, handlers
├── services/             # AI, message, reminder, routine services
├── jobs/                 # Cron jobs
└── utils/                # Formatters, validators, helpers
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

## Chạy bot

```bash
npm run start
```

## Menu Reply Keyboard

Bot có 12 nút menu:
- 🍼 Ăn (ghi nhận bữa ăn + sửa giờ)
- 😴 Nhật ký ngủ (bắt đầu/kết thúc ngủ + sửa giờ)
- 📅 Lịch ăn ngủ (xem lịch theo độ tuổi)
- 👶 Thông tin bé (tuổi, cân nặng, chiều cao, vaccine)
- 💉 Lịch tiêm chủng (tự động theo ngày sinh)
- 🧷 Thay tã
- 💩 Bé đi tè / đi ị
- 🔥 Ăn dặm
- 🎁 Gợi ý quà
- 🧴 Theo dõi da
- 📊 Tóm tắt ngày
- 🤖 Chat AI

## Các lệnh chính

### Lịch tiêm chủng (MỚI)
- **Bấm nút "💉 Lịch tiêm chủng"**: Xem và quản lý
- **Tạo lịch tự động**: Tự động tạo từ ngày sinh bé
- **Đánh dấu đã tiêm**: Đánh dấu các mũi đã tiêm
- `/vaccine auto`: Tạo lịch tự động
- `/vaccine add 2025-03-10 5in1`: Thêm thủ công
- `/vaccine list`: Xem danh sách đầy đủ

### Lịch ăn ngủ (MỚI)
- **Bấm nút "📅 Lịch ăn ngủ"**: Xem lịch theo độ tuổi
- Xem lịch ăn dự kiến và thực tế
- Xem lịch ngủ dự kiến và thực tế
- Sửa giờ nếu quên ghi nhận
- Tự động tính lịch theo độ tuổi bé

### Ghi nhận ăn
- **Bấm nút "🍼 Ăn"**: Chọn lượng ml hoặc sửa giờ
- `/milk 150`: Ghi nhận bé uống 150ml
- Tự động đặt nhắc sau 2.5 giờ
- **Sửa giờ ăn**: Nhập HH:mm SỐml (ví dụ: 09:30 150)

### Nhật ký ngủ
- **Bấm nút "😴 Nhật ký ngủ"**: Bắt đầu/kết thúc ngủ
- `/sleep start`: Bắt đầu ngủ
- `/sleep stop`: Kết thúc ngủ
- `/sleep stats`: Xem thống kê tuần
- **Sửa giờ ngủ**: Nhập HH:mm (ví dụ: 09:30)

### Thông tin bé
- **Bấm nút "👶 Thông tin bé"**: Xem tổng quan
- Hiển thị tuổi, cân nặng, chiều cao
- Hiển thị lịch tiêm sắp đến
- `/weight 6.2`: Cập nhật cân nặng
- `/height 62`: Cập nhật chiều cao
- `/birthday set 2024-05-10`: Lưu ngày sinh

### Theo dõi tè/ị
- `/pee`: Ghi nhận bé tè
- `/poo`: Ghi nhận bé ị

### Thay tã & Vitamin D
- `/diaper`: Ghi nhận thay tã (nhắc sau 3-4h)
- `/vd`: Ghi nhận uống Vitamin D

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

### Tóm tắt & AI
- `/summary`: Tóm tắt ngày
- `/ai <câu hỏi>`: Hỏi Gemini

### Night mode
- `/night on`: Bật chế độ đêm (23:00-06:00)
- `/night off`: Tắt chế độ đêm

## Cron Jobs

- **6:00**: Tạo lịch ăn ngủ + Gửi lịch chăm bé
- **7:00**: Nhắc uống Vitamin D
- **7:30-21:30**: Kiểm tra bữa ăn/giấc ngủ bị lỡ (mỗi giờ)
- **9:00**: Nhắc lịch tiêm vaccine
- **20:00 Chủ nhật**: Báo cáo giấc ngủ tuần

## Lịch tiêm chủng tự động

Khi cập nhật ngày sinh bé, bot sẽ tự động tạo lịch tiêm theo tiêu chuẩn Việt Nam:

| Tuổi | Vaccine |
|------|---------|
| Sơ sinh | Viêm gan B, BCG |
| 2 tháng | 5in1/6in1, Rotavirus, Phế cầu |
| 3-4 tháng | Tiếp tục các mũi 2, 3 |
| 6 tháng | Viêm gan B (mũi 3), Cúm |
| 9 tháng | Sởi, Viêm não Nhật Bản |
| 12 tháng | MMR, Thủy đậu, Viêm gan A |
| 15-18 tháng | Các mũi nhắc lại |
| 2 tuổi+ | Viêm não NB nhắc lại |

## Deploy lên Railway

### Bước 1: Chuẩn bị
1. Đảm bảo code đã commit lên Git (GitHub/GitLab)
2. Có tài khoản Railway: https://railway.app

### Bước 2: Tạo project trên Railway
1. Đăng nhập Railway
2. Click "New Project" → "Deploy from GitHub repo"
3. Chọn repository của bạn

### Bước 3: Cấu hình Environment Variables
- `BOT_TOKEN`: Token từ @BotFather
- `MONGO_URI`: MongoDB connection string
- `GEMINI_API_KEY`: API key từ Google AI Studio
- `ADMIN_CHAT_ID`: (Optional) Chat ID nhận báo cáo
- `NODE_ENV`: `production`

### Bước 4: Deploy
Railway sẽ tự động detect và build từ `package.json` và `Procfile`.

## License

ISC
