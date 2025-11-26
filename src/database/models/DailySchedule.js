import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    chatId: { type: Number, unique: true },
    items: [
      {
        time: String,
        title: String,
        type: {
          type: String,
          enum: ['milk', 'sleep', 'play', 'bath', 'supplement', 'diaper', 'other'],
          default: 'other'
        }
      }
    ]
  },
  { timestamps: true }
);

export const DailySchedule = mongoose.model('DailySchedule', scheduleSchema);
export default DailySchedule;

