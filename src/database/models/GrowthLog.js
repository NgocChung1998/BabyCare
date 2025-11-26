import mongoose from 'mongoose';

const growthSchema = new mongoose.Schema(
  {
    chatId: { type: Number, index: true },
    weightKg: Number,
    heightCm: Number,
    recordedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const GrowthLog = mongoose.model('GrowthLog', growthSchema);
export default GrowthLog;

