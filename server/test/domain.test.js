import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInstalmentStatus } from '../src/domain/instalment.js';
import { planPaymentAllocation } from '../src/domain/payment-allocation.js';
import { buildReminderSchedule, shouldSendReminder, cancelPendingReminders } from '../src/domain/reminders.js';
import { calculateProRataRefund } from '../src/domain/refund.js';
import { scoreDropoutRisk } from '../src/domain/risk-scorer.js';

test('instalment status: paid, partial, due soon, upcoming, overdue and overpayment', () => {
  const base = { amount: 3000000, discount: 0, paid: 0, dueDate: '2026-11-02' };
  assert.equal(calculateInstalmentStatus({ ...base, paid: 3000000 }, '2026-11-02').status, 'paid');
  assert.equal(calculateInstalmentStatus({ ...base, paid: 1000000 }, '2026-11-02').status, 'part_paid');
  assert.equal(calculateInstalmentStatus(base, '2026-11-02').status, 'due_soon');
  assert.equal(calculateInstalmentStatus({ ...base, dueDate: '2026-11-10' }, '2026-11-02').status, 'upcoming');
  assert.deepEqual(calculateInstalmentStatus(base, '2026-11-05'), { outstanding: 3000000, status: 'overdue', daysOverdue: 3 });
  assert.equal(calculateInstalmentStatus({ ...base, paid: 4000000 }, '2026-11-05').outstanding, 0);
  assert.equal(calculateInstalmentStatus({ ...base, discount: 3000000 }, '2026-11-05').status, 'paid');
});

test('payment allocation targets an instalment or oldest unpaid; duplicates are no-op', () => {
  const instalments = [
    { _id: 'b', studentId: 's1', seq: 2, dueDate: '2026-11-01', amount: 1000, paid: 0 },
    { _id: 'a', studentId: 's1', seq: 1, dueDate: '2026-10-01', amount: 1000, paid: 400 }
  ];
  const result = planPaymentAllocation({ payment: { amount: 900, gatewayRef: 'gw-1', studentId: 's1' }, instalments });
  assert.deepEqual(result.allocations, [{ instalmentId: 'a', amount: 600 }, { instalmentId: 'b', amount: 300 }]);
  assert.equal(result.unallocated, 0);
  assert.equal(planPaymentAllocation({ payment: { amount: 900, gatewayRef: 'gw-1' }, instalments, existingGatewayRefs: ['gw-1'] }).duplicate, true);
  assert.equal(planPaymentAllocation({ payment: { amount: 900, gatewayRef: 'gw-2', studentId: 's1', instalmentId: 'missing' }, instalments }).unmatched, true);
  assert.throws(() => planPaymentAllocation({ payment: { amount: 10, gatewayRef: 'x', studentId: 's2' }, instalments }), /belong/);
});

test('reminders use parent language, skip paid/left students and recheck before send', () => {
  const instalment = { _id: 'i1', dueDate: '2026-11-05', amount: 1000, paid: 0 };
  const student = { _id: 's1', status: 'active' };
  const schedule = buildReminderSchedule({ instalment, student, parentLanguage: 'hi', now: '2026-11-02' });
  assert.deepEqual(schedule.map(x => x.offsetDays), [-3, 0, 3, 7, 15]);
  assert.equal(schedule[0].language, 'hi');
  assert.equal(shouldSendReminder({ instalment, student, reminder: schedule[1], now: '2026-11-05' }), true);
  assert.equal(shouldSendReminder({ instalment: { ...instalment, paid: 1000 }, student, reminder: schedule[1], now: '2026-11-05' }), false);
  assert.equal(buildReminderSchedule({ instalment, student: { ...student, status: 'left' }, now: '2026-11-02' }).length, 0);
  assert.equal(cancelPendingReminders(schedule).every(x => x.status === 'cancelled'), true);
});

test('refund: day zero, term end, underpayment, zero payment, discount and deadline', () => {
  const base = { totalFee: 1200000, paid: 1200000, termDays: 100, gstRatePct: 18, leftOn: '2026-11-02' };
  const dayZero = calculateProRataRefund({ ...base, daysUsed: 0 });
  assert.equal(dayZero.usedShare, 0);
  assert.equal(dayZero.deadline, '2026-11-12');
  assert.equal(dayZero.refundBase + dayZero.refundGst, dayZero.refundTotal);
  assert.equal(calculateProRataRefund({ ...base, daysUsed: 120 }).usedShare, base.totalFee);
  assert.equal(calculateProRataRefund({ ...base, paid: 100, daysUsed: 90 }).refundTotal, 0);
  assert.equal(calculateProRataRefund({ ...base, paid: 0, daysUsed: 0 }).refundTotal, 0);
  const discounted = calculateProRataRefund({ ...base, discount: 100000, daysUsed: 20 });
  assert.equal(discounted.feeAfterDiscount, 1100000);
  assert.equal(discounted.processingFee, 60000);
  assert.throws(() => calculateProRataRefund({ ...base, termDays: 0 }), /termDays/);
});

test('risk scorer produces explainable high-risk reasons for multiple declining signals', () => {
  const attendance = [];
  for (let i = 0; i < 56; i++) attendance.push({ date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(), present: i < 28 ? true : i % 4 === 0 });
  const testScores = [80, 74, 65, 55, 48].map((score, i) => ({ date: `2026-09-${String(1 + i * 5).padStart(2, '0')}`, score }));
  const result = scoreDropoutRisk({ instalments: [{ amount: 1000, paid: 0, daysOverdue: 20 }, { amount: 1000, paid: 0, daysOverdue: 5 }], attendance, testScores });
  assert.ok(result.score >= 65);
  assert.equal(result.band, 'high');
  assert.ok(result.reasons.some(x => x.includes('overdue')));
  assert.ok(result.reasons.some(x => x.includes('Attendance down')));
  assert.ok(result.reasons.some(x => x.includes('Test scores declined')));
});

test('partial instalment remains part_paid while overdue days are still derived', () => {
  const result = calculateInstalmentStatus({ amount: 3000000, discount: 0, paid: 1500000, dueDate: '2026-10-10' }, '2026-11-02');
  assert.deepEqual(result, { outstanding: 1500000, status: 'part_paid', daysOverdue: 23 });
});

test('targeted payment never spills into a second instalment and excess stays unallocated', () => {
  const instalments = [
    { _id: 'i1', studentId: 's1', dueDate: '2026-10-01', amount: 1000, paid: 0 },
    { _id: 'i2', studentId: 's1', dueDate: '2026-11-01', amount: 1000, paid: 0 }
  ];
  const result = planPaymentAllocation({ payment: { amount: 1500, gatewayRef: 'targeted', studentId: 's1', instalmentId: 'i1' }, instalments });
  assert.deepEqual(result.allocations, [{ instalmentId: 'i1', amount: 1000 }]);
  assert.equal(result.unallocated, 500);
});
