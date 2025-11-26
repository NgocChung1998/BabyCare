import mongoose from 'mongoose';
import { config } from '../config/index.js';

mongoose.set('strictQuery', true);

export const connectDb = async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.info('✅ Đã kết nối MongoDB');
};

export const disconnectDb = async () => {
  await mongoose.disconnect();
  console.info('🔌 Đã ngắt kết nối MongoDB');
};

export default mongoose;

