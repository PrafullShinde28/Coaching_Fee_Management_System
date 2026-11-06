import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { seedDatabase } from '../src/scripts/seed.js';
import {
  User,
  Student,
  Instalment,
  FeePlan,
  Payment,
  Reminder,
  MessageLog,
  RiskFlag,
  Attendance,
  TestScore
} from '../src/models/index.js';
import { clock } from '../src/config/clock.js';
import { REMINDER_OFFSETS } from '../src/domain/reminders.js';
import {
  renderReminderTemplate,
  messageProvider,
  MockWhatsAppProvider
} from '../src/services/messageProvider.js';
import {
  generateRemindersForEligibleInstalments,
  dispatchDueReminders,
  cancelPendingRemindersForInstalment,
  runReminderCycle
} from '../src/services/reminderService.js';
import {
  evaluateStudentRisk,
  evaluateAllStudentsRisk,
  markRiskFlagCalled,
  markRiskFlagFalsePositive
} from '../src/services/riskService.js';

let mongod;
let server;
let baseUrl;

let accountsCookie;
let parentACookie;

async function loginUser(phone) {
  const reqRes = await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  assert.equal(reqRes.status, 200);
  const { demoOtp } = await reqRes.json();

  const verifyRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp: demoOtp || '246810' })
  });
  assert.equal(verifyRes.status, 200);
  const rawCookie = verifyRes.headers.get('set-cookie');
  assert.ok(rawCookie);
  return rawCookie.split(';')[0];
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await seedDatabase({ uri, verbose: false });

  await new Promise(resolve => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  accountsCookie = await loginUser('+919900000001');
  parentACookie = await loginUser('+919900000041');
});

test.after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
});

// --- REMINDER TESTS ---

// 1. All five offsets are generated correctly
test('1. All five offsets are generated correctly for eligible instalments', async () => {
  const student = await Student.findOne({ studentId: 'STU-0219' }); // Mohit Gurjar (paid: 0)
  assert.ok(student);
  const inst = await Instalment.findOne({ studentId: student._id, seq: 1 });
  assert.ok(inst);

  await generateRemindersForEligibleInstalments();

  const reminders = await Reminder.find({ instalmentId: inst._id }).sort({ offsetDays: 1 });
  assert.equal(reminders.length, 5);
  const offsets = reminders.map(r => r.offsetDays);
  assert.deepEqual(offsets, [-3, 0, 3, 7, 15]);
});

// 2. English reminders use English templates
test('2. English reminders use English templates', () => {
  const rendered = renderReminderTemplate({
    language: 'en',
    studentName: 'Aarav Meena',
    instalmentSeq: 1,
    amountPaise: 3000000,
    dueDate: '2026-10-10',
    paymentUrl: 'https://checkout.feetrack-mock.test/pay/demo'
  });

  assert.ok(rendered.includes('Dear Parent'));
  assert.ok(rendered.includes('Aarav Meena'));
  assert.ok(rendered.includes('30,000'));
  assert.ok(rendered.includes('2026-10-10'));
  assert.ok(rendered.includes('https://checkout.feetrack-mock.test/pay/demo'));
  assert.ok(rendered.includes('FEETrack Coaching Institute'));
});

// 3. Hindi reminders use Hindi templates
test('3. Hindi reminders use Hindi templates', () => {
  const rendered = renderReminderTemplate({
    language: 'hi',
    studentName: 'Ishita Sharma',
    instalmentSeq: 1,
    amountPaise: 1500000,
    dueDate: '2026-10-10',
    paymentUrl: 'https://checkout.feetrack-mock.test/pay/demo-ishita'
  });

  assert.ok(rendered.includes('प्रिय अभिभावक'));
  assert.ok(rendered.includes('Ishita Sharma'));
  assert.ok(rendered.includes('15,000'));
  assert.ok(rendered.includes('2026-10-10'));
  assert.ok(rendered.includes('https://checkout.feetrack-mock.test/pay/demo-ishita'));
  assert.ok(rendered.includes('FEETrack कोचिंग संस्थान'));
});

