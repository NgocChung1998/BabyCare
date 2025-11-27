import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';
import { config } from '../config/index.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

// Sử dụng gemini-2.0-flash-001 (model mới nhất hỗ trợ vision)
const MODEL_NAME = 'gemini-2.0-flash-001';

// Prefix tiếng Việt cho tất cả prompt
const VIETNAMESE_PREFIX = `Luôn trả lời bằng tiếng Việt.
Xưng hô: "em" với người dùng, gọi họ là "bố/mẹ" hoặc "anh/chị".
Sử dụng emoji phù hợp để tạo không khí thân thiện.
Trả lời ngắn gọn, dễ hiểu và hữu ích.

`;

const aiModel = genAI.getGenerativeModel({ 
  model: MODEL_NAME,
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1500,
  }
});

/**
 * Gửi prompt đến Gemini và nhận phản hồi (tiếng Việt)
 * @param {string} prompt - Câu hỏi
 * @returns {Promise<string>}
 */
export const askGemini = async (prompt) => {
  const fullPrompt = VIETNAMESE_PREFIX + prompt;
  const result = await aiModel.generateContent(fullPrompt);
  return result?.response?.text()?.trim() || '🤖 Em tạm thời chưa nghĩ ra câu trả lời.';
};

/**
 * Phân tích ảnh y tế chuyên nghiệp bằng Gemini Vision
 * @param {string} base64Data - Dữ liệu ảnh base64
 * @param {string} customPrompt - Prompt tùy chỉnh (optional)
 * @returns {Promise<string>}
 */
export const analyzeImageWithGemini = async (base64Data, customPrompt = null) => {
  const medicalPrompt = customPrompt || `Bạn là bác sĩ chuyên khoa da liễu, nhi khoa và đa khoa với hơn 20 năm kinh nghiệm. 
Hãy phân tích hình ảnh y tế này một cách chuyên nghiệp và chi tiết.

📋 YÊU CẦU PHÂN TÍCH:

1. 🔍 **Nhận diện vấn đề:**
   - Mô tả những gì nhìn thấy trong ảnh (màu sắc, kích thước, vị trí, hình dạng)
   - Phân biệt các loại tổn thương da: rôm sảy, hăm tã, chàm, mẩn ngứa, nổi mề đay, nhiễm trùng, viêm da, phát ban virus...
   - Đánh giá mức độ: nhẹ / trung bình / nặng

2. 🏥 **Chẩn đoán sơ bộ:**
   - Đưa ra 1-3 khả năng chẩn đoán có thể
   - Giải thích ngắn gọn lý do

3. 💊 **Hướng dẫn chăm sóc tại nhà:**
   - Các bước chăm sóc cụ thể
   - Thuốc/kem bôi không kê đơn có thể dùng (nếu phù hợp)
   - Những điều cần tránh

4. ⚠️ **Cảnh báo:**
   - Dấu hiệu cần đi khám bác sĩ ngay
   - Khi nào cần cấp cứu

5. 📝 **Lưu ý:**
   - Áp dụng cho cả trẻ em và người lớn
   - Nếu không rõ ràng, hãy nói rõ cần thêm thông tin gì

Trả lời bằng tiếng Việt, rõ ràng và dễ hiểu. Sử dụng emoji phù hợp.
⚠️ Nhắc nhở: Đây chỉ là tham khảo, không thay thế khám bác sĩ trực tiếp.`;

  const result = await aiModel.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg'
      }
    },
    { text: medicalPrompt }
  ]);
  return result?.response?.text()?.trim() || 'Chưa phân tích được ảnh, bố/mẹ thử gửi lại ảnh rõ hơn nhé.';
};

/**
 * Gợi ý quà bằng AI theo tháng tuổi (tiếng Việt)
 * @param {number} months - Số tháng tuổi
 * @returns {Promise<string>}
 */
export const suggestGiftWithAI = async (months) => {
  const prompt = `Bạn là chuyên gia tư vấn quà tặng cho trẻ em Việt Nam. 
Hãy gợi ý quà phù hợp cho bé ${months} tháng tuổi:

🎁 **GỢI Ý QUÀ TẶNG:**

1. 🧸 **3 đồ chơi phát triển trí tuệ:**
   - Phù hợp với giai đoạn phát triển ${months} tháng
   - Giải thích ngắn tại sao phù hợp
   - Mức giá tham khảo (VNĐ)

2. 👶 **2 đồ dùng thiết yếu:**
   - Những món thực sự hữu ích cho bé độ tuổi này
   - Thương hiệu uy tín tại Việt Nam

3. 💝 **2 món quà cho bố mẹ:**
   - Giúp việc chăm bé dễ dàng hơn
   - Hoặc giúp bố mẹ thư giãn

4. 💡 **Mẹo chọn quà:**
   - Lưu ý an toàn cho độ tuổi này
   - Nên tránh những gì

Trả lời bằng tiếng Việt với emoji sinh động!`;
  return askGemini(prompt);
};

/**
 * Gợi ý menu ăn dặm bằng AI theo tháng tuổi (tiếng Việt)
 * Format dễ parse để có thể thêm vào database
 * @param {number} months - Số tháng tuổi
 * @returns {Promise<string>}
 */
export const suggestWeanMenuWithAI = async (months) => {
  const prompt = `Bạn là chuyên gia dinh dưỡng trẻ em Việt Nam.
Gợi ý 5 MÓN ĂN DẶM cho bé ${months} tháng tuổi.

QUAN TRỌNG: Trả lời ĐÚNG ĐỊNH DẠNG sau (mỗi món trên 1 dòng, bắt đầu bằng emoji 🍽️):

🍽️ Cháo bí đỏ - Bí đỏ nghiền mịn, dễ tiêu
🍽️ Cháo thịt gà - Thịt gà xay nhuyễn, bổ protein
🍽️ Bột yến mạch chuối - Yến mạch + chuối chín, giàu chất xơ
🍽️ Khoai lang nghiền - Khoai lang hấp, vị ngọt tự nhiên
🍽️ Súp rau củ - Cà rốt, bí xanh, khoai tây xay nhuyễn

Sau đó thêm:

📊 KHẨU PHẦN (${months} tháng):
- Số bữa/ngày: X bữa
- Lượng/bữa: XX-XXml
- Kết hợp: Sữa mẹ/công thức

⚠️ LƯU Ý:
- Thực phẩm cần tránh
- Quy tắc 3 ngày thử món mới

Chỉ gợi ý món PHÙ HỢP ${months} tháng tuổi. Trả lời tiếng Việt!`;
  return askGemini(prompt);
};

/**
 * Download ảnh từ Telegram và chuyển sang base64
 * @param {string} botToken - Bot token
 * @param {string} filePath - File path từ Telegram
 * @returns {Promise<string>}
 */
export const downloadTelegramPhoto = async (botToken, filePath) => {
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Không tải được ảnh từ Telegram');
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
};

export default {
  askGemini,
  analyzeImageWithGemini,
  suggestGiftWithAI,
  suggestWeanMenuWithAI,
  downloadTelegramPhoto
};
