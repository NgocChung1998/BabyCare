import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Format số với số thập phân
 */
export const formatNumber = (num, decimals = 1) => {
  return Number(num).toFixed(decimals);
};

/**
 * Format thời gian từ phút sang giờ:phút
 */
export const formatMinutes = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}h${mins}p` : `${hours}h`;
  }
  return `${mins}p`;
};

/**
 * Format tuổi với năm, tháng, ngày
 */
export const formatAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  
  const now = dayjs.tz(dayjs(), VIETNAM_TZ);
  const birth = dayjs.tz(dateOfBirth, VIETNAM_TZ);
  
  let years = now.diff(birth, 'year');
  let months = now.diff(birth.add(years, 'year'), 'month');
  let days = now.diff(birth.add(years, 'year').add(months, 'month'), 'day');
  
  const parts = [];
  
  if (years > 0) {
    parts.push(`${years} tuổi`);
  }
  
  if (months > 0) {
    parts.push(`${months} tháng`);
  }
  
  if (days > 0 && years === 0) {
    // Chỉ hiển thị ngày nếu bé chưa đầy 1 tuổi
    parts.push(`${days} ngày`);
  }
  
  if (parts.length === 0) {
    return '0 ngày';
  }
  
  return parts.join(' ');
};

/**
 * Format trạng thái ngủ/thức với emoji và format đẹp
 */
export const formatSleepStatus = (isSleeping, startTime, elapsedMinutes, lastSleep, lastFeed) => {
  if (isSleeping) {
    const startStr = dayjs.tz(startTime, VIETNAM_TZ).format('HH:mm');
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    const elapsedMins = elapsedMinutes % 60;
    const elapsedStr = elapsedHours > 0 
      ? `${elapsedHours}h${elapsedMins > 0 ? `${elapsedMins}p` : ''}`.trim()
      : `${elapsedMins}p`;
    
    return {
      icon: '😴',
      status: 'ĐANG NGỦ',
      details: [
        `⏰ Bắt đầu: ${startStr}`,
        `⏱️ Đã ngủ: ${elapsedStr}`
      ]
    };
  } else {
    const details = [];
    
    if (lastSleep) {
      const lastEndStr = dayjs.tz(lastSleep.end, VIETNAM_TZ).format('HH:mm');
      const lastHours = Math.floor(lastSleep.durationMinutes / 60);
      const lastMins = lastSleep.durationMinutes % 60;
      const lastDurationStr = lastHours > 0 
        ? `${lastHours}h${lastMins > 0 ? `${lastMins}p` : ''}`.trim()
        : `${lastMins}p`;
      details.push(`📋 Giấc ngủ gần nhất: ${lastDurationStr} (kết thúc ${lastEndStr})`);
    } else {
      details.push('📋 Chưa có giấc ngủ được ghi nhận');
    }
    
    if (lastFeed) {
      const lastFeedTime = dayjs.tz(lastFeed.recordedAt, VIETNAM_TZ).format('HH:mm');
      details.push(`🍼 Vừa ăn lúc: ${lastFeedTime} (${lastFeed.amountMl}ml)`);
    }
    
    return {
      icon: '😊',
      status: 'ĐANG THỨC',
      details
    };
  }
};

/**
 * Format danh sách schedule items
 */
export const formatScheduleItems = (items = []) => {
  const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
  return sorted.map((item) => `${item.time} • ${item.title}`).join('\n');
};
