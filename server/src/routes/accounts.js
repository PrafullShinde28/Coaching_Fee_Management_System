import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  Student,
  FeePlan,
  Instalment,
  Payment,
  UnmatchedPayment,
  Receipt,
  Reminder,
  MessageLog,
  RiskFlag,
  Centre,
  Batch,
  Refund
} from '../models/index.js';
import { calculateInstalmentStatus } from '../domain/instalment.js';
import { planPaymentAllocation } from '../domain/payment-allocation.js';
import { calculateProRataRefund } from '../domain/refund.js';
import { generateReceiptForPayment } from '../services/receipt.js';
import {
  runReminderCycle,
  cancelPendingRemindersForInstalment
} from '../services/reminderService.js';
import {
  evaluateAllStudentsRisk,
  markRiskFlagCalled,
  markRiskFlagFalsePositive
} from '../services/riskService.js';
import { clock } from '../config/clock.js';
import { sanitizeCsvCell } from '../utils/csvSanitizer.js';

const router = Router();

router.use(requireAuth, requireRole('accounts'));

const objectIdSchema = z.string().refine(val => mongoose.isValidObjectId(val), {
  message: 'Invalid ID format'
});

// 1. Dashboard summary
router.get('/dashboard', async (req, res, next) => {
  try {
    const today = clock.today();
    const filterCentreId = req.query.centreId && mongoose.isValidObjectId(req.query.centreId) ? req.query.centreId : null;
    const filterBatchId = req.query.batchId && mongoose.isValidObjectId(req.query.batchId) ? req.query.batchId : null;

    const studentFilter = {};
    if (filterCentreId) studentFilter.centreId = filterCentreId;
    if (filterBatchId) studentFilter.batchId = filterBatchId;

    const [
      allCentres,
      allBatches,
      students,
      feePlans,
      instalments,
      matchedPayments,
      openUnmatched,
      leftStudentsCount,
      existingRefunds
    ] = await Promise.all([
      Centre.find().sort({ name: 1 }),
      Batch.find().populate('centreId', 'name').sort({ name: 1 }),
      Student.find(studentFilter),
      FeePlan.find(),
      Instalment.find(),
      Payment.find({ status: 'matched' }).sort({ receivedAt: -1 }),
      UnmatchedPayment.find({ status: 'open' }).populate('paymentId'),
      Student.countDocuments({ ...studentFilter, status: 'left' }),
      Refund.find({ status: { $in: ['confirmed', 'paid'] } })
    ]);

    const studentIdsSet = new Set(students.map(s => String(s._id)));

    // Filter fee plans, instalments, and payments by matching students if filtered
    const filteredFeePlans = filterCentreId || filterBatchId
      ? feePlans.filter(fp => studentIdsSet.has(String(fp.studentId)))
      : feePlans;

    const filteredInstalments = filterCentreId || filterBatchId
      ? instalments.filter(i => studentIdsSet.has(String(i.studentId)))
      : instalments;

    const filteredPayments = filterCentreId || filterBatchId
      ? matchedPayments.filter(p => studentIdsSet.has(String(p.studentId)))
      : matchedPayments;

    const totalExpectedFee = filteredFeePlans.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalCollected = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    let totalOverdue = 0;
    let overdueCount = 0;
    for (const inst of filteredInstalments) {
      const derived = calculateInstalmentStatus(inst, today);
      if (derived.status === 'overdue' || (derived.status === 'part_paid' && derived.daysOverdue > 0)) {
        totalOverdue += derived.outstanding;
        overdueCount += 1;
      }
    }

    const unmatchedTotal = openUnmatched.reduce(
      (sum, u) => sum + (u.paymentId?.amount || 0),
      0
    );

    // Map students to their fee plans & payments for centre and batch breakdowns
    const feePlanMap = new Map();
    feePlans.forEach(fp => feePlanMap.set(String(fp.studentId), fp.total || 0));

    const paymentMap = new Map();
    matchedPayments.forEach(p => {
      const sid = String(p.studentId);
      paymentMap.set(sid, (paymentMap.get(sid) || 0) + (p.amount || 0));
    });

    // All students for building centre & batch summaries
    const allStudents = await Student.find();

    // 1. Centre-wise collection summary
    const centreSummaries = allCentres.map(c => {
      const cStudents = allStudents.filter(s => String(s.centreId) === String(c._id));
      const scheduled = cStudents.reduce((sum, s) => sum + (feePlanMap.get(String(s._id)) || 0), 0);
      const collected = cStudents.reduce((sum, s) => sum + (paymentMap.get(String(s._id)) || 0), 0);
      const outstanding = Math.max(0, scheduled - collected);
      const collectionPct = scheduled > 0 ? Math.round((collected / scheduled) * 100) : 0;

      return {
        id: c._id,
        name: c.name,
        code: c.code,
        city: c.city,
        totalStudents: cStudents.length,
        totalScheduled: scheduled,
        totalCollected: collected,
        outstanding,
        collectionPct
      };
    });

    // 2. Batch-wise summary
    const batchSummaries = allBatches.map(b => {
      const bStudents = allStudents.filter(s => String(s.batchId) === String(b._id));
      const scheduled = bStudents.reduce((sum, s) => sum + (feePlanMap.get(String(s._id)) || 0), 0);
      const collected = bStudents.reduce((sum, s) => sum + (paymentMap.get(String(s._id)) || 0), 0);
      const outstanding = Math.max(0, scheduled - collected);
      const collectionPct = scheduled > 0 ? Math.round((collected / scheduled) * 100) : 0;

      return {
        id: b._id,
        name: b.name,
        centreId: b.centreId?._id || b.centreId,
        centreName: b.centreId?.name || 'Jaipur',
        studentCount: bStudents.length,
        totalScheduled: scheduled,
        totalCollected: collected,
        outstanding,
        collectionPct
      };
    });

    const activeCount = students.filter(s => s.status === 'active').length;
    const leftCount = students.filter(s => s.status === 'left').length;
    const refundedStudentIds = new Set(existingRefunds.map(r => String(r.studentId)));
    const pendingRefunds = Math.max(0, leftStudentsCount - refundedStudentIds.size);

    res.json({
      ok: true,
      summary: {
        totalStudents: students.length,
        activeStudents: activeCount,
        leftStudents: leftCount,
        totalExpectedFee,
        totalCollected,
        totalOutstanding: Math.max(0, totalExpectedFee - totalCollected),
        totalOverdue,
        overdueCount,
        unmatchedCount: openUnmatched.length,
        unmatchedTotal,
        pendingRefundsCount: pendingRefunds
      },
      centreSummaries,
      batchSummaries,
      recentPayments: filteredPayments.slice(0, 10)
    });
  } catch (err) {
    next(err);
  }
});

