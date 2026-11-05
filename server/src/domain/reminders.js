import { calculateInstalmentStatus, dateOnly } from './instalment.js';
export const REMINDER_OFFSETS = Object.freeze([-3, 0, 3, 7, 15]);

export function buildReminderSchedule({ instalment, student, parentLanguage = 'en', now }) {
  if (!instalment?._id || !student?._id) throw new TypeError('Instalment and student are required');
  if (student.status !== 'active' || calculateInstalmentStatus(instalment, now).outstanding === 0) return [];
  const due = dateOnly(instalment.dueDate);
  const today = new Date(dateOnly(now)).toISOString().slice(0, 10);
  return REMINDER_OFFSETS.map(offsetDays => ({
    instalmentId: String(instalment._id), offsetDays,
    scheduledDate: new Date(due + offsetDays * 86_400_000).toISOString().slice(0, 10),
    language: parentLanguage === 'hi' ? 'hi' : 'en', status: 'pending'
  })).filter(item => item.scheduledDate >= today);
}

/** Re-check immediately before dispatch; payment or departure cancels the send. */
export function shouldSendReminder({ instalment, student, reminder, now }) {
  if (!reminder || reminder.status !== 'pending' || student?.status !== 'active') return false;
  if (dateOnly(reminder.scheduledDate) > dateOnly(now)) return false;
  return calculateInstalmentStatus(instalment, now).outstanding > 0;
}

export function cancelPendingReminders(reminders) {
  return reminders.map(item => item.status === 'pending' ? { ...item, status: 'cancelled' } : item);
}
