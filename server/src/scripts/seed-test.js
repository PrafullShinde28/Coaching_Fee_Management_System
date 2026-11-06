import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { seedDatabase } from './seed.js';
import {
  User, Centre, Batch, Student, FeePlan,
  Instalment, Payment, UnmatchedPayment, Attendance, TestScore
} from '../models/index.js';

export async function getCollectionCounts() {
  const [
    users, centres, batches, students, feePlans,
    instalments, payments, unmatchedPayments, attendance, testScores
  ] = await Promise.all([
    User.countDocuments(),
    Centre.countDocuments(),
    Batch.countDocuments(),
    Student.countDocuments(),
    FeePlan.countDocuments(),
    Instalment.countDocuments(),
    Payment.countDocuments(),
    UnmatchedPayment.countDocuments(),
    Attendance.countDocuments(),
    TestScore.countDocuments()
  ]);

  return {
    users, centres, batches, students, feePlans,
    instalments, payments, unmatchedPayments, attendance, testScores
  };
}

export async function verifySampleStudents() {
  console.log('\n--- Verifying Required Sample Students ---');
  const expected = [
    { studentId: 'STU-0412', name: 'Aarav Meena', batchName: 'JEE 2027 Morning', amount: 3000000, paid: 3000000, dueDate: '2026-10-10' },
    { studentId: 'STU-0587', name: 'Ishita Sharma', batchName: 'JEE 2027 Evening', amount: 3000000, paid: 1500000, dueDate: '2026-10-10' },
    { studentId: 'STU-0219', name: 'Mohit Gurjar', batchName: 'NEET 2027 Morning', amount: 4000000, paid: 0, dueDate: '2026-11-15' }
  ];

  for (const exp of expected) {
    const student = await Student.findOne({ studentId: exp.studentId }).populate('batchId');
    if (!student) throw new Error(`Student ${exp.studentId} not found`);
    if (student.name !== exp.name) throw new Error(`Student ${exp.studentId} name mismatch: expected ${exp.name}, got ${student.name}`);
    if (student.batchId.name !== exp.batchName) throw new Error(`Student ${exp.studentId} batch mismatch: expected ${exp.batchName}, got ${student.batchId.name}`);

    const instalment = await Instalment.findOne({ studentId: student._id });
    if (!instalment) throw new Error(`Instalment for ${exp.studentId} not found`);
    if (instalment.amount !== exp.amount) throw new Error(`Instalment amount mismatch for ${exp.studentId}: expected ${exp.amount}, got ${instalment.amount}`);
    if (instalment.paid !== exp.paid) throw new Error(`Instalment paid mismatch for ${exp.studentId}: expected ${exp.paid}, got ${instalment.paid}`);
    const dueStr = instalment.dueDate.toISOString().slice(0, 10);
    if (dueStr !== exp.dueDate) throw new Error(`Instalment due mismatch for ${exp.studentId}: expected ${exp.dueDate}, got ${dueStr}`);

    console.log(`[PASS] ${exp.studentId}: ${exp.name} | Batch: ${exp.batchName} | Amount: Rs.${exp.amount / 100} | Paid: Rs.${exp.paid / 100} | Due: ${dueStr}`);
  }
}

export async function verifyAdditionalDemoData() {
  console.log('\n--- Verifying Additional Demo Data ---');
  // 1. Left student / refund case
  const leftStudent = await Student.findOne({ status: 'left' });
  if (!leftStudent) throw new Error('No left student found for refund demonstration');
  const leftDateStr = leftStudent.leftOn ? leftStudent.leftOn.toISOString().slice(0, 10) : null;
  console.log(`[PASS] Left student for refund demo: ${leftStudent.studentId} (${leftStudent.name}), Left on: ${leftDateStr}`);

  // 2. Unmatched payment
  const unmatched = await Payment.findOne({ status: 'unmatched' });
  if (!unmatched) throw new Error('No unmatched payment found');
  const unmatchedDoc = await UnmatchedPayment.findOne({ paymentId: unmatched._id });
  if (!unmatchedDoc) throw new Error('UnmatchedPayment record missing for unmatched payment');
  console.log(`[PASS] Unmatched payment: ${unmatched.gatewayRef}, Amount: Rs.${unmatched.amount / 100}, Reason: "${unmatchedDoc.reason}"`);

  // 3. Risk examples (attendance & test score signals)
  const attendanceCount = await Attendance.countDocuments();
  const testScoreCount = await TestScore.countDocuments();
  console.log(`[PASS] Risk signals present: ${attendanceCount} attendance records, ${testScoreCount} test scores`);
}

export async function runSeedTest() {
  console.log('Starting MongoMemoryServer for isolated seed verification...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Guard: ensure URI is strictly an ephemeral test instance
  if (!uri.startsWith('mongodb://127.0.0.1') && !uri.startsWith('mongodb://localhost')) {
    await mongod.stop();
    throw new Error(`Safety guard triggered: test seed URI must be local ephemeral instance, got: ${uri}`);
  }

  try {
    console.log(`Connected to isolated test database: ${uri}`);

    // Run 1
    console.log('\n--- Executing Seed Run 1 ---');
    await seedDatabase({ uri, verbose: false });
    const countsRun1 = await getCollectionCounts();
    console.log('Run 1 Collection Counts:', JSON.stringify(countsRun1, null, 2));

    await verifySampleStudents();
    await verifyAdditionalDemoData();

    // Run 2
    console.log('\n--- Executing Seed Run 2 (Idempotency Check) ---');
    await seedDatabase({ uri, verbose: false });
    const countsRun2 = await getCollectionCounts();
    console.log('Run 2 Collection Counts:', JSON.stringify(countsRun2, null, 2));

    // Compare
    let hasMismatch = false;
    for (const [key, val1] of Object.entries(countsRun1)) {
      const val2 = countsRun2[key];
      if (val1 !== val2) {
        console.error(`COUNT MISMATCH on ${key}: Run 1 was ${val1}, Run 2 was ${val2}`);
        hasMismatch = true;
      }
    }

    if (hasMismatch) {
      throw new Error('Seed run 2 resulted in count mismatch or record accumulation!');
    }

    console.log('\n[PASS] Seed idempotency verified! Run 1 and Run 2 counts are identical.');
    console.log('Verification completed successfully.');
    return { countsRun1, countsRun2 };
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongod.stop();
    console.log('MongoMemoryServer stopped cleanly.');
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-test.js')) {
  runSeedTest().catch(err => {
    console.error('Seed verification failed:', err);
    process.exit(1);
  });
}