// Centres & Batches listing endpoints
router.get('/centres', async (_req, res, next) => {
  try {
    const centres = await Centre.find().sort({ name: 1 });
    res.json({ ok: true, centres });
  } catch (err) {
    next(err);
  }
});

router.get('/batches', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.centreId && mongoose.isValidObjectId(req.query.centreId)) {
      query.centreId = req.query.centreId;
    }
    const batches = await Batch.find(query).populate('centreId', 'name code').sort({ name: 1 });
    res.json({ ok: true, batches });
  } catch (err) {
    next(err);
  }
});

// 2. List students with fee summary
router.get('/students', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.centreId && mongoose.isValidObjectId(req.query.centreId)) {
      query.centreId = req.query.centreId;
    }
    if (req.query.batchId && mongoose.isValidObjectId(req.query.batchId)) {
      query.batchId = req.query.batchId;
    }
    if (req.query.status && ['active', 'left'].includes(req.query.status)) {
      query.status = req.query.status;
    }
    if (req.query.search && typeof req.query.search === 'string') {
      const regex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [{ name: regex }, { studentId: regex }];
    }

    const students = await Student.find(query)
      .populate('centreId batchId parentUserId', 'name code phone')
      .sort({ studentId: 1 });

    const today = clock.today();
    const enriched = await Promise.all(
      students.map(async s => {
        const feePlan = await FeePlan.findOne({ studentId: s._id });
        const insts = await Instalment.find({ studentId: s._id });
        const derived = insts.map(i => calculateInstalmentStatus(i, today));
        const totalPaid = insts.reduce((sum, i) => sum + (i.paid || 0), 0);
        const totalOutstanding = derived.reduce((sum, d) => sum + d.outstanding, 0);

        return {
          id: s._id,
          studentId: s.studentId,
          name: s.name,
          status: s.status,
          centre: s.centreId,
          batch: s.batchId,
          parent: s.parentUserId,
          feeSummary: {
            total: feePlan?.total || 0,
            paid: totalPaid,
            outstanding: totalOutstanding
          }
        };
      })
    );

    res.json({ ok: true, count: enriched.length, students: enriched });
  } catch (err) {
    next(err);
  }
});

