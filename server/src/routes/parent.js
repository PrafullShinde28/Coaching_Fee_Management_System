import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Student, FeePlan, Instalment, Payment, Receipt } from '../models/index.js';
import { calculateInstalmentStatus } from '../domain/instalment.js';
import { paymentGateway } from '../services/paymentGateway.js';
import { clock } from '../config/clock.js';

const router = Router();

router.use(requireAuth, requireRole('parent'));

const objectIdSchema = z.string().refine(val => mongoose.isValidObjectId(val), {
  message: 'Invalid ID format'
});

/**
 * Helper to ensure a student belongs to the authenticated parent.
 */
async function verifyParentStudentAccess(studentId, parentUserId) {
  if (!mongoose.isValidObjectId(studentId)) {
    const err = new Error('Invalid student ID');
    err.status = 400;
    throw err;
  }
  const student = await Student.findById(studentId).populate('centreId batchId');
  if (!student) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }
  if (String(student.parentUserId) !== String(parentUserId)) {
    const err = new Error('You cannot access this student');
    err.status = 403;
    throw err;
  }
  return student;
}

// 1. List authenticated parent's children
router.get('/children', async (req, res, next) => {
  try {
    const children = await Student.find({ parentUserId: req.user._id })
      .populate('centreId batchId')
      .sort({ name: 1 });

    const results = await Promise.all(
      children.map(async child => {
        const feePlan = await FeePlan.findOne({ studentId: child._id });
        const instalments = await Instalment.find({ studentId: child._id }).sort({ dueDate: 1 });
        const derived = instalments.map(i => calculateInstalmentStatus(i, clock.today()));
        const totalOutstanding = derived.reduce((sum, d) => sum + d.outstanding, 0);
        const totalPaid = instalments.reduce((sum, i) => sum + (i.paid || 0), 0);

        return {
          id: child._id,
          studentId: child.studentId,
          name: child.name,
          status: child.status,
          centre: child.centreId,
          batch: child.batchId,
          feeSummary: {
            total: feePlan?.total || 0,
            paid: totalPaid,
            outstanding: totalOutstanding
          }
        };
      })
    );

    res.json({ ok: true, children: results });
  } catch (err) {
    next(err);
  }
});

// 2. Retrieve child's fee ledger, instalments, and derived statuses
router.get('/students/:studentId/ledger', async (req, res, next) => {
  try {
    const { studentId } = z.object({ studentId: objectIdSchema }).parse(req.params);
    const student = await verifyParentStudentAccess(studentId, req.user._id);

    const feePlan = await FeePlan.findOne({ studentId: student._id });
    const instalments = await Instalment.find({ studentId: student._id }).sort({ seq: 1 });

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
      student: {
        id: student._id,
        studentId: student.studentId,
        name: student.name,
        status: student.status,
        centre: student.centreId,
        batch: student.batchId
      },
      feePlan,
      instalments: enrichedInstalments,
      summary: {
        total: feePlan?.total || 0,
        paid: totalPaid,
        outstanding: totalOutstanding
      }
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// 3. Retrieve payment history for child
router.get('/students/:studentId/payments', async (req, res, next) => {
  try {
    const { studentId } = z.object({ studentId: objectIdSchema }).parse(req.params);
    const student = await verifyParentStudentAccess(studentId, req.user._id);

    const payments = await Payment.find({
      studentId: student._id,
      status: { $in: ['matched', 'reversed'] }
    })
      .populate('instalmentId', 'seq dueDate amount')
      .sort({ receivedAt: -1 });

    res.json({ ok: true, payments });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// 4. Retrieve GST receipts for child's payments
router.get('/students/:studentId/receipts', async (req, res, next) => {
  try {
    const { studentId } = z.object({ studentId: objectIdSchema }).parse(req.params);
    const student = await verifyParentStudentAccess(studentId, req.user._id);

    const payments = await Payment.find({ studentId: student._id, status: 'matched' }).select('_id');
    const paymentIds = payments.map(p => p._id);

    const receipts = await Receipt.find({ paymentId: { $in: paymentIds } })
      .populate('paymentId', 'amount receivedAt gatewayRef source')
      .sort({ createdAt: -1 });

    res.json({ ok: true, receipts });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// 5. Generate / retrieve payment link for eligible outstanding instalment
router.post('/instalments/:instalmentId/payment-link', async (req, res, next) => {
  try {
    const { instalmentId } = z.object({ instalmentId: objectIdSchema }).parse(req.params);

    const instalment = await Instalment.findById(instalmentId).populate('studentId');
    if (!instalment) {
      return res.status(404).json({ error: 'Instalment not found' });
    }

    if (!instalment.studentId || String(instalment.studentId.parentUserId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'You cannot access this instalment' });
    }

    const derived = calculateInstalmentStatus(instalment, clock.today());
    if (derived.outstanding <= 0) {
      return res.status(400).json({ error: 'Instalment is already fully paid' });
    }

    const link = await paymentGateway.createPaymentLink({
      instalmentId: instalment._id,
      studentId: instalment.studentId._id,
      amount: derived.outstanding,
      paymentLinkToken: instalment.paymentLinkToken
    });

    res.json({ ok: true, paymentLink: link });
  } catch (err) {
    next(err);
  }
});

export default router;
