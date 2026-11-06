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
  UnmatchedPayment,
  Receipt
} from '../src/models/index.js';
import { paymentGateway } from '../src/services/paymentGateway.js';
import { calculateGst, getNextReceiptNumber } from '../src/services/receipt.js';

let mongod;
let server;
let baseUrl;

let accountsCookie;
let parentACookie;
let parentMCookie;
let studentAarav;
let studentIshita;
let studentMohit;

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

  // Obtain cookies for test actors
  accountsCookie = await loginUser('+919900000001');
  parentACookie = await loginUser('+919900000041');
  parentMCookie = await loginUser('+919900000021');

  studentAarav = await Student.findOne({ studentId: 'STU-0412' });
  studentIshita = await Student.findOne({ studentId: 'STU-0587' });
  studentMohit = await Student.findOne({ studentId: 'STU-0219' });
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

// 1. Parent retrieves only their own children
test('1. Parent retrieves only their own children', async () => {
  const res = await fetch(`${baseUrl}/api/parent/children`, {
    headers: { Cookie: parentACookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.children));
  assert.ok(data.children.length > 0);
  // Aarav belongs to Parent A
  assert.ok(data.children.some(c => c.studentId === 'STU-0412'));
  // Ishita and Mohit do not belong to Parent A
  assert.ok(!data.children.some(c => c.studentId === 'STU-0587'));
  assert.ok(!data.children.some(c => c.studentId === 'STU-0219'));
});

// 2. Parent retrieves their own fee ledger
test('2. Parent retrieves their own child fee ledger', async () => {
  const res = await fetch(`${baseUrl}/api/parent/students/${studentAarav._id}/ledger`, {
    headers: { Cookie: parentACookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.student.studentId, 'STU-0412');
  assert.ok(Array.isArray(data.instalments));
  assert.ok(data.instalments.length > 0);
  assert.ok(data.instalments[0].status);
  assert.equal(data.summary.total, 12000000); // 30k * 4 in paise
});

// 3. Parent cannot retrieve another parent's fee ledger
test("3. Parent cannot retrieve another parent's child fee ledger", async () => {
  const res = await fetch(`${baseUrl}/api/parent/students/${studentIshita._id}/ledger`, {
    headers: { Cookie: parentACookie }
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, 'You cannot access this student');
});

// 4. Parent can generate a payment link for their own outstanding instalment
test('4. Parent can generate a payment link for their own outstanding instalment', async () => {
  // Mohit Gurjar has 0 paid on instalment 1 (40,000 amount)
  const inst = await Instalment.findOne({ studentId: studentMohit._id, paid: 0 });
  assert.ok(inst);

  const res = await fetch(`${baseUrl}/api/parent/instalments/${inst._id}/payment-link`, {
    method: 'POST',
    headers: { Cookie: parentMCookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(data.paymentLink.paymentUrl);
  assert.ok(data.paymentLink.orderId);
  assert.equal(data.paymentLink.amount, 4000000);
});

// 5. Parent cannot generate a payment link for another parent's instalment
test("5. Parent cannot generate a payment link for another parent's instalment", async () => {
  const inst = await Instalment.findOne({ studentId: studentMohit._id, paid: 0 });
  assert.ok(inst);

  const res = await fetch(`${baseUrl}/api/parent/instalments/${inst._id}/payment-link`, {
    method: 'POST',
    headers: { Cookie: parentACookie }
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, 'You cannot access this instalment');
});

// 6. Mock gateway creates a valid payment reference
test('6. Mock gateway creates a valid payment reference', async () => {
  const result = await paymentGateway.createPaymentLink({
    instalmentId: new mongoose.Types.ObjectId(),
    studentId: new mongoose.Types.ObjectId(),
    amount: 1500000
  });

  assert.ok(result.orderId.startsWith('ORD_'));
  assert.ok(result.gatewayRef.startsWith('GW_MOCK_'));
  assert.ok(result.paymentUrl.includes('https://checkout.feetrack-mock.test/pay/'));
  assert.equal(result.amount, 1500000);
});

// 7. Valid HMAC webhook records a payment
test('7. Valid HMAC webhook records a payment', async () => {
  // Create an unpaid instalment for Mohit
  const inst = await Instalment.findOne({ studentId: studentMohit._id, seq: 1 });
  const initialPaid = inst.paid;

  const payload = {
    event: 'payment.success',
    gatewayRef: `GW-TEST-WEBHOOK-${Date.now()}`,
    amount: 1000000, // 10,000 paise
    studentId: String(studentMohit._id),
    instalmentId: String(inst._id)
  };

  const rawBody = JSON.stringify(payload);
  const signature = paymentGateway.generateWebhookSignature(rawBody);

  const res = await fetch(`${baseUrl}/api/webhooks/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': signature
    },
    body: rawBody
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.status, 'matched');
  assert.ok(data.paymentId);
  assert.ok(data.receiptNumber);

  // Verify in database
  const updatedInst = await Instalment.findById(inst._id);
  assert.equal(updatedInst.paid, initialPaid + 1000000);

  const paymentDoc = await Payment.findById(data.paymentId);
  assert.equal(paymentDoc.status, 'matched');
  assert.equal(paymentDoc.source, 'gateway');
});

// 8. Invalid HMAC webhook is rejected
test('8. Invalid HMAC webhook is rejected', async () => {
  const payload = {
    event: 'payment.success',
    gatewayRef: `GW-BAD-SIG-${Date.now()}`,
    amount: 500000,
    studentId: String(studentMohit._id)
  };

  const rawBody = JSON.stringify(payload);

  const res = await fetch(`${baseUrl}/api/webhooks/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': '0000000000000000000000000000000000000000000000000000000000000000'
    },
    body: rawBody
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'Invalid or missing webhook signature');
});

// 9. Duplicate webhook does not duplicate payment allocation
test('9. Duplicate webhook does not duplicate payment allocation', async () => {
  const inst = await Instalment.findOne({ studentId: studentMohit._id, seq: 1 });
  const startPaid = inst.paid;

  const gatewayRef = `GW-DUP-TEST-${Date.now()}`;
  const payload = {
    event: 'payment.success',
    gatewayRef,
    amount: 500000,
    studentId: String(studentMohit._id),
    instalmentId: String(inst._id)
  };

  const rawBody = JSON.stringify(payload);
  const signature = paymentGateway.generateWebhookSignature(rawBody);

  // First call
  const res1 = await fetch(`${baseUrl}/api/webhooks/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': signature
    },
    body: rawBody
  });
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.duplicate, undefined);

  // Second call with same gatewayRef
  const res2 = await fetch(`${baseUrl}/api/webhooks/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': signature
    },
    body: rawBody
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.duplicate, true);

  // Verify instalment paid only increased once
  const endInst = await Instalment.findById(inst._id);
  assert.equal(endInst.paid, startPaid + 500000);
});

// 10. Duplicate webhook does not duplicate receipts
test('10. Duplicate webhook does not duplicate receipts', async () => {
  const gatewayRef = `GW-RECEIPT-DUP-${Date.now()}`;
  const payload = {
    event: 'payment.success',
    gatewayRef,
    amount: 500000,
    studentId: String(studentMohit._id)
  };

  const rawBody = JSON.stringify(payload);
  const signature = paymentGateway.generateWebhookSignature(rawBody);

  // Fire webhook twice
  await fetch(`${baseUrl}/api/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
    body: rawBody
  });
  await fetch(`${baseUrl}/api/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
    body: rawBody
  });

  const payment = await Payment.findOne({ gatewayRef });
  assert.ok(payment);

  const receipts = await Receipt.find({ paymentId: payment._id });
  assert.equal(receipts.length, 1);
});

// 11. Targeted payment allocates only to the specified instalment
test('11. Targeted payment allocates only to the specified instalment', async () => {
  // Create test student with two instalments
  const testStudent = await Student.create({
    studentId: `STU-TARGET-${Date.now()}`,
    name: 'Target Test Student',
    batchId: studentMohit.batchId,
    centreId: studentMohit.centreId,
    parentUserId: studentMohit.parentUserId
  });

  const plan = await FeePlan.create({
    studentId: testStudent._id,
    total: 2000000,
    instalmentCount: 2
  });

  const inst1 = await Instalment.create({
    studentId: testStudent._id,
    feePlanId: plan._id,
    seq: 1,
    dueDate: new Date('2026-10-01T00:00:00Z'),
    amount: 1000000,
    paid: 0
  });

  const inst2 = await Instalment.create({
    studentId: testStudent._id,
    feePlanId: plan._id,
    seq: 2,
    dueDate: new Date('2026-11-01T00:00:00Z'),
    amount: 1000000,
    paid: 0
  });

  // Target instalment 2 specifically
  const payload = {
    event: 'payment.success',
    gatewayRef: `GW-TARGET-${Date.now()}`,
    amount: 500000,
    studentId: String(testStudent._id),
    instalmentId: String(inst2._id)
  };
  const rawBody = JSON.stringify(payload);
  const signature = paymentGateway.generateWebhookSignature(rawBody);

  const res = await fetch(`${baseUrl}/api/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
    body: rawBody
  });
  assert.equal(res.status, 200);

  const reloaded1 = await Instalment.findById(inst1._id);
  const reloaded2 = await Instalment.findById(inst2._id);
  assert.equal(reloaded1.paid, 0, 'Instalment 1 must not be paid when targeting instalment 2');
  assert.equal(reloaded2.paid, 500000, 'Instalment 2 must receive targeted payment');
});

// 12. Untargeted payment allocates to the oldest unpaid instalment
test('12. Untargeted payment allocates to the oldest unpaid instalment', async () => {
  const testStudent = await Student.create({
    studentId: `STU-UNTARGET-${Date.now()}`,
    name: 'Untargeted Test Student',
    batchId: studentMohit.batchId,
    centreId: studentMohit.centreId,
    parentUserId: studentMohit.parentUserId
  });

  const plan = await FeePlan.create({
    studentId: testStudent._id,
    total: 2000000,
    instalmentCount: 2
  });

  const inst1 = await Instalment.create({
    studentId: testStudent._id,
    feePlanId: plan._id,
    seq: 1,
    dueDate: new Date('2026-09-01T00:00:00Z'),
    amount: 1000000,
    paid: 400000
  });

  const inst2 = await Instalment.create({
    studentId: testStudent._id,
    feePlanId: plan._id,
    seq: 2,
    dueDate: new Date('2026-10-01T00:00:00Z'),
    amount: 1000000,
    paid: 0
  });

  // Untargeted payment of 900,000 paise (should fill remaining 600,000 on inst1 and spill 300,000 to inst2)
  const payload = {
    event: 'payment.success',
    gatewayRef: `GW-UNTARGET-${Date.now()}`,
    amount: 900000,
    studentId: String(testStudent._id),
    instalmentId: null
  };
  const rawBody = JSON.stringify(payload);
  const signature = paymentGateway.generateWebhookSignature(rawBody);

  const res = await fetch(`${baseUrl}/api/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
    body: rawBody
  });
  assert.equal(res.status, 200);

  const reloaded1 = await Instalment.findById(inst1._id);
  const reloaded2 = await Instalment.findById(inst2._id);
  assert.equal(reloaded1.paid, 1000000, 'Instalment 1 balance filled first');
  assert.equal(reloaded2.paid, 300000, 'Remaining untargeted payment spills to instalment 2');
});

// 13. Unmatched payment enters the unmatched queue without changing balances
test('13. Unmatched payment enters the unmatched queue without changing balances', async () => {
  const initialUnmatchedCount = await UnmatchedPayment.countDocuments({ status: 'open' });
  const totalInstalmentPaidBefore = (await Instalment.find()).reduce((s, i) => s + i.paid, 0);

  const payload = {
    event: 'payment.success',
    gatewayRef: `GW-UNMATCHED-${Date.now()}`,
    amount: 750000,
    studentId: new mongoose.Types.ObjectId().toString(), // Non-existent student
    instalmentId: null
  };
  const rawBody = JSON.stringify(payload);
  const signature = paymentGateway.generateWebhookSignature(rawBody);

  const res = await fetch(`${baseUrl}/api/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
    body: rawBody
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'unmatched');

  const newUnmatchedCount = await UnmatchedPayment.countDocuments({ status: 'open' });
  assert.equal(newUnmatchedCount, initialUnmatchedCount + 1);

  const totalInstalmentPaidAfter = (await Instalment.find()).reduce((s, i) => s + i.paid, 0);
  assert.equal(totalInstalmentPaidAfter, totalInstalmentPaidBefore, 'Balances must not change on unmatched payment');
});

// 14. Accounts user can manually record a payment
test('14. Accounts user can manually record a payment', async () => {
  const inst = await Instalment.findOne({ studentId: studentMohit._id, seq: 1 });
  const paidBefore = inst.paid;
  const ref = `MANUAL-REC-${Date.now()}`;

  const res = await fetch(`${baseUrl}/api/accounts/payments/manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: accountsCookie
    },
    body: JSON.stringify({
      studentId: String(studentMohit._id),
      instalmentId: String(inst._id),
      amount: 250000, // Rs. 2,500
      reference: ref,
      receivedAt: '2026-11-06T10:00:00.000Z'
    })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.payment.source, 'manual');
  assert.equal(data.payment.status, 'matched');
  assert.ok(data.receipt.number);

  const reloadedInst = await Instalment.findById(inst._id);
  assert.equal(reloadedInst.paid, paidBefore + 250000);
});

// 15. Parent cannot record a manual payment
test('15. Parent cannot record a manual payment', async () => {
  const res = await fetch(`${baseUrl}/api/accounts/payments/manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: parentACookie
    },
    body: JSON.stringify({
      studentId: String(studentAarav._id),
      amount: 100000,
      reference: `PARENT-FORBIDDEN-${Date.now()}`
    })
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, 'Insufficient permissions');
});

// 16. Accounts user can match and dismiss unmatched payments
test('16. Accounts user can match and dismiss unmatched payments', async () => {
  // Test 16A: Dismiss an unmatched payment
  const unPayment1 = await Payment.create({
    amount: 300000,
    source: 'gateway',
    gatewayRef: `UNMATCHED-DISMISS-${Date.now()}`,
    status: 'unmatched'
  });
  const unRecord1 = await UnmatchedPayment.create({
    paymentId: unPayment1._id,
    reason: 'Dismiss test reason',
    status: 'open'
  });

  const dismissRes = await fetch(`${baseUrl}/api/accounts/unmatched-payments/${unRecord1._id}/dismiss`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: accountsCookie
    },
    body: JSON.stringify({ reason: 'Payment belongs to sibling academy' })
  });
  assert.equal(dismissRes.status, 200);
  const dismissData = await dismissRes.json();
  assert.equal(dismissData.unmatchedPayment.status, 'dismissed');

  // Test 16B: Match an unmatched payment
  const unPayment2 = await Payment.create({
    amount: 500000,
    source: 'gateway',
    gatewayRef: `UNMATCHED-MATCH-${Date.now()}`,
    status: 'unmatched'
  });
  const unRecord2 = await UnmatchedPayment.create({
    paymentId: unPayment2._id,
    reason: 'Needs manual match',
    status: 'open'
  });

  const inst = await Instalment.findOne({ studentId: studentMohit._id, seq: 1 });
  const paidBefore = inst.paid;

  const matchRes = await fetch(`${baseUrl}/api/accounts/unmatched-payments/${unRecord2._id}/match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: accountsCookie
    },
    body: JSON.stringify({
      studentId: String(studentMohit._id),
      instalmentId: String(inst._id)
    })
  });
  assert.equal(matchRes.status, 200);
  const matchData = await matchRes.json();
  assert.equal(matchData.payment.status, 'matched');
  assert.ok(matchData.receipt.number);

  const reloadedUnmatched = await UnmatchedPayment.findById(unRecord2._id);
  assert.equal(reloadedUnmatched.status, 'matched');

  const reloadedInst = await Instalment.findById(inst._id);
  assert.equal(reloadedInst.paid, paidBefore + 500000);
});

// 17. Cross-student payment allocation is rejected
test('17. Cross-student payment allocation is rejected', async () => {
  // Try to allocate payment with studentAarav's ID but studentMohit's instalment ID
  const mohitInst = await Instalment.findOne({ studentId: studentMohit._id });

  const res = await fetch(`${baseUrl}/api/accounts/payments/manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: accountsCookie
    },
    body: JSON.stringify({
      studentId: String(studentAarav._id),
      instalmentId: String(mohitInst._id),
      amount: 100000,
      reference: `CROSS-STUDENT-${Date.now()}`
    })
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes('does not belong to this student'));
});

// 18. Successful payment generates a GST receipt
test('18. Successful payment generates a GST receipt', async () => {
  const inst = await Instalment.findOne({ studentId: studentMohit._id, seq: 1 });
  const ref = `RCP-GEN-TEST-${Date.now()}`;

  const res = await fetch(`${baseUrl}/api/accounts/payments/manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: accountsCookie
    },
    body: JSON.stringify({
      studentId: String(studentMohit._id),
      instalmentId: String(inst._id),
      amount: 1180000, // Rs. 11,800
      reference: ref
    })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.receipt);
  assert.match(data.receipt.number, /^RCP-\d{4}-\d{6}$/);

  const receiptInDb = await Receipt.findById(data.receipt._id);
  assert.ok(receiptInDb);
  assert.equal(receiptInDb.total, 1180000);
});

