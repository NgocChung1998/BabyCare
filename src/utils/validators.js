import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

/**
 * Parse số dương từ input
 * @param {string} input - Chuỗi input
 * @returns {number|null}
 */
export const parseFloatStrict = (input) => {
  const parsed = Number(input);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

/**
 * Parse ngày theo nhiều định dạng (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY)
 * @param {string} dateText - Chuỗi ngày
 * @returns {dayjs.Dayjs|null}
 */
export const parseDate = (dateText) => {
  if (!dateText) return null;
  
  // Thử YYYY-MM-DD trước
  let date = dayjs(dateText, 'YYYY-MM-DD', true);
  if (date.isValid()) return date;
  
  // Thử DD/MM/YYYY
  date = dayjs(dateText, 'DD/MM/YYYY', true);
  if (date.isValid()) return date;
  
  // Thử DD-MM-YYYY
  date = dayjs(dateText, 'DD-MM-YYYY', true);
  if (date.isValid()) return date;
  
  return null;
};

/**
 * Validate định dạng giờ HH:mm
 * @param {string} time - Chuỗi giờ
 * @returns {boolean}
 */
export const isValidTime = (time) => {
  return /^\d{2}:\d{2}$/.test(time);
};

/**
 * Normalize schedule type từ title
 * @param {string} text - Tiêu đề schedule
 * @returns {string}
 */
export const normalizeScheduleType = (text) => {
  const normalized = text?.toLowerCase();
  if (!normalized) return 'other';
  if (normalized.includes('bú') || normalized.includes('sữa')) return 'milk';
  if (normalized.includes('ngủ') || normalized.includes('nap')) return 'sleep';
  if (normalized.includes('chơi')) return 'play';
  if (normalized.includes('tắm')) return 'bath';
  if (normalized.includes('vitamin') || normalized.includes('men')) return 'supplement';
  if (normalized.includes('tã')) return 'diaper';
  return 'other';
};

