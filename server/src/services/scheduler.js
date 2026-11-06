import cron from 'node-cron';
import { env } from '../config/env.js';
import { runReminderCycle } from './reminderService.js';
import { evaluateAllStudentsRisk } from './riskService.js';

let reminderTask = null;
let riskTask = null;

export function startScheduler() {
  if (env.REMINDER_CRON_ENABLED) {
    reminderTask = cron.schedule(env.REMINDER_CRON_SCHEDULE, async () => {
      try {
        console.info('[CRON] Executing scheduled fee reminder cycle...');
        const summary = await runReminderCycle();
        console.info('[CRON] Reminder cycle completed:', summary);
      } catch (err) {
        console.error('[CRON ERROR] Reminder cycle failed:', err);
      }
    });
    console.info(`[SCHEDULER] Reminders scheduled with cron pattern: ${env.REMINDER_CRON_SCHEDULE}`);
  }

  if (env.RISK_CRON_ENABLED) {
    riskTask = cron.schedule(env.RISK_CRON_SCHEDULE, async () => {
      try {
        console.info('[CRON] Executing scheduled dropout risk evaluation...');
        const summary = await evaluateAllStudentsRisk();
        console.info('[CRON] Risk evaluation completed:', summary);
      } catch (err) {
        console.error('[CRON ERROR] Risk evaluation failed:', err);
      }
    });
    console.info(`[SCHEDULER] Risk evaluation scheduled with cron pattern: ${env.RISK_CRON_SCHEDULE}`);
  }
}

export function stopScheduler() {
  if (reminderTask) {
    reminderTask.stop();
    reminderTask = null;
  }
  if (riskTask) {
    riskTask.stop();
    riskTask = null;
  }
}
