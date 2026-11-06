import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { connectDB } from '../config/db.js';
import { clock } from '../config/clock.js';
import { User, Centre, Batch, Student, FeePlan, Instalment, Payment, UnmatchedPayment, Attendance, TestScore } from '../models/index.js';

const rupees = value => Math.round(value * 100);
const date = value => new Date(`${value}T00:00:00.000Z`);

export async function seedDatabase({ uri = null, verbose = true } = {}) {
  if (uri) {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  } else if (mongoose.connection.readyState === 0) {
    await connectDB();
  }

  await Promise.all([
    User.deleteMany({}),
    Centre.deleteMany({}),
    Batch.deleteMany({}),
    Student.deleteMany({}),
    FeePlan.deleteMany({}),
    Instalment.deleteMany({}),
    Payment.deleteMany({}),
    UnmatchedPayment.deleteMany({}),
    Attendance.deleteMany({}),
    TestScore.deleteMany({})
  ]);

  const accounts = await User.create({ role: 'accounts', phone: '+919900000001', language: 'en' });
  const parentA = await User.create({ role: 'parent', phone: '+919900000041', language: 'en' });
  const parentI = await User.create({ role: 'parent', phone: '+919900000058', language: 'hi' });
  const parentM = await User.create({ role: 'parent', phone: '+919900000021', language: 'en' });
  const parents = [parentA, parentI, parentM];

  const centreNames = ['Jaipur Central', 'Vaishali Nagar', 'Malviya Nagar', 'Mansarovar'];
  const centres = await Centre.insertMany(centreNames.map((name, i) => ({ code: `JPR-${i + 1}`, name })));

  const batchNames = ['JEE 2027 Morning', 'JEE 2027 Evening', 'NEET 2027 Morning', 'NEET 2027 Evening'];
  const batches = await Batch.insertMany(batchNames.map((name, i) => ({ name, centreId: centres[i % centres.length]._id, academicYear: '2026-27' })));

  const records = [
    { studentId: 'STU-0412', name: 'Aarav Meena', batch: 0, parent: 0, due: '2026-10-10', amount: 30000, paid: 30000 },
    { studentId: 'STU-0587', name: 'Ishita Sharma', batch: 1, parent: 1, due: '2026-10-10', amount: 30000, paid: 15000 },
    { studentId: 'STU-0219', name: 'Mohit Gurjar', batch: 2, parent: 2, due: '2026-11-15', amount: 40000, paid: 0 }
  ];

  const firstNames = ['Anaya', 'Vivaan', 'Diya', 'Aditya', 'Myra', 'Arjun', 'Kiara', 'Reyansh', 'Aadhya', 'Kabir', 'Saanvi', 'Atharv', 'Ira', 'Rudra', 'Navya', 'Aarush', 'Pari', 'Dev'];
  const lastNames = ['Sharma', 'Meena', 'Gurjar', 'Jain', 'Agarwal', 'Singh', 'Joshi', 'Choudhary', 'Verma', 'Saini', 'Rathore', 'Khandelwal'];

  for (let i = 0; i < 50; i++) {
    const batch = i % 4, centre = batch % 4;
    const late = i % 7 === 0, part = i % 5 === 0, future = i % 6 === 0;
    const due = future ? '2026-11-20' : late ? `2026-${i % 2 === 0 ? '08' : '09'}-${String(5 + (i % 20)).padStart(2, '0')}` : '2026-10-25';
    const amount = [25000, 30000, 35000, 40000][i % 4];
    records.push({ studentId: `STU-${1000 + i}`, name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`, batch, parent: i % 3, due, amount, paid: future ? 0 : part ? Math.round(amount / 2) : late ? Math.round(amount * .25) : amount });
  }

  // One mid-term departure is reserved for the refund demonstration.
  records[12].left = true;
  records[12].leftOn = '2026-10-18';

  const createdStudents = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const student = await Student.create({
      studentId: r.studentId,
      name: r.name,
      batchId: batches[r.batch]._id,
      centreId: centres[r.batch % 4]._id,
      parentUserId: parents[r.parent]._id,
      status: r.left ? 'left' : 'active',
      ...(r.left ? { leftOn: date(r.leftOn) } : {})
    });
    createdStudents.push(student);
    const total = rupees(r.amount * 4);
    const plan = await FeePlan.create({ studentId: student._id, total, instalmentCount: 4, gstRatePct: 18, termStart: date('2026-07-01'), termEnd: date('2027-03-31') });
    const inst = await Instalment.create({ studentId: student._id, feePlanId: plan._id, seq: 1, dueDate: date(r.due), amount: rupees(r.amount), discount: 0, paid: rupees(r.paid), paymentLinkToken: `demo-${r.studentId.toLowerCase()}` });
    if (r.paid > 0) await Payment.create({ instalmentId: inst._id, studentId: student._id, amount: rupees(r.paid), source: 'manual', gatewayRef: `SEED-${r.studentId}`, status: 'matched', receivedAt: date(r.due) });
    for (let d = 0; d < 56; d += 4) await Attendance.create({ studentId: student._id, date: new Date(date('2026-09-01').getTime() + d * 86400000), present: !(i % 9 === 0 && d > 28) && !(i % 11 === 0 && d > 36) });
    for (let t = 0; t < 5; t++) await TestScore.create({ studentId: student._id, testName: `Weekly Test ${t + 1}`, date: new Date(date('2026-09-05').getTime() + t * 7 * 86400000), score: Math.max(18, 78 - (i % 6 === 0 ? t * 9 : i % 8 === 0 ? t * 5 : t * 1.5)), maxScore: 100 });
  }

  const unmatched = await Payment.create({ studentId: null, instalmentId: null, amount: rupees(12500), source: 'gateway', gatewayRef: 'UNMATCHED-DEMO-001', status: 'unmatched' });
  await UnmatchedPayment.create({ paymentId: unmatched._id, reason: 'No matching student reference in gateway payload' });

  if (verbose) {
    console.info(`Seeded ${createdStudents.length} students, ${centres.length} centres, ${batches.length} batches. Reference date: ${clock.today()}. Accounts: ${accounts.phone}`);
  }

  return {
    studentsCount: createdStudents.length,
    centresCount: centres.length,
    batchesCount: batches.length,
    accountsPhone: accounts.phone
  };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  try {
    await seedDatabase();
  } finally {
    await mongoose.disconnect();
  }
}

