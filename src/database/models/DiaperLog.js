import mongoose from 'mongoose';

const diaperSchema = new mongoose.Schema(
  {
    chatId: { type: Number, index: true },
    recordedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const DiaperLog = mongoose.model('DiaperLog', diaperSchema);
export default DiaperLog;

