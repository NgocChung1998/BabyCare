import mongoose from 'mongoose';

const sleepSchema = new mongoose.Schema(
  {
    chatId: { type: Number, index: true },
    start: Date,
    end: Date,
    durationMinutes: Number
  },
  { timestamps: true }
);

export const SleepSession = mongoose.model('SleepSession', sleepSchema);
export default SleepSession;

