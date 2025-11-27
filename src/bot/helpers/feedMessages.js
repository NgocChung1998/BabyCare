import dayjs from 'dayjs';

/**
 * Tạo nội dung tin nhắn xác nhận cữ ăn + nhắc cữ tiếp theo
 * @param {Object} params
 * @param {number} params.amountMl
 * @param {Date|string|number} params.recordedAt
 * @param {string} [params.prefix='✅ ĐÃ GHI NHẬN']
 * @param {[number, number]} [params.intervalHours=[3, 3.5]]
 */
export const buildFeedConfirmationMessage = ({
  amountMl,
  recordedAt,
  prefix = '✅ ĐÃ GHI NHẬN',
  intervalHours = [3, 3.5]
}) => {
  const feedTime = dayjs(recordedAt);
  const nextStart = feedTime.add(intervalHours[0], 'hour');
  const nextEnd = feedTime.add(intervalHours[1], 'hour');

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━',
    prefix,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    amountMl
      ? `🍼 ${amountMl}ml lúc ${feedTime.format('HH:mm')}`
      : `🍼 Đã cập nhật giờ ăn: ${feedTime.format('HH:mm')}`,
    '',
    `⏰ Cữ tiếp theo: ~${nextStart.format('HH:mm')} - ${nextEnd.format('HH:mm')}`,
    '',
    '📢 Lịch nhắc:',
    '   • Trước 30p, 10p',
    '   • Đúng giờ',
    '   • Quá 15p, 30p',
    '',
    '━━━━━━━━━━━━━━━━━━━━'
  ];

  return lines.join('\n');
};

export default {
  buildFeedConfirmationMessage
};