// 3. Student fee ledger and history
router.get('/students/:studentId/ledger', async (req, res, next) => {
  try {
    const { studentId } = z.object({ studentId: objectIdSchema }).parse(req.params);

    const student = await Student.findById(studentId).populate('centreId batchId parentUserId');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const feePlan = await FeePlan.findOne({ studentId: student._id });
    const instalments = await Instalment.find({ studentId: student._id }).sort({ seq: 1 });
    const payments = await Payment.find({ studentId: student._id }).sort({ receivedAt: -1 });

    const paymentIds = payments.map(p => p._id);
    const receipts = await Receipt.find({ paymentId: { $in: paymentIds } }).sort({ createdAt: -1 });

    const today = clock.today();
    const enrichedInstalments = instalments.map(inst => {
      const derived = calculateInstalmentStatus(inst, today);
      return {
        id: inst._id,
        seq: inst.seq,
        dueDate: inst.dueDate,
        amount: inst.amount,
        discount: inst.discount,
        paid: inst.paid,
        outstanding: derived.outstanding,
        status: derived.status,
        daysOverdue: derived.daysOverdue,
        paymentLinkToken: inst.paymentLinkToken
      };
    });

    const totalPaid = instalments.reduce((sum, i) => sum + (i.paid || 0), 0);
    const totalOutstanding = enrichedInstalments.reduce((sum, i) => sum + i.outstanding, 0);

    res.json({
      ok: true,
      student,
      feePlan,
      instalments: enrichedInstalments,
      payments,
      receipts,
      summary: {
        total: feePlan?.total || 0,
        paid: totalPaid,
        outstanding: totalOutstanding
      }
    });
  } catch (err) {
    next(err);
  }
});

// 4. Retrieve instalments across centres/batches
router.get('/instalments', async (req, res, next) => {
  try {
    const instalments = await Instalment.find()
      .populate({
        path: 'studentId',
        select: 'studentId name status batchId centreId',
        populate: [
          { path: 'centreId', select: 'name code' },
          { path: 'batchId', select: 'name' }
        ]
      })
      .sort({ dueDate: 1 });

    const today = clock.today();
    let enriched = instalments.map(inst => {
      const derived = calculateInstalmentStatus(inst, today);
      return {
        id: inst._id,
        student: inst.studentId,
        seq: inst.seq,
        dueDate: inst.dueDate,
        amount: inst.amount,
        discount: inst.discount,
        paid: inst.paid,
        outstanding: derived.outstanding,
        status: derived.status,
        daysOverdue: derived.daysOverdue
      };
    });

    if (req.query.status) {
      enriched = enriched.filter(i => i.status === req.query.status);
    }

    res.json({ ok: true, count: enriched.length, instalments: enriched });
  } catch (err) {
    next(err);
  }
});

