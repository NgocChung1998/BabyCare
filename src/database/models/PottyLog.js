import mongoose from 'mongoose';

const pottySchema = new mongoose.Schema(
  {
    chatId: { type: Number, index: true },
    type: { type: String, enum: ['pee', 'poo'], required: true },
    recordedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const PottyLog = mongoose.model('PottyLog', pottySchema);
export default PottyLog;

