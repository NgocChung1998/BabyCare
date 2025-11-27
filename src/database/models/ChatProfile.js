import mongoose from 'mongoose';

const chatProfileSchema = new mongoose.Schema(
  {
    chatId: { type: Number, unique: true },
    firstName: String,
    username: String,
    nightModeEnabled: { type: Boolean, default: false },
    lastInteraction: { type: Date, default: Date.now },
    dateOfBirth: Date,
    currentSleepStart: Date
  },
  { timestamps: true }
);

export const ChatProfile = mongoose.model('ChatProfile', chatProfileSchema);
export default ChatProfile;