// 5. Record manual payment
const manualPaymentSchema = z.object({
  studentId: objectIdSchema,
  instalmentId: objectIdSchema.optional().nullable(),
  amount: z.number().int().positive({ message: 'Amount must be positive integer paise' }),
  reference: z.string().min(1, { message: 'Reference is required' }),
  receivedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

router.post('/payments/manual', async (req, res, next) => {
  try {
    const payload = manualPaymentSchema.parse(req.body);

    const existingRef = await Payment.findOne({ gatewayRef: payload.reference });
    if (existingRef) {
      return res.status(409).json({ error: 'A payment with this reference already exists' });
    }

    const student = await Student.findById(payload.studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const instalments = await Instalment.find({ studentId: student._id }).sort({ dueDate: 1, seq: 1 });
    if (instalments.length === 0) {
      return res.status(400).json({ error: 'No instalments exist for this student' });
    }

    if (payload.instalmentId) {
      const target = instalments.find(i => String(i._id) === String(payload.instalmentId));
      if (!target) {
        return res.status(400).json({ error: 'Specified instalment does not belong to this student' });
      }
    }

    const plan = planPaymentAllocation({
      payment: {
        amount: payload.amount,
        gatewayRef: payload.reference,
        studentId: String(student._id),
        instalmentId: payload.instalmentId ? String(payload.instalmentId) : null
      },
      instalments
    });

    if (plan.unmatched || plan.allocations.length === 0) {
      return res.status(400).json({ error: 'No eligible unpaid balance found for allocation' });
    }

    const receivedAtDate = payload.receivedAt ? new Date(payload.receivedAt) : clock.now();
    const primaryInstalmentId = payload.instalmentId || plan.allocations[0].instalmentId;

    const payment = await Payment.create({
      studentId: student._id,
      instalmentId: primaryInstalmentId,
      amount: payload.amount,
      source: 'manual',
      gatewayRef: payload.reference,
      status: 'matched',
      receivedAt: receivedAtDate
    });

    for (const alloc of plan.allocations) {
      const updated = await Instalment.findByIdAndUpdate(
        alloc.instalmentId,
        { $inc: { paid: alloc.amount } },
        { new: true }
      );
      if (updated && (updated.paid + (updated.discount || 0)) >= updated.amount) {
        await cancelPendingRemindersForInstalment(updated._id);
      }
    }

    const receipt = await generateReceiptForPayment(payment._id, payload.amount);

    res.json({
      ok: true,
      payment,
      receipt,
      allocations: plan.allocations,
      unallocated: plan.unallocated
    });
  } catch (err) {
    next(err);
  }
});

// 6. Retrieve unmatched payments
router.get('/unmatched-payments', async (req, res, next) => {
  try {
    const status = req.query.status || 'open';
    const list = await UnmatchedPayment.find({ status })
      .populate('paymentId')
      .populate('resolvedBy', 'phone role')
      .sort({ createdAt: -1 });

    res.json({ ok: true, unmatchedPayments: list });
  } catch (err) {
    next(err);
  }
});

// 7. Match an unmatched payment to student / instalment
const matchUnmatchedSchema = z.object({
  studentId: objectIdSchema,
  instalmentId: objectIdSchema.optional().nullable()
});

router.post('/unmatched-payments/:id/match', async (req, res, next) => {
  try {
    const { id } = z.object({ id: objectIdSchema }).parse(req.params);
    const { studentId, instalmentId } = matchUnmatchedSchema.parse(req.body);

    const unmatched = await UnmatchedPayment.findById(id).populate('paymentId');
    if (!unmatched || unmatched.status !== 'open') {
      return res.status(400).json({ error: 'Unmatched payment not found or already resolved' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Target student not found' });
    }

    const instalments = await Instalment.find({ studentId: student._id }).sort({ dueDate: 1, seq: 1 });
    if (instalmentId) {
      const belongs = instalments.some(i => String(i._id) === String(instalmentId));
      if (!belongs) {
        return res.status(400).json({ error: 'Specified instalment does not belong to this student' });
      }
    }

    const paymentDoc = unmatched.paymentId;
    const plan = planPaymentAllocation({
      payment: {
        amount: paymentDoc.amount,
        gatewayRef: paymentDoc.gatewayRef || `MATCH-${paymentDoc._id}`,
        studentId: String(student._id),
        instalmentId: instalmentId ? String(instalmentId) : null
      },
      instalments
    });

    if (plan.unmatched || plan.allocations.length === 0) {
      return res.status(400).json({ error: 'No eligible unpaid balance on this student for payment amount' });
    }

    const primaryInstalmentId = instalmentId || plan.allocations[0].instalmentId;
    paymentDoc.studentId = student._id;
    paymentDoc.instalmentId = primaryInstalmentId;
    paymentDoc.status = 'matched';
    await paymentDoc.save();

    for (const alloc of plan.allocations) {
      const updated = await Instalment.findByIdAndUpdate(
        alloc.instalmentId,
        { $inc: { paid: alloc.amount } },
        { new: true }
      );
      if (updated && (updated.paid + (updated.discount || 0)) >= updated.amount) {
        await cancelPendingRemindersForInstalment(updated._id);
      }
    }

    const receipt = await generateReceiptForPayment(paymentDoc._id, paymentDoc.amount);

    unmatched.status = 'matched';
    unmatched.resolvedBy = req.user._id;
    unmatched.resolvedAt = clock.now();
    await unmatched.save();

    res.json({
      ok: true,
      payment: paymentDoc,
      receipt,
      allocations: plan.allocations,
      unallocated: plan.unallocated
    });
  } catch (err) {
    next(err);
  }
});

// 8. Dismiss unmatched payment with audit reason
const dismissSchema = z.object({
  reason: z.string().min(1, { message: 'Dismissal reason is required' })
});

router.post('/unmatched-payments/:id/dismiss', async (req, res, next) => {
  try {
    const { id } = z.object({ id: objectIdSchema }).parse(req.params);
    const { reason } = dismissSchema.parse(req.body);

    const unmatched = await UnmatchedPayment.findById(id).populate('paymentId');
    if (!unmatched || unmatched.status !== 'open') {
      return res.status(400).json({ error: 'Unmatched payment not found or already resolved' });
    }

    unmatched.status = 'dismissed';
    unmatched.reason = reason;
    unmatched.resolvedBy = req.user._id;
    unmatched.resolvedAt = clock.now();
    await unmatched.save();

    res.json({ ok: true, unmatchedPayment: unmatched });
  } catch (err) {
    next(err);
  }
});

// 9. Retrieve issued receipts
router.get('/receipts', async (_req, res, next) => {
  try {
    const receipts = await Receipt.find()
      .populate({
        path: 'paymentId',
        select: 'amount source gatewayRef receivedAt studentId',
        populate: {
          path: 'studentId',
          select: 'studentId name'
        }
      })
      .sort({ createdAt: -1 });

    res.json({ ok: true, count: receipts.length, receipts });
  } catch (err) {
    next(err);
  }
});

// 10. Retrieve reminder records
router.get('/reminders', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.instalmentId && mongoose.isValidObjectId(req.query.instalmentId)) {
      query.instalmentId = req.query.instalmentId;
    }

    const reminders = await Reminder.find(query)
      .populate({
        path: 'instalmentId',
        select: 'seq dueDate amount paid studentId',
        populate: {
          path: 'studentId',
          select: 'studentId name centreId batchId status'
        }
      })
      .sort({ scheduledDate: 1, offsetDays: 1 });

    res.json({ ok: true, count: reminders.length, reminders });
  } catch (err) {
    next(err);
  }
});

// 11. Manually trigger reminder execution cycle
router.post('/reminders/run', async (_req, res, next) => {
  try {
    const summary = await runReminderCycle();
    res.json({ ok: true, summary });
  } catch (err) {
    next(err);
  }
});

// 12. Retrieve message dispatch history
router.get('/message-logs', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.studentId && mongoose.isValidObjectId(req.query.studentId)) {
      query.studentId = req.query.studentId;
    }
    if (req.query.channel) {
      query.channel = req.query.channel;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    const logs = await MessageLog.find(query)
      .populate('userId', 'phone role language')
      .populate('studentId', 'studentId name')
      .populate('instalmentId', 'seq dueDate amount')
      .populate('reminderId', 'offsetDays scheduledDate')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 100);

    res.json({ ok: true, count: logs.length, messageLogs: logs });
  } catch (err) {
    next(err);
  }
});

