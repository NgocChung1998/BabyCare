import mongoose from 'mongoose';

const photoAnalysisSchema = new mongoose.Schema(
  {
    chatId: { type: Number, index: true },
    fileId: String,
    analysis: String,
    forwardedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const PhotoAnalysisLog = mongoose.model('PhotoAnalysisLog', photoAnalysisSchema);
export default PhotoAnalysisLog;

