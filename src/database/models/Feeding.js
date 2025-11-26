import mongoose from 'mongoose';

const feedingSchema = new mongoose.Schema(
  {
    chatId: { type: Number, index: true },
    amountMl: { type: Number, required: true },
    recordedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const Feeding = mongoose.model('Feeding', feedingSchema);
export default Feeding;

