import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { CONSTANTS, SLEEP_RECOMMENDATIONS, WEAN_SUGGESTIONS, GIFT_IDEAS } from '../config/index.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Kiểm tra có phải giờ yên tĩnh không (23:00-06:00) theo giờ Việt Nam
 * @returns {boolean}
 */
export const isQuietHours = () => {
  const hour = dayjs.tz(dayjs(), VIETNAM_TZ).hour();
  return hour >= 23 || hour < 6;
};

/**
 * Tính số ms đến 6h sáng theo giờ Việt Nam
 * @returns {number}
 */
export const msUntilMorning = () => {
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  const nextMorning =
    now.hour() < 6 ? now.hour(6).minute(0).second(0) : now.add(1, 'day').hour(6).minute(0).second(0);
  return nextMorning.diff(now);
};

/**
 * Kiểm tra session ngủ có phải giấc đêm không
 * @param {Object} session - Sleep session
 * @returns {boolean}
 */
export const isNightSleep = (session) => {
  if (!session?.start) return false;
  const hour = dayjs.tz(session.start, VIETNAM_TZ).hour();
  return hour >= 19 || hour < 6;
};

/**
 * Lấy hướng dẫn ngủ theo tháng tuổi
 * @param {number|null} months - Số tháng tuổi
 * @returns {string}
 */
export const getSleepGuideline = (months) => {
  if (months == null) {
    return 'Thiếu ngày sinh nên em chưa tư vấn được lịch ngủ tối ưu. Dùng /birthday set YYYY-MM-DD nhé.';
  }
  const range =
    SLEEP_RECOMMENDATIONS.find((item) => months >= item.min && months < item.max) ??
    SLEEP_RECOMMENDATIONS.at(-1);
  return `Theo độ tuổi ~${months} tháng, bé nên ngủ ${range.totalHours}/ngày với ${range.naps}.`;
};

/**
 * Gợi ý menu ăn dặm theo tháng tuổi
 * @param {number|null} months - Số tháng tuổi
 * @returns {string}
 */
export const suggestWeanMenu = (months) => {
  if (!months) {
    return '🎁 Vui lòng nhập số tháng tuổi, ví dụ: /wean suggest 8';
  }
  const range = WEAN_SUGGESTIONS.find((item) => months >= item.min && months < item.max) ?? WEAN_SUGGESTIONS.at(-1);
  return `🔥 Gợi ý ăn dặm cho bé ~${months} tháng:\n${range.ideas
    .map((idea) => `• ${idea}`)
    .join('\n')}\nNhớ theo dõi dấu hiệu dị ứng sau mỗi món mới nhé!`;
};

/**
 * Build message gợi ý quà theo tháng tuổi
 * @param {number} months - Số tháng tuổi
 * @returns {string}
 */
export const buildGiftMessage = (months) => {
  const idea = GIFT_IDEAS.find((item) => months >= item.min && months < item.max) ?? GIFT_IDEAS.at(-1);
  return [
    `🎁 Gợi ý quà cho bé ${months} tháng tuổi:`,
    `• Đồ chơi: ${idea.toys.join(', ')}`,
    `• Đồ dùng cho bé: ${idea.baby.join(', ')}`,
    `• Quà cho bố/mẹ: ${idea.parents.join(', ')}`,
    'Chúc cả nhà vui vẻ!'
  ].join('\n');
};

/**
 * Tính delay ngẫu nhiên cho nhắc tã (3-4 tiếng)
 * @returns {number}
 */
export const randomDiaperDelayMs = () => {
  const minutes =
    Math.floor(Math.random() * (CONSTANTS.DIAPER_MAX_MINUTES - CONSTANTS.DIAPER_MIN_MINUTES + 1)) +
    CONSTANTS.DIAPER_MIN_MINUTES;
  return minutes * 60 * 1000;
};