// 13. Retrieve at-risk student queue
router.get('/risk-flags', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.band) {
      query.band = req.query.band;
    }

    const flags = await RiskFlag.find(query)
      .populate({
        path: 'studentId',
        select: 'studentId name status centreId batchId',
        populate: [
          { path: 'centreId', select: 'name code' },
          { path: 'batchId', select: 'name' }
        ]
      })
      .sort({ score: -1, createdAt: -1 });

    res.json({ ok: true, count: flags.length, riskFlags: flags });
  } catch (err) {
    next(err);
  }
});

// 14. Mark a counsellor call completed
const calledSchema = z.object({
  notes: z.string().optional()
});

router.post('/risk-flags/:id/called', async (req, res, next) => {
  try {
    const { id } = z.object({ id: objectIdSchema }).parse(req.params);
    const { notes } = calledSchema.parse(req.body);

    const flag = await markRiskFlagCalled(id, notes);
    if (!flag) {
      return res.status(404).json({ error: 'Risk flag not found' });
    }

    res.json({ ok: true, riskFlag: flag });
  } catch (err) {
    next(err);
  }
});

// 15. Mark flag as false positive and save notes (30-day cooldown)
const falseFlagSchema = z.object({
  notes: z.string().min(1, { message: 'Notes are required when marking a false flag' })
});

router.post('/risk-flags/:id/false-flag', async (req, res, next) => {
  try {
    const { id } = z.object({ id: objectIdSchema }).parse(req.params);
    const { notes } = falseFlagSchema.parse(req.body);

    const flag = await markRiskFlagFalsePositive(id, notes);
    if (!flag) {
      return res.status(404).json({ error: 'Risk flag not found' });
    }

    res.json({ ok: true, riskFlag: flag });
  } catch (err) {
    next(err);
  }
});

// 16. Manually execute risk evaluation cycle
router.post('/risk/run', async (_req, res, next) => {
  try {
    const summary = await evaluateAllStudentsRisk();
    res.json({ ok: true, summary });
  } catch (err) {
    next(err);
  }
});

// 17. Refunds Management
// Helper to derive termDays and daysUsed for refund calculation
function deriveUsageParams(student, feePlan) {
  const termStart = feePlan.termStart ? new Date(feePlan.termStart) : new Date('2026-07-01');
  const termEnd = feePlan.termEnd ? new Date(feePlan.termEnd) : new Date('2027-04-30');
  const leftDate = student.leftOn ? new Date(student.leftOn) : clock.now();

  const termDays = Math.max(1, Math.round((termEnd.getTime() - termStart.getTime()) / 86400000));
  const daysUsed = Math.max(0, Math.min(termDays, Math.round((leftDate.getTime() - termStart.getTime()) / 86400000)));

  return { termDays, daysUsed, termStart, termEnd, leftDate };
}

// List all refunds and pending left students
router.get('/refunds', async (_req, res, next) => {
  try {
    const today = clock.today();

    const [refunds, leftStudents] = await Promise.all([
      Refund.find()
        .populate({
          path: 'studentId',
          select: 'studentId name status centreId batchId leftOn',
          populate: [
            { path: 'centreId', select: 'name code' },
            { path: 'batchId', select: 'name' }
          ]
        })
        .populate('payout.processedBy', 'phone role name')
        .populate('rejection.rejectedBy', 'phone role name')
        .sort({ createdAt: -1 }),
      Student.find({ status: 'left' })
        .populate('centreId batchId', 'name code')
        .sort({ leftOn: -1 })
    ]);

    const refundedStudentIds = new Set(refunds.map(r => String(r.studentId?._id || r.studentId)));

    // Enriched pending left students
    const pendingLeft = await Promise.all(
      leftStudents
        .filter(s => !refundedStudentIds.has(String(s._id)))
        .map(async s => {
          const feePlan = await FeePlan.findOne({ studentId: s._id });
          const payments = await Payment.find({ studentId: s._id, status: 'matched' });
          const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

          const deadlineDate = s.leftOn ? new Date(new Date(s.leftOn).getTime() + 10 * 86400000) : null;
          const deadlineIso = deadlineDate ? deadlineDate.toISOString().slice(0, 10) : null;
          const isDeadlineExpired = deadlineIso ? clock.today() > deadlineIso : false;

          let preview = null;
          if (feePlan) {
            const { termDays, daysUsed } = deriveUsageParams(s, feePlan);
            try {
              preview = calculateProRataRefund({
                totalFee: feePlan.total,
                paid: totalPaid,
                daysUsed,
                termDays,
                discount: feePlan.discount || 0,
                leftOn: s.leftOn
              });
            } catch (_e) {}
          }

          return {
            student: s,
            totalFee: feePlan?.total || 0,
            paid: totalPaid,
            deadline: deadlineDate,
            isDeadlineExpired,
            preview
          };
        })
    );

    res.json({
      ok: true,
      refunds,
      pendingEligibleStudents: pendingLeft
    });
  } catch (err) {
    next(err);
  }
});

