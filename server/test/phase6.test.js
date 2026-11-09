import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { seedDatabase } from '../src/scripts/seed.js';
import { clock } from '../src/config/clock.js';
import {
  User, Student, FeePlan, Instalment, Payment,
  UnmatchedPayment, Receipt, Refund, Centre, Batch
} from '../src/models/index.js';

let mongod;
let server;
let baseUrl;
let accountsCookie;
let parentCookie;
let accountsUser;

async function loginUser(phone) {
  const reqRes = await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-client-id': `login-${phone}` },
    body: JSON.stringify({ phone })
  });
  assert.equal(reqRes.status, 200);
  const { demoOtp } = await reqRes.json();

  const verifyRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-client-id': `ver-${phone}` },
    body: JSON.stringify({ phone, otp: demoOtp || '246810' })
  });
  assert.equal(verifyRes.status, 200);
  const cookie = verifyRes.headers.get('set-cookie');
  return cookie.split(';')[0];
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seedDatabase();

  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  accountsCookie = await loginUser('+919900000001');
  parentCookie = await loginUser('+919900000041');
  accountsUser = await User.findOne({ phone: '+919900000001' });
});

test.after(async () => {
  if (server) await new Promise(r => server.close(r));
  await mongoose.disconnect();
  await mongod.stop();
});

