import mongoose from 'mongoose';

const foodLogSchema = new mongoose.Schema(
  {
    chatId: { type: Number, index: true },
    dishName: String,
    note: String,
    allergicReaction: { type: Boolean, default: false },
    reactionNote: String,
    recordedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const FoodLog = mongoose.model('FoodLog', foodLogSchema);
export default FoodLog;