// Calculate refund preview for a student who left
router.get('/refunds/calculate/:studentId', async (req, res, next) => {
  try {
    const { studentId } = z.object({ studentId: objectIdSchema }).parse(req.params);

    const student = await Student.findById(studentId).populate('centreId batchId');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (student.status !== 'left') {
      return res.status(400).json({ error: 'Refunds are only eligible for students who have left the institute' });
    }

    const feePlan = await FeePlan.findOne({ studentId: student._id });
    if (!feePlan) return res.status(400).json({ error: 'No fee plan found for this student' });

    const payments = await Payment.find({ studentId: student._id, status: 'matched' });
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);

    const { termDays, daysUsed, termStart, termEnd, leftDate } = deriveUsageParams(student, feePlan);

    const refundBreakdown = calculateProRataRefund({
      totalFee: feePlan.total,
      paid,
      daysUsed,
      termDays,
      discount: feePlan.discount || 0,
      leftOn: student.leftOn
    });

    const deadlineDate = new Date(new Date(student.leftOn).getTime() + 10 * 86400000);
    const deadlineIso = deadlineDate.toISOString().slice(0, 10);
    const isDeadlineExpired = clock.today() > deadlineIso;

    res.json({
      ok: true,
      student,
      feePlan: {
        total: feePlan.total,
        discount: feePlan.discount || 0,
        termStart,
        termEnd
      },
      usage: {
        termDays,
        daysUsed,
        leftDate
      },
      deadline: deadlineDate,
      isDeadlineExpired,
      refund: refundBreakdown
    });
  } catch (err) {
    next(err);
  }
});

// Record a new refund
const createRefundSchema = z.object({
  studentId: objectIdSchema,
  status: z.enum(['draft', 'confirmed']).default('confirmed'),
  notes: z.string().optional()
});

router.post('/refunds', async (req, res, next) => {
  try {
    const { studentId, status, notes } = createRefundSchema.parse(req.body);

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (student.status !== 'left') {
      return res.status(400).json({ error: 'Student has not been marked as left' });
    }

    // Check duplicate
    const existing = await Refund.findOne({ studentId: student._id });
    if (existing) {
      return res.status(400).json({ error: 'Refund record already exists for this student' });
    }

    // Enforce 10-day deadline
    const deadlineDate = new Date(new Date(student.leftOn).getTime() + 10 * 86400000);
    const deadlineIso = deadlineDate.toISOString().slice(0, 10);
    if (clock.today() > deadlineIso) {
      return res.status(400).json({ error: 'Refund deadline of 10 days from leaving date has expired' });
    }

    const feePlan = await FeePlan.findOne({ studentId: student._id });
    if (!feePlan) return res.status(400).json({ error: 'Fee plan not found for this student' });

    const payments = await Payment.find({ studentId: student._id, status: 'matched' });
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);

    const { termDays, daysUsed } = deriveUsageParams(student, feePlan);

    const breakdown = calculateProRataRefund({
      totalFee: feePlan.total,
      paid,
      daysUsed,
      termDays,
      discount: feePlan.discount || 0,
      leftOn: student.leftOn
    });

    const refund = await Refund.create({
      studentId: student._id,
      inputs: {
        totalFee: feePlan.total,
        discount: feePlan.discount || 0,
        paid,
        daysUsed,
        termDays,
        leftOn: student.leftOn,
        notes
      },
      breakdown,
      status,
      deadline: deadlineDate,
      confirmedAt: status === 'confirmed' ? clock.now() : null
    });

    res.json({ ok: true, refund });
  } catch (err) {
    next(err);
  }
});