// 4. Fully paid instalments are skipped
test('4. Fully paid instalments are skipped during reminder generation and dispatch', async () => {
  const aarav = await Student.findOne({ studentId: 'STU-0412' }); // Fully paid: 30,000 / 30,000
  const inst = await Instalment.findOne({ studentId: aarav._id, seq: 1 });
  assert.equal(inst.amount, inst.paid);

  // Clear any existing reminders for this instalment
  await Reminder.deleteMany({ instalmentId: inst._id });

  await generateRemindersForEligibleInstalments();

  // No reminders should have been created for fully paid instalment
  const count = await Reminder.countDocuments({ instalmentId: inst._id });
  assert.equal(count, 0);
});

// 5. Part-paid instalments with outstanding balance remain eligible
test('5. Part-paid instalments with outstanding balance remain eligible', async () => {
  const ishita = await Student.findOne({ studentId: 'STU-0587' }); // Ishita: 30,000 due, 15,000 paid (part-paid)
  const inst = await Instalment.findOne({ studentId: ishita._id, seq: 1 });
  assert.ok(inst.paid > 0 && inst.paid < inst.amount);

  await generateRemindersForEligibleInstalments();

  const reminders = await Reminder.find({ instalmentId: inst._id });
  assert.equal(reminders.length, 5, 'Part-paid instalment must have all 5 reminder offsets generated');
});

// 6. Left/inactive students are skipped
test('6. Left/inactive students are skipped', async () => {
  const leftStudent = await Student.findOne({ status: 'left' });
  assert.ok(leftStudent);
  const leftInst = await Instalment.findOne({ studentId: leftStudent._id });
  assert.ok(leftInst);

  // Manually insert a pending reminder due yesterday
  await Reminder.deleteMany({ instalmentId: leftInst._id });
  const reminder = await Reminder.create({
    instalmentId: leftInst._id,
    offsetDays: 0,
    scheduledDate: new Date('2026-10-01'),
    language: 'en',
    status: 'pending'
  });

  const summary = await dispatchDueReminders();

  const reloaded = await Reminder.findById(reminder._id);
  assert.equal(reloaded.status, 'cancelled');
});

