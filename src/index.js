/**
 * Bot Telegram Chăm Bé - Entry Point
 * 
 * Cấu trúc thư mục:
 * src/
 * ├── config/          - Cấu hình, constants
 * ├── database/        - Kết nối DB, models
 * ├── bot/             - Bot instance, keyboard, handlers
 * ├── services/        - AI, message, reminder services
 * ├── jobs/            - Cron jobs
 * └── utils/           - Formatters, validators, helpers
 */

// Set timezone Việt Nam cho toàn bộ ứng dụng
process.env.TZ = 'Asia/Ho_Chi_Minh';

import { config } from './config/index.js';
import { connectDb, disconnectDb } from './database/connection.js';
import { bot } from './bot/index.js';
import { registerAllHandlers } from './bot/handlers/index.js';
import { startAllJobs, stopAllJobs } from './jobs/index.js';
import { clearAllReminders } from './services/reminderService.js';

/**
 * Khởi động bot
 */
const bootstrap = async () => {
  try {
    // Kết nối database
    await connectDb();

    // Đăng ký handlers
    registerAllHandlers();

    // Khởi động cron jobs
    startAllJobs();

    console.info('🤖 Bot đã sẵn sàng phục vụ bố/mẹ!');
    console.info(`📍 Environment: ${config.nodeEnv}`);
    console.info(`🕐 Timezone: ${process.env.TZ || 'Asia/Ho_Chi_Minh'}`);
  } catch (error) {
    console.error('❌ Lỗi khởi động:', error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown
 */
const shutdown = async () => {
  console.info('\n🛑 Đang tắt bot...');
  
  // Dừng cron jobs
  stopAllJobs();
  
  // Xoá timers
  clearAllReminders();
  
  // Ngắt kết nối DB
  await disconnectDb();
  
  process.exit(0);
};

// Handle errors
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown();
});

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start
bootstrap();
