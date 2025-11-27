import { registerStartHandler } from './start.js';
import { registerMilkHandler } from './milk.js';
import { registerSleepHandler } from './sleep.js';
import { registerPottyHandler } from './potty.js';
import { registerGrowthHandler } from './growth.js';
import { registerVaccineHandler } from './vaccine.js';
import { registerDiaperHandler } from './diaper.js';
import { registerNightModeHandler } from './nightMode.js';
import { registerSummaryHandler } from './summary.js';
import { registerScheduleHandler } from './schedule.js';
import { registerWeanHandler } from './wean.js';
import { registerGiftHandler } from './gift.js';
import { registerAiHandler } from './ai.js';
import { registerPhotoHandler } from './photo.js';
import { registerBirthdayHandler } from './birthday.js';
import { registerRoutineHandler } from './routine.js';
import { registerSyncHandler } from './sync.js';

/**
 * Đăng ký tất cả handlers
 */
export const registerAllHandlers = () => {
  registerStartHandler();
  registerMilkHandler();
  registerSleepHandler();
  registerPottyHandler();
  registerGrowthHandler();
  registerVaccineHandler();
  registerDiaperHandler();
  registerNightModeHandler();
  registerSummaryHandler();
  registerScheduleHandler();
  registerWeanHandler();
  registerGiftHandler();
  registerAiHandler();
  registerPhotoHandler();
  registerBirthdayHandler();
  registerRoutineHandler();
  registerSyncHandler();

  console.info('✅ Đã đăng ký tất cả handlers');
};

export default registerAllHandlers;

