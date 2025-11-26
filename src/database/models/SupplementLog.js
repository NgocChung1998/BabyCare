import mongoose from 'mongoose';

const supplementSchema = new mongoose.Schema(
  {
    chatId: { type: Number, index: true },
    type: { type: String, enum: ['vitaminD', 'probiotic'], required: true },
    recordedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const SupplementLog = mongoose.model('SupplementLog', supplementSchema);
export default SupplementLog;

