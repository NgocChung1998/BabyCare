import mongoose from 'mongoose';

/**
 * Model lưu lịch ăn/ngủ hàng ngày của bé
 * Tự động tính toán dựa trên độ tuổi
 */
const dailyRoutineSchema = new mongoose.Schema(
  {
    chatId: { type: Number, required: true, index: true },
    date: { type: Date, required: true },
    
    // Lịch ăn
    feedingSchedule: [{
      time: String, // HH:mm
      completed: { type: Boolean, default: false },
      actualTime: Date, // Thời gian thực tế (nếu khác)
      amountMl: Number,
      missed: { type: Boolean, default: false },
      reminded: { type: Boolean, default: false }
    }],
    
    // Lịch ngủ
    sleepSchedule: [{
      name: String,
      startTime: String, // HH:mm dự kiến
      duration: Number, // phút
      completed: { type: Boolean, default: false },
      actualStart: Date, // Thời gian thực tế
      actualEnd: Date,
      actualDuration: Number,
      missed: { type: Boolean, default: false },
      reminded: { type: Boolean, default: false }
    }],
    
    // Thông tin tham khảo
    ageMonths: Number,
    feedingIntervalHours: Number,
    totalSleepRecommended: String
  },
  { timestamps: true }
);

// Index để tìm nhanh theo chatId và date
dailyRoutineSchema.index({ chatId: 1, date: 1 }, { unique: true });

export const DailyRoutine = mongoose.model('DailyRoutine', dailyRoutineSchema);
export default DailyRoutine;