// Update refund status (process payout or reject)
const payRefundSchema = z.object({
  action: z.enum(['pay', 'paid']),
  method: z.enum(['bank_transfer', 'cheque', 'upi', 'cash', 'other'], {
    required_error: 'Payment method is required',
    invalid_type_error: 'Invalid payment method'
  }),
  reference: z.string({
    required_error: 'Transaction reference is required'
  }).trim().min(1, { message: 'Transaction reference is required' }).max(100),
  paidAt: z.string({
    required_error: 'Payout date is required'
  }).min(1, { message: 'Payout date is required' }).refine((val) => {
    const timestamp = Date.parse(val);
    return !isNaN(timestamp);
  }, {
    message: 'Invalid payout date format'
  }),
  notes: z.string().trim().max(500).optional()
});

const rejectRefundSchema = z.object({
  action: z.enum(['reject', 'rejected']),
  reason: z.string().trim().min(1).optional(),
  rejectionReason: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(500).optional()
}).refine((data) => {
  const r = (data.reason || data.rejectionReason || '').trim();
  return r.length > 0;
}, {
  message: 'Rejection reason is required',
  path: ['reason']
});

router.post('/refunds/:id/process', async (req, res, next) => {
  try {
    const { id } = z.object({ id: objectIdSchema }).parse(req.params);

    const rawAction = req.body?.action;
    if (!rawAction || !['pay', 'paid', 'reject', 'rejected'].includes(rawAction)) {
      return res.status(400).json({ error: 'Invalid action. Must be pay, paid, reject, or rejected' });
    }

    const payload = (rawAction === 'pay' || rawAction === 'paid')
      ? payRefundSchema.parse(req.body)
      : rejectRefundSchema.parse(req.body);

    const refund = await Refund.findById(id).populate('studentId');
    if (!refund) return res.status(404).json({ error: 'Refund record not found' });

    if (refund.status === 'paid' || refund.status === 'rejected') {
      return res.status(400).json({ error: `Refund has already been processed with status: ${refund.status}` });
    }

    const isPay = payload.action === 'pay' || payload.action === 'paid';
    if (isPay) {
      refund.status = 'paid';
      refund.payout = {
        method: payload.method,
        reference: payload.reference.trim(),
        paidAt: new Date(payload.paidAt),
        processedBy: req.user._id,
        notes: payload.notes ? payload.notes.trim() : undefined
      };
      refund.rejection = undefined;
    } else {
      const rejectionReason = (payload.reason || payload.rejectionReason).trim();
      refund.status = 'rejected';
      refund.rejection = {
        reason: rejectionReason,
        rejectedBy: req.user._id,
        rejectedAt: clock.now()
      };
      refund.inputs = {
        ...refund.inputs,
        rejectionReason,
        rejectedBy: req.user._id,
        rejectedAt: clock.now()
      };
      refund.payout = undefined;
    }

    await refund.save();
    await refund.populate([
      { path: 'payout.processedBy', select: 'phone role name' },
      { path: 'rejection.rejectedBy', select: 'phone role name' }
    ]);

    res.json({ ok: true, refund });
  } catch (err) {
    next(err);
  }
});

