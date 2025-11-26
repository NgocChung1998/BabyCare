import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config/index.js';
import { createSafeSendMessage } from '../services/messageService.js';
import { registerStateCleaner } from '../utils/stateManager.js';
import { MAIN_BUTTONS } from './keyboard.js';

export const bot = new TelegramBot(config.botToken, { polling: true });
export const safeSendMessage = createSafeSendMessage(bot);

// Đăng ký state cleaner để tự động clear state khi user bấm button chính
registerStateCleaner(bot, MAIN_BUTTONS);

export default bot;