// 7. Payment cancels pending reminders
test('7. Payment cancels pending reminders', async () => {
  const student = await Student.findOne({ studentId: 'STU-0219' });
  const inst = await Instalment.findOne({ studentId: student._id, seq: 1 });

  // Ensure pending reminders exist
  await Reminder.deleteMany({ instalmentId: inst._id });
  await Reminder.create([
    { instalmentId: inst._id, offsetDays: -3, scheduledDate: new Date('2026-11-12'), language: 'en', status: 'pending' },
    { instalmentId: inst._id, offsetDays: 0, scheduledDate: new Date('2026-11-15'), language: 'en', status: 'pending' }
  ]);

  // Pay the remaining balance via manual payment
  const remaining = inst.amount - inst.paid;
  const res = await fetch(`${baseUrl}/api/accounts/payments/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({
      studentId: String(student._id),
      instalmentId: String(inst._id),
      amount: remaining,
      reference: `PAY-CANCEL-REMIND-${Date.now()}`
    })
  });
  assert.equal(res.status, 200);

  // Check reminders are now cancelled
  const pendingCount = await Reminder.countDocuments({ instalmentId: inst._id, status: 'pending' });
  assert.equal(pendingCount, 0, 'Pending reminders must be cancelled when fully paid');

  const cancelledCount = await Reminder.countDocuments({ instalmentId: inst._id, status: 'cancelled' });
  assert.ok(cancelledCount >= 2);
});

// 8. Repeated scheduler execution does not send duplicates
test('8. Repeated scheduler execution does not send duplicates', async () => {
  // Create a dedicated active test student with an unpaid instalment
  const testStudent = await Student.create({
    studentId: `STU-DUP-REM-${Date.now()}`,
    name: 'Duplicate Test Student',
    centreId: (await Student.findOne()).centreId,
    batchId: (await Student.findOne()).batchId,
    parentUserId: (await User.findOne({ role: 'parent' }))._id,
    status: 'active'
  });

  const testInst = await Instalment.create({
    studentId: testStudent._id,
    feePlanId: new mongoose.Types.ObjectId(),
    seq: 1,
    dueDate: new Date('2026-11-02T00:00:00Z'),
    amount: 1000000,
    paid: 0
  });

  const rem = await Reminder.create({
    instalmentId: testInst._id,
    offsetDays: 0,
    scheduledDate: new Date('2026-11-02'),
    language: 'en',
    status: 'pending'
  });

  // First run
  const summary1 = await dispatchDueReminders();
  assert.ok(summary1.messagesSent >= 1);

  const reloaded = await Reminder.findById(rem._id);
  assert.equal(reloaded.status, 'sent');

  // Second run immediately after
  const summary2 = await dispatchDueReminders();
  const logsForRem = await MessageLog.find({ reminderId: rem._id });
  assert.equal(logsForRem.length, 1, 'Only one message log should exist; no duplicate send');
});

// 9. Outstanding balance is rechecked immediately before dispatch
test('9. Outstanding balance is rechecked immediately before dispatch', async () => {
  const testStudent = await Student.create({
    studentId: `STU-BALANCE-CHECK-${Date.now()}`,
    name: 'Balance Check Student',
    centreId: (await Student.findOne()).centreId,
    batchId: (await Student.findOne()).batchId,
    parentUserId: (await User.findOne({ role: 'parent' }))._id,
    status: 'active'
  });

  const testInst = await Instalment.create({
    studentId: testStudent._id,
    feePlanId: new mongoose.Types.ObjectId(),
    seq: 1,
    dueDate: new Date('2026-11-01T00:00:00Z'),
    amount: 500000,
    paid: 0
  });

  const rem = await Reminder.create({
    instalmentId: testInst._id,
    offsetDays: 0,
    scheduledDate: new Date('2026-11-01'),
    language: 'en',
    status: 'pending'
  });

  // Simulate payment clearing balance right before dispatch executes
  testInst.paid = 500000;
  await testInst.save();

  const summary = await dispatchDueReminders();

  const reloaded = await Reminder.findById(rem._id);
  assert.equal(reloaded.status, 'cancelled');
  const messageLog = await MessageLog.findOne({ reminderId: rem._id });
  assert.equal(messageLog, null, 'No message should be sent when balance is zero');
});

// 10. One provider failure does not stop other reminders
test('10. One provider failure does not stop other reminders', async () => {
  const parent = await User.findOne({ role: 'parent' });

  const s1 = await Student.create({
    studentId: `STU-FAIL-1-${Date.now()}`,
    name: 'Failure Student 1',
    centreId: (await Student.findOne()).centreId,
    batchId: (await Student.findOne()).batchId,
    parentUserId: parent._id,
    status: 'active'
  });

  const s2 = await Student.create({
    studentId: `STU-FAIL-2-${Date.now()}`,
    name: 'Failure Student 2',
    centreId: (await Student.findOne()).centreId,
    batchId: (await Student.findOne()).batchId,
    parentUserId: parent._id,
    status: 'active'
  });

  const i1 = await Instalment.create({
    studentId: s1._id,
    feePlanId: new mongoose.Types.ObjectId(),
    seq: 1,
    dueDate: new Date('2026-11-01'),
    amount: 1000000,
    paid: 0
  });

  const i2 = await Instalment.create({
    studentId: s2._id,
    feePlanId: new mongoose.Types.ObjectId(),
    seq: 1,
    dueDate: new Date('2026-11-01'),
    amount: 1000000,
    paid: 0
  });

  const r1 = await Reminder.create({
    instalmentId: i1._id,
    offsetDays: 0,
    scheduledDate: new Date('2026-11-01'),
    language: 'en',
    status: 'pending'
  });

  const r2 = await Reminder.create({
    instalmentId: i2._id,
    offsetDays: 0,
    scheduledDate: new Date('2026-11-01'),
    language: 'en',
    status: 'pending'
  });

  // Configure provider to fail once on r1
  const origSend = messageProvider.whatsapp.sendWhatsAppMessage;
  let hasFailedOnce = false;
  messageProvider.whatsapp.sendWhatsAppMessage = async args => {
    if (!hasFailedOnce) {
      hasFailedOnce = true;
      throw new Error('Simulated single provider failure');
    }
    return origSend.call(messageProvider.whatsapp, args);
  };

  try {
    const summary = await dispatchDueReminders();
    assert.ok(summary.failures >= 1, 'Should record at least 1 failure');

    const reloaded1 = await Reminder.findById(r1._id);
    const reloaded2 = await Reminder.findById(r2._id);
    assert.equal(reloaded1.status, 'failed');
    assert.equal(reloaded2.status, 'sent', 'Second reminder must succeed despite first failing');
  } finally {
    messageProvider.whatsapp.sendWhatsAppMessage = origSend;
  }
});

// 11. Every dispatch attempt is recorded in MessageLog
test('11. Every dispatch attempt is recorded in MessageLog with audit fields', async () => {
  const logs = await MessageLog.find().sort({ createdAt: -1 });
  assert.ok(logs.length > 0);
  const log = logs[0];

  assert.ok(log.userId);
  assert.ok(log.studentId);
  assert.ok(log.instalmentId);
  assert.ok(log.channel);
  assert.ok(log.language);
  assert.ok(log.body);
  assert.ok(['sent', 'failed'].includes(log.status));
  assert.ok(log.sentAt);
});

// 12. Parent cannot manually trigger reminder execution
test('12. Parent cannot manually trigger reminder execution', async () => {
  const res = await fetch(`${baseUrl}/api/accounts/reminders/run`, {
    method: 'POST',
    headers: { Cookie: parentACookie }
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, 'Insufficient permissions');
});

// --- RISK TESTS ---

// 13. Payment signals influence the score
test('13. Payment signals influence the score', async () => {
  const student = await Student.findOne({ studentId: 'STU-0587' }); // Ishita (overdue instalment)
  const evalResult = await evaluateStudentRisk(student._id);

  assert.ok(evalResult.components.paymentPoints > 0);
  assert.ok(evalResult.reasons.some(r => r.includes('overdue')));
});

// 14. Attendance decline influences the score
test('14. Attendance decline influences the score', async () => {
  const student = await Student.create({
    studentId: `STU-ATT-RISK-${Date.now()}`,
    name: 'Attendance Risk Student',
    centreId: (await Student.findOne()).centreId,
    batchId: (await Student.findOne()).batchId,
    parentUserId: (await User.findOne({ role: 'parent' }))._id,
    status: 'active'
  });

  // Previous 4 weeks: 100% present (28 days)
  // Latest 4 weeks: 10% present (28 days)
  const attendances = [];
  for (let i = 0; i < 56; i++) {
    const d = new Date(Date.UTC(2026, 8, 1 + i));
    attendances.push({
      studentId: student._id,
      date: d,
      present: i < 28 ? true : i % 10 === 0
    });
  }
  await Attendance.insertMany(attendances);

  const evalResult = await evaluateStudentRisk(student._id);
  assert.ok(evalResult.components.attendancePoints > 0);
  assert.ok(evalResult.reasons.some(r => r.includes('Attendance down')));
});

// 15. Test-score decline influences the score
test('15. Test-score decline influences the score', async () => {
  const student = await Student.create({
    studentId: `STU-TEST-RISK-${Date.now()}`,
    name: 'Test Decline Student',
    centreId: (await Student.findOne()).centreId,
    batchId: (await Student.findOne()).batchId,
    parentUserId: (await User.findOne({ role: 'parent' }))._id,
    status: 'active'
  });

  const scores = [85, 75, 62, 50, 40].map((score, idx) => ({
    studentId: student._id,
    testName: `Mock Test ${idx + 1}`,
    date: new Date(Date.UTC(2026, 9, 1 + idx * 7)),
    score,
    maxScore: 100
  }));
  await TestScore.insertMany(scores);

  const evalResult = await evaluateStudentRisk(student._id);
  assert.ok(evalResult.components.testPoints > 0);
  assert.ok(evalResult.reasons.some(r => r.includes('Test scores declined')));
});

// 16. Missing attendance/test data is handled safely
test('16. Missing attendance/test data is handled safely without false inflation', async () => {
  const student = await Student.create({
    studentId: `STU-NO-DATA-${Date.now()}`,
    name: 'No Data Student',
    centreId: (await Student.findOne()).centreId,
    batchId: (await Student.findOne()).batchId,
    parentUserId: (await User.findOne({ role: 'parent' }))._id,
    status: 'active'
  });

  // No attendance, no test scores, no instalments
  const evalResult = await evaluateStudentRisk(student._id);
  assert.equal(evalResult.score, 0);
  assert.equal(evalResult.band, 'low');
  assert.equal(evalResult.components.attendancePoints, 0);
  assert.equal(evalResult.components.testPoints, 0);
  assert.equal(evalResult.components.paymentPoints, 0);
});

// 17. Scores remain between 0 and 100
test('17. Scores remain bounded between 0 and 100 under extreme signals', async () => {
  const student = await Student.create({
    studentId: `STU-EXTREME-${Date.now()}`,
    name: 'Extreme Signal Student',
    centreId: (await Student.findOne()).centreId,
    batchId: (await Student.findOne()).batchId,
    parentUserId: (await User.findOne({ role: 'parent' }))._id,
    status: 'active'
  });

  // 4 overdue instalments
  for (let i = 0; i < 4; i++) {
    await Instalment.create({
      studentId: student._id,
      feePlanId: new mongoose.Types.ObjectId(),
      seq: i + 1,
      dueDate: new Date('2026-08-01'),
      amount: 1000000,
      paid: 0
    });
  }

  // 100% drop in attendance
  const attendances = [];
  for (let i = 0; i < 56; i++) {
    attendances.push({
      studentId: student._id,
      date: new Date(Date.UTC(2026, 8, 1 + i)),
      present: i < 28
    });
  }
  await Attendance.insertMany(attendances);

  // Severe test drop: 90 -> 10
  const scores = [90, 70, 50, 30, 10].map((score, idx) => ({
    studentId: student._id,
    testName: `Test ${idx + 1}`,
    date: new Date(Date.UTC(2026, 9, 1 + idx * 7)),
    score,
    maxScore: 100
  }));
  await TestScore.insertMany(scores);

  const evalResult = await evaluateStudentRisk(student._id);
  assert.ok(evalResult.score >= 0 && evalResult.score <= 100);
  assert.equal(evalResult.band, 'high');
});

// 18. Risk reasons are readable and explainable
test('18. Risk reasons are readable and explainable', async () => {
  const student = await Student.findOne({ studentId: 'STU-0587' });
  const evalResult = await evaluateStudentRisk(student._id);
  assert.ok(Array.isArray(evalResult.reasons));
  assert.ok(evalResult.reasons.length > 0);
  for (const reason of evalResult.reasons) {
    assert.equal(typeof reason, 'string');
    assert.ok(reason.length > 5);
  }
});

// 19. False-flag cooldown prevents new flags for 30 days
test('19. False-flag cooldown prevents new flags for 30 days', async () => {
  // Find or create a student with a high risk score
  const student = await Student.findOne({ studentId: 'STU-0587' });
  assert.ok(student);

  // Clear existing flags for clean test
  await RiskFlag.deleteMany({ studentId: student._id });

  // Create an open flag
  const flag = await RiskFlag.create({
    studentId: student._id,
    score: 75,
    band: 'high',
    reasons: ['Overdue instalment'],
    status: 'open'
  });

  // Mark false flag via API
  const res = await fetch(`${baseUrl}/api/accounts/risk-flags/${flag._id}/false-flag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ notes: 'Parent confirmed fee will be cleared next week' })
  });
  assert.equal(res.status, 200);

  const reloadedFlag = await RiskFlag.findById(flag._id);
  assert.equal(reloadedFlag.status, 'false_flag');
  assert.ok(reloadedFlag.cooldownUntil > new Date());

  // Run risk evaluation across all students
  const runSummary = await evaluateAllStudentsRisk();
  assert.ok(runSummary.cooldownSuppressed >= 1);

  // Ensure no new open flag was created for this student
  const openFlags = await RiskFlag.find({ studentId: student._id, status: 'open' });
  assert.equal(openFlags.length, 0, 'False-flag cooldown must suppress new open flags');
});