// 19. Receipt base + GST equals total
test('19. Receipt base + GST equals total for exact amounts and fractional roundings', async () => {
  const testAmounts = [1, 2, 5, 10, 99, 100, 118, 1000, 11800, 1250000, 3000000];

  for (const amount of testAmounts) {
    const { base, gst, total } = calculateGst(amount, 18);
    assert.equal(base + gst, total, `Base (${base}) + GST (${gst}) must equal Total (${total})`);
    assert.equal(total, amount);
  }

  // 11800 paise -> base: 10000, gst: 1800
  const standard = calculateGst(11800);
  assert.equal(standard.base, 10000);
  assert.equal(standard.gst, 1800);
  assert.equal(standard.total, 11800);
});

// 20. Failed payment generates no receipt
test('20. Failed payment generates no receipt', async () => {
  const payload = {
    event: 'payment.failed',
    gatewayRef: `GW-FAIL-RCP-${Date.now()}`,
    amount: 500000,
    studentId: String(studentMohit._id),
    failureReason: 'Card expired at gateway'
  };

  const rawBody = JSON.stringify(payload);
  const signature = paymentGateway.generateWebhookSignature(rawBody);

  const res = await fetch(`${baseUrl}/api/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
    body: rawBody
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'failed');

  const payment = await Payment.findById(data.paymentId);
  assert.ok(payment);
  assert.equal(payment.status, 'reversed');

  const receipt = await Receipt.findOne({ paymentId: payment._id });
  assert.equal(receipt, null, 'No receipt should be generated for failed payment');
});

// 21. Sequential receipt numbers under concurrent requests
test('21. Sequential receipt numbers under concurrent requests', async () => {
  const numbers = await Promise.all([
    getNextReceiptNumber(2026),
    getNextReceiptNumber(2026),
    getNextReceiptNumber(2026),
    getNextReceiptNumber(2026),
    getNextReceiptNumber(2026)
  ]);

  const unique = new Set(numbers);
  assert.equal(unique.size, 5, 'Concurrent receipt numbers must all be unique');
  for (const num of numbers) {
    assert.match(num, /^RCP-2026-\d{6}$/);
  }
});
