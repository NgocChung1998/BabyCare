import mongoose from 'mongoose';

const vaccineSchema = new mongoose.Schema(
  {
    chatId: { type: Number, index: true },
    vaccineName: String,
    date: Date,
    reminders: {
      pre3d: { type: Boolean, default: false },
      dayOf: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

export const VaccineSchedule = mongoose.model('VaccineSchedule', vaccineSchema);
export default VaccineSchedule;

