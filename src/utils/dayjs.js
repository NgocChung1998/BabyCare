/**
 * Dayjs với timezone Việt Nam (UTC+7)
 * Tất cả các file nên import dayjs từ đây thay vì import trực tiếp
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Extend dayjs với timezone plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Timezone Việt Nam
const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

// Wrapper để tự động convert sang timezone Việt Nam
const dayjsVN = (...args) => {
  if (args.length === 0) {
    // dayjs() - lấy thời gian hiện tại
    return dayjs.tz(dayjs(), VIETNAM_TZ);
  } else if (args.length === 1) {
    // dayjs(date) - parse date
    const date = args[0];
    if (!date) return dayjs.tz(dayjs(), VIETNAM_TZ);
    // Nếu là Date object hoặc string, convert sang timezone VN
    return dayjs.tz(date, VIETNAM_TZ);
  } else {
    // dayjs(year, month, ...) - tạo date từ components
    return dayjs.tz(dayjs(...args), VIETNAM_TZ);
  }
};

// Copy tất cả methods từ dayjs
Object.setPrototypeOf(dayjsVN, dayjs);
Object.assign(dayjsVN, dayjs);

// Export dayjs đã được cấu hình
export default dayjsVN;

// Export helper functions
export const now = () => dayjs.tz(dayjs(), VIETNAM_TZ);
export const today = () => dayjs.tz(dayjs(), VIETNAM_TZ).startOf('day');
export const formatTime = (date, format = 'HH:mm') => {
  if (!date) return '';
  return dayjs.tz(date, VIETNAM_TZ).format(format);
};
export const formatDate = (date, format = 'DD/MM/YYYY') => {
  if (!date) return '';
  return dayjs.tz(date, VIETNAM_TZ).format(format);
};
export const formatDateTime = (date, format = 'DD/MM/YYYY HH:mm') => {
  if (!date) return '';
  return dayjs.tz(date, VIETNAM_TZ).format(format);
};