// 20. Existing open flags are not duplicated
test('20. Existing open flags are not duplicated', async () => {
  // Ensure a student has an open flag
  const student = await Student.findOne({ studentId: 'STU-0587' });
  await RiskFlag.deleteMany({ studentId: student._id });

  await evaluateAllStudentsRisk();
  const count1 = await RiskFlag.countDocuments({ studentId: student._id, status: 'open' });

  // Run a second time
  await evaluateAllStudentsRisk();
  const count2 = await RiskFlag.countDocuments({ studentId: student._id, status: 'open' });

  assert.equal(count1, count2, 'Repeated risk evaluation must not duplicate open flags');
});

// 21. Accounts user can mark a flag called
test('21. Accounts user can mark a flag called', async () => {
  const flag = await RiskFlag.findOne({ status: 'open' });
  assert.ok(flag);

  const res = await fetch(`${baseUrl}/api/accounts/risk-flags/${flag._id}/called`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ notes: 'Counsellor spoke with mother; fee planned on Friday' })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.riskFlag.status, 'called');
  assert.ok(data.riskFlag.notes.includes('Counsellor spoke'));
});

// 22. Accounts user can mark a false flag with notes
test('22. Accounts user can mark a false flag with notes', async () => {
  const flag = await RiskFlag.findOne({ status: 'open' });
  assert.ok(flag);

  const res = await fetch(`${baseUrl}/api/accounts/risk-flags/${flag._id}/false-flag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ notes: 'Approved medical leave explains attendance drop' })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.riskFlag.status, 'false_flag');
  assert.ok(data.riskFlag.cooldownUntil);
});

// 23. Risk processing never creates payment records or changes instalment balances
test('23. Safety rule: Risk processing never creates payment records or changes instalment balances', async () => {
  const paymentCountBefore = await Payment.countDocuments();
  const instalmentsBefore = await Instalment.find().select('paid amount');
  const totalPaidBefore = instalmentsBefore.reduce((s, i) => s + i.paid, 0);

  // Run full risk evaluation
  await evaluateAllStudentsRisk();

  const paymentCountAfter = await Payment.countDocuments();
  const instalmentsAfter = await Instalment.find().select('paid amount');
  const totalPaidAfter = instalmentsAfter.reduce((s, i) => s + i.paid, 0);

  assert.equal(paymentCountAfter, paymentCountBefore, 'Risk processing must never create payment records');
  assert.equal(totalPaidAfter, totalPaidBefore, 'Risk processing must never modify instalment balances');
});

// 24. Risk processing never sends parent messages
test('24. Safety rule: Risk processing never sends parent messages', async () => {
  const messageLogsBefore = await MessageLog.countDocuments();

  // Run full risk evaluation
  await evaluateAllStudentsRisk();

  const messageLogsAfter = await MessageLog.countDocuments();
  assert.equal(messageLogsAfter, messageLogsBefore, 'Risk evaluation must never send messages to parents');
});