function formatPaiseToRupees(paise = 0) {
  return `Rs. ${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

router.get('/reports/export', async (req, res, next) => {
  try {
    const type = req.query.type || 'centre_collections';
    const today = clock.today();

    let headers = [];
    let rows = [];
    let filename = `feetrack-${type}-${new Date().toISOString().slice(0, 10)}.csv`;

    if (type === 'centre_collections') {
      headers = ['Centre Code', 'Centre Name', 'City', 'Students', 'Scheduled Fees', 'Collected Fees', 'Outstanding', 'Collection %'];
      const [centres, students, feePlans, payments] = await Promise.all([
        Centre.find().sort({ name: 1 }),
        Student.find(),
        FeePlan.find(),
        Payment.find({ status: 'matched' })
      ]);

      const planMap = new Map();
      feePlans.forEach(fp => planMap.set(String(fp.studentId), fp.total || 0));

      const payMap = new Map();
      payments.forEach(p => payMap.set(String(p.studentId), (payMap.get(String(p.studentId)) || 0) + p.amount));

      rows = centres.map(c => {
        const cStudents = students.filter(s => String(s.centreId) === String(c._id));
        const scheduled = cStudents.reduce((sum, s) => sum + (planMap.get(String(s._id)) || 0), 0);
        const collected = cStudents.reduce((sum, s) => sum + (payMap.get(String(s._id)) || 0), 0);
        const outstanding = Math.max(0, scheduled - collected);
        const pct = scheduled > 0 ? Math.round((collected / scheduled) * 100) : 0;

        return [c.code, c.name, c.city, cStudents.length, formatPaiseToRupees(scheduled), formatPaiseToRupees(collected), formatPaiseToRupees(outstanding), `${pct}%`];
      });
    } else if (type === 'batch_collections') {
      headers = ['Batch Name', 'Centre', 'Students', 'Scheduled Fees', 'Collected Fees', 'Outstanding', 'Collection %'];
      const [batches, students, feePlans, payments] = await Promise.all([
        Batch.find().populate('centreId', 'name').sort({ name: 1 }),
        Student.find(),
        FeePlan.find(),
        Payment.find({ status: 'matched' })
      ]);

      const planMap = new Map();
      feePlans.forEach(fp => planMap.set(String(fp.studentId), fp.total || 0));

      const payMap = new Map();
      payments.forEach(p => payMap.set(String(p.studentId), (payMap.get(String(p.studentId)) || 0) + p.amount));

      rows = batches.map(b => {
        const bStudents = students.filter(s => String(s.batchId) === String(b._id));
        const scheduled = bStudents.reduce((sum, s) => sum + (planMap.get(String(s._id)) || 0), 0);
        const collected = bStudents.reduce((sum, s) => sum + (payMap.get(String(s._id)) || 0), 0);
        const outstanding = Math.max(0, scheduled - collected);
        const pct = scheduled > 0 ? Math.round((collected / scheduled) * 100) : 0;

        return [b.name, b.centreId?.name || 'Jaipur', bStudents.length, formatPaiseToRupees(scheduled), formatPaiseToRupees(collected), formatPaiseToRupees(outstanding), `${pct}%`];
      });
    } else if (type === 'outstanding_fees' || type === 'overdue_instalments') {
      headers = ['Student ID', 'Student Name', 'Centre', 'Batch', 'Instalment #', 'Due Date', 'Amount', 'Paid', 'Outstanding', 'Status', 'Days Overdue'];
      const instalments = await Instalment.find()
        .populate({
          path: 'studentId',
          select: 'studentId name status batchId centreId',
          populate: [
            { path: 'centreId', select: 'name' },
            { path: 'batchId', select: 'name' }
          ]
        })
        .sort({ dueDate: 1 });

      const filtered = instalments
        .map(inst => {
          const derived = calculateInstalmentStatus(inst, today);
          return { inst, derived };
        })
        .filter(({ derived }) => {
          if (type === 'overdue_instalments') {
            return derived.status === 'overdue' || (derived.status === 'part_paid' && derived.daysOverdue > 0);
          }
          return derived.outstanding > 0;
        });

      rows = filtered.map(({ inst, derived }) => [
        inst.studentId?.studentId || '',
        inst.studentId?.name || '',
        inst.studentId?.centreId?.name || '',
        inst.studentId?.batchId?.name || '',
        `#${inst.seq}`,
        inst.dueDate.toISOString().slice(0, 10),
        formatPaiseToRupees(inst.amount),
        formatPaiseToRupees(inst.paid || 0),
        formatPaiseToRupees(derived.outstanding),
        derived.status,
        derived.daysOverdue || 0
      ]);
    } else if (type === 'payment_history') {
      headers = ['Payment Date', 'Student ID', 'Student Name', 'Amount', 'Source', 'Reference', 'Status'];
      const payments = await Payment.find({ status: 'matched' })
        .populate('studentId', 'studentId name')
        .sort({ receivedAt: -1 })
        .limit(500);

      rows = payments.map(p => [
        p.receivedAt ? p.receivedAt.toISOString().slice(0, 10) : '',
        p.studentId?.studentId || '',
        p.studentId?.name || '',
        formatPaiseToRupees(p.amount),
        p.source,
        p.gatewayRef || '',
        p.status
      ]);
    } else if (type === 'unmatched_payments') {
      headers = ['Created Date', 'Payment Amount', 'Gateway Ref', 'Reason', 'Status', 'Resolved By'];
      const list = await UnmatchedPayment.find()
        .populate('paymentId')
        .populate('resolvedBy', 'phone')
        .sort({ createdAt: -1 });

      rows = list.map(u => [
        u.createdAt ? u.createdAt.toISOString().slice(0, 10) : '',
        u.paymentId ? formatPaiseToRupees(u.paymentId.amount) : '',
        u.paymentId?.gatewayRef || '',
        u.reason || '',
        u.status,
        u.resolvedBy?.phone || ''
      ]);
    } else if (type === 'refund_history') {
      headers = ['Created Date', 'Student ID', 'Student Name', 'Gross Refund', 'Base Refund', 'GST Refund', 'Deadline', 'Status'];
      const refunds = await Refund.find()
        .populate('studentId', 'studentId name')
        .sort({ createdAt: -1 });

      rows = refunds.map(r => [
        r.createdAt ? r.createdAt.toISOString().slice(0, 10) : '',
        r.studentId?.studentId || '',
        r.studentId?.name || '',
        r.breakdown ? formatPaiseToRupees(r.breakdown.refundTotal || 0) : '',
        r.breakdown ? formatPaiseToRupees(r.breakdown.refundBase || 0) : '',
        r.breakdown ? formatPaiseToRupees(r.breakdown.refundGst || 0) : '',
        r.deadline ? r.deadline.toISOString().slice(0, 10) : '',
        r.status
      ]);
    }

    const csvContent = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map(row => row.map(sanitizeCsvCell).join(','))
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

export default router;