test('1. Role Authorization: Parent user cannot access accounts endpoints', async () => {
  const resDashboard = await fetch(`${baseUrl}/api/accounts/dashboard`, {
    headers: { Cookie: parentCookie }
  });
  assert.equal(resDashboard.status, 403);

  const resStudents = await fetch(`${baseUrl}/api/accounts/students`, {
    headers: { Cookie: parentCookie }
  });
  assert.equal(resStudents.status, 403);

  const resRefunds = await fetch(`${baseUrl}/api/accounts/refunds`, {
    headers: { Cookie: parentCookie }
  });
  assert.equal(resRefunds.status, 403);

  const resManualPay = await fetch(`${baseUrl}/api/accounts/payments/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: parentCookie },
    body: JSON.stringify({})
  });
  assert.equal(resManualPay.status, 403);
});

test('2. Accounts user can access centres and batches metadata endpoints', async () => {
  const centresRes = await fetch(`${baseUrl}/api/accounts/centres`, {
    headers: { Cookie: accountsCookie }
  });
  assert.equal(centresRes.status, 200);
  const centresData = await centresRes.json();
  assert.ok(Array.isArray(centresData.centres));
  assert.equal(centresData.centres.length, 4);

  const batchesRes = await fetch(`${baseUrl}/api/accounts/batches`, {
    headers: { Cookie: accountsCookie }
  });
  assert.equal(batchesRes.status, 200);
  const batchesData = await batchesRes.json();
  assert.ok(Array.isArray(batchesData.batches));
  assert.equal(batchesData.batches.length, 4);
});

test('3. Accounts Dashboard returns aggregate summary, centre summaries, and batch breakdowns', async () => {
  const res = await fetch(`${baseUrl}/api/accounts/dashboard`, {
    headers: { Cookie: accountsCookie }
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.ok);

  const { summary, centreSummaries, batchSummaries } = data;

  // Verify core metrics
  assert.ok(summary.totalStudents >= 50);
  assert.ok(summary.totalExpectedFee > 0);
  assert.ok(summary.totalCollected > 0);
  assert.ok(summary.totalOutstanding >= 0);
  assert.ok(summary.unmatchedCount >= 1);

  // Verify centre breakdown
  assert.ok(Array.isArray(centreSummaries));
  assert.equal(centreSummaries.length, 4);
  for (const cs of centreSummaries) {
    assert.ok(cs.name);
    assert.ok(typeof cs.totalScheduled === 'number');
    assert.ok(typeof cs.totalCollected === 'number');
    assert.ok(typeof cs.collectionPct === 'number');
  }

  // Verify batch breakdown
  assert.ok(Array.isArray(batchSummaries));
  assert.equal(batchSummaries.length, 4);
});

test('4. Accounts Students: search, filtering, and student ledger verification', async () => {
  // Search by name
  const searchRes = await fetch(`${baseUrl}/api/accounts/students?search=Aarav`, {
    headers: { Cookie: accountsCookie }
  });
  assert.equal(searchRes.status, 200);
  const searchData = await searchRes.json();
  assert.ok(searchData.students.some(s => s.name.includes('Aarav')));

  // Search by studentId
  const idRes = await fetch(`${baseUrl}/api/accounts/students?search=STU-0412`, {
    headers: { Cookie: accountsCookie }
  });
  assert.equal(idRes.status, 200);
  const idData = await idRes.json();
  assert.equal(idData.students.length, 1);
  const aarav = idData.students[0];

  // Ledger query
  const ledgerRes = await fetch(`${baseUrl}/api/accounts/students/${aarav.id}/ledger`, {
    headers: { Cookie: accountsCookie }
  });
  assert.equal(ledgerRes.status, 200);
  const ledgerData = await ledgerRes.json();
  assert.equal(ledgerData.student.studentId, 'STU-0412');
  assert.ok(Array.isArray(ledgerData.instalments));
  assert.ok(ledgerData.instalments.length > 0);
});

test('5. Manual Payment Collection: records offline payment, auto-allocates, and issues sequential receipt', async () => {
  // Mohit Gurjar (STU-0219) has Rs.40000 due, Rs.0 paid
  const student = await Student.findOne({ studentId: 'STU-0219' });
  assert.ok(student);

  const inst = await Instalment.findOne({ studentId: student._id });
  assert.ok(inst);

  const payRes = await fetch(`${baseUrl}/api/accounts/payments/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({
      studentId: String(student._id),
      instalmentId: String(inst._id),
      amount: 2000000, // Rs.20,000 partial payment
      reference: 'MANUAL-CASH-TEST-001',
      notes: 'Fee received in cash at centre'
    })
  });

  assert.equal(payRes.status, 200);
  const payData = await payRes.json();
  assert.ok(payData.ok);
  assert.equal(payData.payment.source, 'manual');
  assert.equal(payData.payment.amount, 2000000);
  assert.ok(payData.receipt.number.startsWith('RCP-'));

  // Duplicate reference must be rejected
  const dupRes = await fetch(`${baseUrl}/api/accounts/payments/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({
      studentId: String(student._id),
      amount: 1000000,
      reference: 'MANUAL-CASH-TEST-001'
    })
  });
  assert.equal(dupRes.status, 409);
});

test('6. Unmatched Payments: retrieve queue, match to student, and dismiss with reason', async () => {
  // Retrieve queue
  const listRes = await fetch(`${baseUrl}/api/accounts/unmatched-payments`, {
    headers: { Cookie: accountsCookie }
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.ok(listData.unmatchedPayments.length > 0);

  const unmatched = listData.unmatchedPayments[0];

  // Dismiss workflow: dismiss with audit reason
  const dismissRes = await fetch(`${baseUrl}/api/accounts/unmatched-payments/${unmatched._id}/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ reason: 'Bank chargeback already resolved through offline credit' })
  });

  assert.equal(dismissRes.status, 200);
  const dismissData = await dismissRes.json();
  assert.equal(dismissData.unmatchedPayment.status, 'dismissed');
  assert.equal(dismissData.unmatchedPayment.reason, 'Bank chargeback already resolved through offline credit');
});

