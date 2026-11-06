import { Reminder, Instalment, Student, MessageLog } from '../models/index.js';
import { calculateInstalmentStatus, dateOnly } from '../domain/instalment.js';
import { REMINDER_OFFSETS } from '../domain/reminders.js';
import { messageProvider, renderReminderTemplate } from './messageProvider.js';
import { clock } from '../config/clock.js';

/**
 * Generate reminder documents for all eligible active instalments across all cohorts.
 * Enforces the unique (instalmentId, offsetDays) index and skips fully paid instalments.
 */
export async function generateRemindersForEligibleInstalments() {
  const activeStudents = await Student.find({ status: 'active' }).populate('parentUserId');
  const todayStr = new Date(dateOnly(clock.today())).toISOString().slice(0, 10);
  let createdCount = 0;

  for (const student of activeStudents) {
    const parentLanguage = student.parentUserId?.language === 'hi' ? 'hi' : 'en';
    const instalments = await Instalment.find({ studentId: student._id });

    for (const inst of instalments) {
      const derived = calculateInstalmentStatus(inst, clock.today());
      if (derived.outstanding <= 0) {
        continue;
      }

      const due = dateOnly(inst.dueDate);

      for (const offsetDays of REMINDER_OFFSETS) {
        const scheduledTime = due + offsetDays * 86_400_000;
        const scheduledDateStr = new Date(scheduledTime).toISOString().slice(0, 10);

        // Don't create reminders for dates long in the past if already overdue at seed
        // But do create if it's pending for today or future or needs initial tracking
        const existing = await Reminder.findOne({ instalmentId: inst._id, offsetDays });
        if (!existing) {
          try {
            await Reminder.create({
              instalmentId: inst._id,
              offsetDays,
              scheduledDate: new Date(scheduledDateStr),
              language: parentLanguage,
              status: 'pending'
            });
            createdCount += 1;
          } catch (err) {
            // Duplicate key race condition guard
            if (err.code !== 11000) throw err;
          }
        }
      }
    }
  }

  return { createdCount };
}

/**
 * Cancel pending reminders for a given instalment (e.g. after full payment).
 */
export async function cancelPendingRemindersForInstalment(instalmentId) {
  const result = await Reminder.updateMany(
    { instalmentId, status: 'pending' },
    { $set: { status: 'cancelled' } }
  );
  return result.modifiedCount;
}

/**
 * Examine and dispatch all pending reminders scheduled for today or earlier.
 * Recalculates live outstanding balance immediately before sending.
 */
export async function dispatchDueReminders() {
  const today = clock.today();
  const todayEndOfDay = new Date(`${today}T23:59:59.999Z`);

  const dueReminders = await Reminder.find({
    status: 'pending',
    scheduledDate: { $lte: todayEndOfDay }
  }).populate({
    path: 'instalmentId',
    populate: {
      path: 'studentId',
      populate: { path: 'parentUserId' }
    }
  });

  let remindersExamined = 0;
  let messagesSent = 0;
  let remindersSkipped = 0;
  let cancellations = 0;
  let failures = 0;

  for (const reminder of dueReminders) {
    remindersExamined += 1;
    const inst = reminder.instalmentId;
    const student = inst?.studentId;
    const parent = student?.parentUserId;

    // Check student status
    if (!student || student.status !== 'active') {
      reminder.status = 'cancelled';
      await reminder.save();
      cancellations += 1;
      remindersSkipped += 1;
      continue;
    }

    // Recheck live outstanding balance
    const liveStatus = calculateInstalmentStatus(inst, today);
    if (liveStatus.outstanding <= 0) {
      reminder.status = 'cancelled';
      await reminder.save();
      cancellations += 1;
      remindersSkipped += 1;
      continue;
    }

    // Prepare template & payment link
    const paymentUrl = `https://checkout.feetrack-mock.test/pay/${inst.paymentLinkToken || inst._id}`;
    const language = reminder.language || parent?.language || 'en';
    const messageBody = renderReminderTemplate({
      language,
      studentName: student.name,
      instalmentSeq: inst.seq,
      amountPaise: liveStatus.outstanding,
      dueDate: inst.dueDate,
      paymentUrl
    });

    const recipientPhone = parent?.phone || '+919900000000';

    try {
      const dispatchResult = await messageProvider.sendMessage({
        channel: 'whatsapp',
        recipientPhone,
        body: messageBody,
        metadata: { reminderId: reminder._id }
      });

      reminder.status = 'sent';
      reminder.sentAt = clock.now();
      await reminder.save();

      await MessageLog.create({
        userId: parent?._id,
        studentId: student._id,
        instalmentId: inst._id,
        reminderId: reminder._id,
        channel: 'whatsapp',
        language,
        template: 'fee_reminder',
        body: messageBody,
        status: 'sent',
        providerRef: dispatchResult.providerRef,
        sentAt: clock.now()
      });

      messagesSent += 1;
    } catch (err) {
      reminder.status = 'failed';
      await reminder.save();

      await MessageLog.create({
        userId: parent?._id,
        studentId: student._id,
        instalmentId: inst._id,
        reminderId: reminder._id,
        channel: 'whatsapp',
        language,
        template: 'fee_reminder',
        body: messageBody,
        status: 'failed',
        providerRef: err.message,
        sentAt: clock.now()
      });

      failures += 1;
    }
  }

  return {
    remindersExamined,
    messagesSent,
    remindersSkipped,
    cancellations,
    failures
  };
}

/**
 * Complete reminder run: schedules eligible records, then dispatches due records.
 */
export async function runReminderCycle() {
  const { createdCount } = await generateRemindersForEligibleInstalments();
  const dispatchSummary = await dispatchDueReminders();
  return {
    newRemindersScheduled: createdCount,
    ...dispatchSummary
  };
}
