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
  RiskFlag
} from '../models/index.js';
import { calculateInstalmentStatus } from '../domain/instalment.js';
import { planPaymentAllocation } from '../domain/payment-allocation.js';
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

const router = Router();

router.use(requireAuth, requireRole('accounts'));

const objectIdSchema = z.string().refine(val => mongoose.isValidObjectId(val), {
  message: 'Invalid ID format'
});

// 1. Dashboard summary
router.get('/dashboard', async (_req, res, next) => {
  try {
    const today = clock.today();

    const [
      totalStudents,
      activeStudents,
      leftStudents,
      feePlans,
      instalments,
      matchedPayments,
      openUnmatched
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ status: 'active' }),
      Student.countDocuments({ status: 'left' }),
      FeePlan.find().select('total'),
      Instalment.find(),
      Payment.find({ status: 'matched' }).sort({ receivedAt: -1 }),
      UnmatchedPayment.find({ status: 'open' }).populate('paymentId')
    ]);

    const totalExpectedFee = feePlans.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalCollected = matchedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    let totalOverdue = 0;
    let overdueCount = 0;
    for (const inst of instalments) {
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

    res.json({
      ok: true,
      summary: {
        totalStudents,
        activeStudents,
        leftStudents,
        totalExpectedFee,
        totalCollected,
        totalOutstanding: Math.max(0, totalExpectedFee - totalCollected),
        totalOverdue,
        overdueCount,
        unmatchedCount: openUnmatched.length,
        unmatchedTotal
      },
      recentPayments: matchedPayments.slice(0, 10)
    });
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

export default router;