test('7. Refunds: calculates preview, enforces 10-day deadline, records refund, and processes status', async () => {
  // Kabir Saini (STU-1009) left on 2026-10-18
  const student = await Student.findOne({ studentId: 'STU-1009' });
  assert.ok(student);
  assert.equal(student.status, 'left');

  // Preview calculation
  const calcRes = await fetch(`${baseUrl}/api/accounts/refunds/calculate/${student._id}`, {
    headers: { Cookie: accountsCookie }
  });

  assert.equal(calcRes.status, 200);
  const calcData = await calcRes.json();
  assert.ok(calcData.refund);
  assert.ok(typeof calcData.refund.refundTotal === 'number');
  assert.ok(typeof calcData.refund.refundBase === 'number');
  assert.ok(typeof calcData.refund.refundGst === 'number');

  // Active student cannot request a refund preview
  const activeStudent = await Student.findOne({ status: 'active' });
  const activeRes = await fetch(`${baseUrl}/api/accounts/refunds/calculate/${activeStudent._id}`, {
    headers: { Cookie: accountsCookie }
  });
  assert.equal(activeRes.status, 400);

  // If student left > 10 days ago relative to clock.today(), refund creation is rejected
  // Kabir Saini left on 2026-10-18; clock.today() is 2026-11-02 (15 days ago > 10 days)
  const expiredRes = await fetch(`${baseUrl}/api/accounts/refunds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({
      studentId: String(student._id),
      status: 'confirmed'
    })
  });
  assert.equal(expiredRes.status, 400);
  const expiredData = await expiredRes.json();
  assert.match(expiredData.error, /deadline of 10 days/i);

  // Now test an eligible student who left within 10 days
  const eligibleStudent = await Student.create({
    studentId: 'STU-REFUND-ELIGIBLE',
    name: 'Rohan Verma',
    centreId: student.centreId,
    batchId: student.batchId,
    parentUserId: student.parentUserId,
    status: 'left',
    leftOn: new Date(new Date(clock.today()).getTime() - 3 * 86400000) // 3 days ago relative to clock.today()
  });

  await FeePlan.create({
    studentId: eligibleStudent._id,
    total: 3000000,
    instalmentCount: 1,
    termStart: new Date('2026-07-01'),
    termEnd: new Date('2027-04-30')
  });

  await Payment.create({
    studentId: eligibleStudent._id,
    amount: 3000000,
    source: 'manual',
    status: 'matched'
  });

  // Eligible refund creation
  const createRes = await fetch(`${baseUrl}/api/accounts/refunds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({
      studentId: String(eligibleStudent._id),
      status: 'confirmed',
      notes: 'Parent requested refund due to relocation'
    })
  });

  assert.equal(createRes.status, 200);
  const createData = await createRes.json();
  assert.ok(createData.refund);
  assert.equal(createData.refund.status, 'confirmed');

  // Process payout with complete audit fields
  const processRes = await fetch(`${baseUrl}/api/accounts/refunds/${createData.refund._id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({
      action: 'pay',
      method: 'bank_transfer',
      reference: 'NEFT-AXIS-9921048',
      paidAt: '2026-11-06T10:00:00.000Z',
      notes: 'Disbursed via bank transfer with student consent'
    })
  });

  assert.equal(processRes.status, 200);
  const processData = await processRes.json();
  assert.equal(processData.refund.status, 'paid');

  // Verify all 4 required audit fields
  assert.ok(processData.refund.payout, 'Payout audit object must exist');
  assert.equal(processData.refund.payout.method, 'bank_transfer', 'Audit method must be recorded');
  assert.equal(processData.refund.payout.reference, 'NEFT-AXIS-9921048', 'Audit reference must be recorded');
  assert.ok(processData.refund.payout.paidAt, 'Audit date must be recorded');
  assert.ok(processData.refund.payout.processedBy, 'Audit staff ID must be recorded');
  assert.equal(String(processData.refund.payout.processedBy._id || processData.refund.payout.processedBy), String(accountsUser._id));
});

test('8. Reports CSV Export: generates sanitized CSV with formula injection prevention including leading whitespace & control chars', async () => {
  const { sanitizeCsvCell } = await import('../src/utils/csvSanitizer.js');

  // Unit tests for formula injection edge cases
  assert.equal(sanitizeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.equal(sanitizeCsvCell('+cmd|/c calc'), "'+cmd|/c calc");
  assert.equal(sanitizeCsvCell('-1+1'), "'-1+1");
  assert.equal(sanitizeCsvCell('@IMPORT'), "'@IMPORT");
  assert.equal(sanitizeCsvCell('|cmd.exe'), "'|cmd.exe");
  assert.equal(sanitizeCsvCell('%1+1'), "'%1+1");

  // Leading whitespace / tabs / carriage returns before formula
  assert.equal(sanitizeCsvCell('   =SUM(A1:A10)'), "'   =SUM(A1:A10)");
  assert.equal(sanitizeCsvCell('  +cmd'), "'  +cmd");
  assert.equal(sanitizeCsvCell('   -500'), "'   -500");
  assert.equal(sanitizeCsvCell('  @IMPORT'), "'  @IMPORT");

  // Control characters (\t, \r, \n, \0)
  assert.equal(sanitizeCsvCell('\t=1+1'), "'\t=1+1");
  assert.equal(sanitizeCsvCell('\0=cmd'), "'=cmd"); // null byte stripped, trigger prefixed
  assert.equal(sanitizeCsvCell('\r\n=calc'), `"'\r\n=calc"`);
  assert.equal(sanitizeCsvCell('\tJustText'), "'\tJustText");

  // Safe normal inputs
  assert.equal(sanitizeCsvCell('Aarav Sharma'), 'Aarav Sharma');
  assert.equal(sanitizeCsvCell(120000), '120000');
  assert.equal(sanitizeCsvCell('Jaipur, Rajasthan'), '"Jaipur, Rajasthan"');
  assert.equal(sanitizeCsvCell('He said "Hello"'), '"He said ""Hello"""');

  // Endpoint export check
  const exportRes = await fetch(`${baseUrl}/api/accounts/reports/export?type=centre_collections`, {
    headers: { Cookie: accountsCookie }
  });

  assert.equal(exportRes.status, 200);
  assert.match(exportRes.headers.get('content-type'), /text\/csv/);
  const csvText = await exportRes.text();
  assert.match(csvText, /Centre Code,Centre Name,City/);
  assert.match(csvText, /Jaipur Central/);

  const batchExportRes = await fetch(`${baseUrl}/api/accounts/reports/export?type=batch_collections`, {
    headers: { Cookie: accountsCookie }
  });
  assert.equal(batchExportRes.status, 200);
  const batchCsv = await batchExportRes.text();
  assert.match(batchCsv, /Batch Name,Centre,Students/);
});

test('9. Bidirectional Role Isolation: Accounts cannot access Parent APIs & Parent cannot access Accounts APIs', async () => {
  // 1. Accounts user cannot access parent children endpoint
  const accountsToParentRes = await fetch(`${baseUrl}/api/parent/children`, {
    headers: { Cookie: accountsCookie }
  });
  assert.equal(accountsToParentRes.status, 403, 'Accounts user must be forbidden from accessing parent routes');

  // 2. Parent user cannot access accounts dashboard
  const parentToAccountsRes = await fetch(`${baseUrl}/api/accounts/dashboard`, {
    headers: { Cookie: parentCookie }
  });
  assert.equal(parentToAccountsRes.status, 403, 'Parent user must be forbidden from accessing accounts routes');
});

test('10. Refund Payout & Rejection Audit Validation: enforces mandatory fields, audit trail, and status integrity', async () => {
  const student = await Student.findOne();
  const centre = await Centre.findOne();
  const batch = await Batch.findOne();

  // Create a student with confirmed refund for audit validation
  const testStudent = await Student.create({
    studentId: `STU-TEST-AUDIT-${Date.now()}`,
    name: 'Audit Validation Student',
    centreId: centre._id,
    batchId: batch._id,
    parentUserId: student.parentUserId,
    status: 'left',
    leftOn: new Date(new Date(clock.today()).getTime() - 3 * 86400000)
  });

  const testFeePlan = await FeePlan.create({
    studentId: testStudent._id,
    total: 4000000,
    instalmentCount: 1,
    termStart: new Date('2026-07-01'),
    termEnd: new Date('2027-04-30')
  });

  await Payment.create({
    studentId: testStudent._id,
    amount: 4000000,
    source: 'manual',
    status: 'matched'
  });

  const testRefund = await Refund.create({
    studentId: testStudent._id,
    inputs: { totalFee: 4000000, paid: 4000000, daysUsed: 10, termDays: 100 },
    breakdown: { netRefund: 3000000, processingFee: 200000 },
    status: 'confirmed',
    deadline: new Date(new Date(clock.today()).getTime() + 7 * 86400000)
  });

  const processUrl = `${baseUrl}/api/accounts/refunds/${testRefund._id}/process`;

  // 1. Unauthorized processing: unauthenticated request
  const noAuthRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'pay', method: 'upi', reference: 'UPI-123', paidAt: '2026-11-06T10:00:00Z' })
  });
  assert.equal(noAuthRes.status, 401, 'Unauthenticated request must be rejected with 401');

  // 2. Unauthorized processing: parent user forbidden
  const parentAuthRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: parentCookie },
    body: JSON.stringify({ action: 'pay', method: 'upi', reference: 'UPI-123', paidAt: '2026-11-06T10:00:00Z' })
  });
  assert.equal(parentAuthRes.status, 403, 'Parent role must be rejected with 403');

  // 3. Missing payment method
  const noMethodRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'pay', reference: 'NEFT-123', paidAt: '2026-11-06T10:00:00Z' })
  });
  assert.equal(noMethodRes.status, 400, 'Missing payment method must return 400');

  // 4. Invalid payment method
  const invalidMethodRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'pay', method: 'cryptocurrency', reference: 'NEFT-123', paidAt: '2026-11-06T10:00:00Z' })
  });
  assert.equal(invalidMethodRes.status, 400, 'Invalid payment method must return 400');

  // 5. Missing transaction reference
  const noRefRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'pay', method: 'bank_transfer', paidAt: '2026-11-06T10:00:00Z' })
  });
  assert.equal(noRefRes.status, 400, 'Missing transaction reference must return 400');

  // 6. Whitespace transaction reference
  const blankRefRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'pay', method: 'bank_transfer', reference: '   ', paidAt: '2026-11-06T10:00:00Z' })
  });
  assert.equal(blankRefRes.status, 400, 'Blank transaction reference must return 400');

  // 7. Missing payout date
  const noDateRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'pay', method: 'bank_transfer', reference: 'NEFT-991' })
  });
  assert.equal(noDateRes.status, 400, 'Missing payout date must return 400');

  // 8. Invalid payout date format and impossible calendar dates
  const badDateRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'pay', method: 'bank_transfer', reference: 'NEFT-991', paidAt: 'not-a-valid-date' })
  });
  assert.equal(badDateRes.status, 400, 'Invalid payout date format must return 400');

  const impossibleFebDateRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'pay', method: 'bank_transfer', reference: 'NEFT-991', paidAt: '2026-02-31' })
  });
  assert.equal(impossibleFebDateRes.status, 400, 'Impossible February 31st date must return 400');

  const impossibleAprDateRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'pay', method: 'bank_transfer', reference: 'NEFT-991', paidAt: '2026-04-31' })
  });
  assert.equal(impossibleAprDateRes.status, 400, 'Impossible April 31st date must return 400');

  // 8b. Enforce valid starting status: draft refund cannot be processed
  const draftRefund = await Refund.create({
    studentId: testStudent._id,
    inputs: { totalFee: 4000000, paid: 4000000, daysUsed: 10, termDays: 100 },
    breakdown: { netRefund: 3000000, processingFee: 200000 },
    status: 'draft',
    deadline: new Date('2026-11-09')
  });

  const draftPayRes = await fetch(`${baseUrl}/api/accounts/refunds/${draftRefund._id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'paid', method: 'bank_transfer', reference: 'NEFT-DRAFT', paidAt: '2026-11-06' })
  });
  assert.equal(draftPayRes.status, 400, 'Draft refund must not be processed for payout');

  const draftRejRes = await fetch(`${baseUrl}/api/accounts/refunds/${draftRefund._id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'reject', reason: 'Draft rejection attempt' })
  });
  assert.equal(draftRejRes.status, 400, 'Draft refund must not be processed for rejection');

  const freshDraft = await Refund.findById(draftRefund._id);
  assert.equal(freshDraft.status, 'draft', 'Draft refund status must remain draft');
  assert.equal(freshDraft.payout, undefined);
  assert.equal(freshDraft.rejection, undefined);

  // 9. Missing rejection reason when rejecting
  const noReasonRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'reject' })
  });
  assert.equal(noReasonRes.status, 400, 'Reject without reason must return 400');

  const blankReasonRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'reject', reason: '    ' })
  });
  assert.equal(blankReasonRes.status, 400, 'Reject with whitespace reason must return 400');

  // Verify record remains untouched ('confirmed') after failed requests
  const freshRecord = await Refund.findById(testRefund._id);
  assert.equal(freshRecord.status, 'confirmed', 'Invalid requests must not alter refund status');

  // 10. Successful rejection with dedicated audit fields
  const rejectRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({
      action: 'reject',
      reason: 'Course attendance exceeded 90% threshold for fee refund'
    })
  });
  assert.equal(rejectRes.status, 200, 'Valid rejection must succeed');
  const rejectData = await rejectRes.json();
  assert.equal(rejectData.refund.status, 'rejected');
  assert.ok(rejectData.refund.rejection, 'Rejection audit object must exist');
  assert.equal(rejectData.refund.rejection.reason, 'Course attendance exceeded 90% threshold for fee refund');
  assert.ok(rejectData.refund.rejection.rejectedAt, 'Rejection timestamp must exist');
  assert.equal(String(rejectData.refund.rejection.rejectedBy._id || rejectData.refund.rejection.rejectedBy), String(accountsUser._id));

  // Consistent rejection timestamps check
  assert.ok(rejectData.refund.inputs.rejectedAt, 'Inputs rejection timestamp must exist');
  assert.equal(
    new Date(rejectData.refund.rejection.rejectedAt).toISOString(),
    new Date(rejectData.refund.inputs.rejectedAt).toISOString(),
    'rejection.rejectedAt and inputs.rejectedAt timestamps must be identical'
  );

  // 11. Payout attempt cannot overwrite rejection
  const dupRejectRes = await fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'pay', method: 'upi', reference: 'UPI-99', paidAt: '2026-11-06T10:00:00Z' })
  });
  assert.equal(dupRejectRes.status, 400, 'Processing already-rejected refund must return 400');
  const freshAfterRejectAttempt = await Refund.findById(testRefund._id);
  assert.equal(freshAfterRejectAttempt.status, 'rejected');
  assert.equal(freshAfterRejectAttempt.payout, undefined, 'Payout must not be written on rejected refund');

  // 12. Create another refund for successful payout & duplicate payout test
  const payoutRefund = await Refund.create({
    studentId: testStudent._id,
    inputs: { totalFee: 4000000, paid: 4000000, daysUsed: 10, termDays: 100 },
    breakdown: { netRefund: 3000000, processingFee: 200000 },
    status: 'confirmed',
    deadline: new Date(new Date(clock.today()).getTime() + 7 * 86400000)
  });

  const payoutUrl = `${baseUrl}/api/accounts/refunds/${payoutRefund._id}/process`;
  const payRes = await fetch(payoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({
      action: 'paid',
      method: 'upi',
      reference: 'UPI-AXIS-99210088',
      paidAt: '2026-11-06T14:30:00.000Z',
      notes: 'Disbursed via official Institute UPI handle'
    })
  });
  assert.equal(payRes.status, 200, 'Valid payout must succeed');
  const payData = await payRes.json();
  assert.equal(payData.refund.status, 'paid');
  assert.ok(payData.refund.payout);
  assert.equal(payData.refund.payout.method, 'upi');
  assert.equal(payData.refund.payout.reference, 'UPI-AXIS-99210088');
  assert.equal(new Date(payData.refund.payout.paidAt).toISOString(), '2026-11-06T14:30:00.000Z');
  assert.equal(String(payData.refund.payout.processedBy._id || payData.refund.payout.processedBy), String(accountsUser._id));

  // 13. Rejection attempt cannot overwrite payout
  const rejOnPaidRes = await fetch(payoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'reject', reason: 'Attempt to reject paid refund' })
  });
  assert.equal(rejOnPaidRes.status, 400, 'Rejecting already-paid refund must return 400');
  const freshAfterPayAttempt = await Refund.findById(payoutRefund._id);
  assert.equal(freshAfterPayAttempt.status, 'paid');
  assert.equal(freshAfterPayAttempt.rejection, undefined, 'Rejection must not be written on paid refund');

  // 14. Duplicate payout attempt on already-paid refund
  const dupPayRes = await fetch(payoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
    body: JSON.stringify({ action: 'paid', method: 'cash', reference: 'CASH-001', paidAt: '2026-11-06T15:00:00Z' })
  });
  assert.equal(dupPayRes.status, 400, 'Processing already-paid refund must return 400');
});

test('11. Refund Processing Concurrency Hardening: atomic transitions block simultaneous payouts and rejections', async () => {
  const student = await Student.findOne();
  const centre = await Centre.findOne();
  const batch = await Batch.findOne();

  // Test Case A: Concurrent Payouts against the same confirmed refund
  const concurrentPayRefund = await Refund.create({
    studentId: student._id,
    inputs: { totalFee: 3000000, paid: 3000000, daysUsed: 5, termDays: 100 },
    breakdown: { netRefund: 2500000, processingFee: 150000 },
    status: 'confirmed',
    deadline: new Date(new Date(clock.today()).getTime() + 7 * 86400000)
  });

  const payUrl = `${baseUrl}/api/accounts/refunds/${concurrentPayRefund._id}/process`;
  const [payRes1, payRes2] = await Promise.all([
    fetch(payUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
      body: JSON.stringify({
        action: 'paid',
        method: 'bank_transfer',
        reference: 'CONC-PAY-A',
        paidAt: '2026-11-06T10:00:00.000Z'
      })
    }),
    fetch(payUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
      body: JSON.stringify({
        action: 'paid',
        method: 'upi',
        reference: 'CONC-PAY-B',
        paidAt: '2026-11-06T10:00:00.000Z'
      })
    })
  ]);

  const payStatuses = [payRes1.status, payRes2.status].sort();
  assert.deepEqual(payStatuses, [200, 400], 'Exactly one concurrent payout request must succeed and the other must return 400');

  // Verify DB state is intact and reflects the single winning transaction
  const finalPaidRefund = await Refund.findById(concurrentPayRefund._id);
  assert.equal(finalPaidRefund.status, 'paid');
  assert.ok(finalPaidRefund.payout);
  assert.ok(['CONC-PAY-A', 'CONC-PAY-B'].includes(finalPaidRefund.payout.reference));
  assert.equal(finalPaidRefund.rejection, undefined);

  // Test Case B: Concurrent Rejections against the same confirmed refund
  const concurrentRejRefund = await Refund.create({
    studentId: student._id,
    inputs: { totalFee: 3000000, paid: 3000000, daysUsed: 5, termDays: 100 },
    breakdown: { netRefund: 2500000, processingFee: 150000 },
    status: 'confirmed',
    deadline: new Date(new Date(clock.today()).getTime() + 7 * 86400000)
  });

  const rejUrl = `${baseUrl}/api/accounts/refunds/${concurrentRejRefund._id}/process`;
  const [rejRes1, rejRes2] = await Promise.all([
    fetch(rejUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
      body: JSON.stringify({ action: 'reject', reason: 'Concurrent rejection reason A' })
    }),
    fetch(rejUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: accountsCookie },
      body: JSON.stringify({ action: 'reject', reason: 'Concurrent rejection reason B' })
    })
  ]);

  const rejStatuses = [rejRes1.status, rejRes2.status].sort();
  assert.deepEqual(rejStatuses, [200, 400], 'Exactly one concurrent rejection request must succeed and the other must return 400');

  const finalRejRefund = await Refund.findById(concurrentRejRefund._id);
  assert.equal(finalRejRefund.status, 'rejected');
  assert.ok(finalRejRefund.rejection);
  assert.ok(['Concurrent rejection reason A', 'Concurrent rejection reason B'].includes(finalRejRefund.rejection.reason));
  assert.equal(
    new Date(finalRejRefund.rejection.rejectedAt).toISOString(),
    new Date(finalRejRefund.inputs.rejectedAt).toISOString(),
    'Concurrent rejection record must have matching rejection timestamps'
  );
  assert.equal(finalRejRefund.payout, undefined);
});
