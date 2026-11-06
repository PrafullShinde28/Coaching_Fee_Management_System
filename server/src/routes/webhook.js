import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Payment, UnmatchedPayment, Student, Instalment } from '../models/index.js';
import { planPaymentAllocation } from '../domain/payment-allocation.js';
import { paymentGateway } from '../services/paymentGateway.js';
import { generateReceiptForPayment } from '../services/receipt.js';
import { cancelPendingRemindersForInstalment } from '../services/reminderService.js';
import { clock } from '../config/clock.js';

const router = Router();

const webhookPayloadSchema = z.object({
  event: z.enum(['payment.success', 'payment.failed']),
  gatewayRef: z.string().min(1),
  amount: z.number().int().positive(),
  studentId: z.string().optional().nullable(),
  instalmentId: z.string().optional().nullable(),
  receivedAt: z.string().optional().nullable(),
  failureReason: z.string().optional().nullable()
});

async function runWithTransaction(workFn) {
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      session.startTransaction();
      result = await workFn(session);
      await session.commitTransaction();
      return result;
    } catch (txErr) {
      if (
        txErr.message?.includes('Transactions are not supported') ||
        txErr.message?.includes('replica set') ||
        txErr.code === 20
      ) {
        await session.abortTransaction().catch(() => {});
        return await workFn(null);
      }
      await session.abortTransaction().catch(() => {});
      throw txErr;
    }
  } finally {
    await session.endSession();
  }
}

router.post('/payment', async (req, res, next) => {
  try {
    const signature =
      req.headers['x-webhook-signature'] ||
      req.headers['x-gateway-signature'] ||
      req.headers['x-signature'];

    const isValid = paymentGateway.verifyWebhookSignature({
      rawBody: req.rawBody,
      signature
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or missing webhook signature' });
    }

    const payload = webhookPayloadSchema.parse(req.body);

    const existingPayment = await Payment.findOne({ gatewayRef: payload.gatewayRef });
    if (existingPayment) {
      return res.json({
        ok: true,
        duplicate: true,
        paymentId: existingPayment._id,
        status: existingPayment.status
      });
    }

    const receivedAtDate = payload.receivedAt ? new Date(payload.receivedAt) : clock.now();

    if (payload.event === 'payment.failed') {
      const payment = await Payment.create({
        studentId: payload.studentId && mongoose.isValidObjectId(payload.studentId) ? payload.studentId : null,
        instalmentId: payload.instalmentId && mongoose.isValidObjectId(payload.instalmentId) ? payload.instalmentId : null,
        amount: payload.amount,
        source: 'gateway',
        gatewayRef: payload.gatewayRef,
        status: 'reversed',
        receivedAt: receivedAtDate
      });

      return res.json({
        ok: true,
        status: 'failed',
        paymentId: payment._id,
        reason: payload.failureReason || 'Gateway payment failure reported'
      });
    }

    // Success event
    const result = await runWithTransaction(async session => {
      let student = null;
      if (payload.studentId && mongoose.isValidObjectId(payload.studentId)) {
        student = await Student.findById(payload.studentId).session(session);
      }

      if (!student) {
        const [unmatchedPay] = await Payment.create(
          [
            {
              studentId: null,
              instalmentId: null,
              amount: payload.amount,
              source: 'gateway',
              gatewayRef: payload.gatewayRef,
              status: 'unmatched',
              receivedAt: receivedAtDate
            }
          ],
          session ? { session } : {}
        );

        await UnmatchedPayment.create(
          [
            {
              paymentId: unmatchedPay._id,
              reason: 'No matching student found in gateway payload'
            }
          ],
          session ? { session } : {}
        );

        return { status: 'unmatched', paymentId: unmatchedPay._id };
      }

      const instalments = await Instalment.find({ studentId: student._id })
        .session(session)
        .sort({ dueDate: 1, seq: 1 });

      let plan;
      try {
        plan = planPaymentAllocation({
          payment: {
            amount: payload.amount,
            gatewayRef: payload.gatewayRef,
            studentId: String(student._id),
            instalmentId: payload.instalmentId ? String(payload.instalmentId) : null
          },
          instalments
        });
      } catch (err) {
        // Cross-student or validation failure in allocation planner
        const [unmatchedPay] = await Payment.create(
          [
            {
              studentId: student._id,
              instalmentId: null,
              amount: payload.amount,
              source: 'gateway',
              gatewayRef: payload.gatewayRef,
              status: 'unmatched',
              receivedAt: receivedAtDate
            }
          ],
          session ? { session } : {}
        );

        await UnmatchedPayment.create(
          [
            {
              paymentId: unmatchedPay._id,
              reason: err.message || 'Instalment allocation validation failed'
            }
          ],
          session ? { session } : {}
        );

        return { status: 'unmatched', paymentId: unmatchedPay._id, reason: err.message };
      }

      if (plan.unmatched || plan.allocations.length === 0) {
        const [unmatchedPay] = await Payment.create(
          [
            {
              studentId: student._id,
              instalmentId: payload.instalmentId || null,
              amount: payload.amount,
              source: 'gateway',
              gatewayRef: payload.gatewayRef,
              status: 'unmatched',
              receivedAt: receivedAtDate
            }
          ],
          session ? { session } : {}
        );

        await UnmatchedPayment.create(
          [
            {
              paymentId: unmatchedPay._id,
              reason: 'Payment could not be allocated to eligible instalments'
            }
          ],
          session ? { session } : {}
        );

        return { status: 'unmatched', paymentId: unmatchedPay._id };
      }

      // Record matched payment
      const primaryInstalmentId = payload.instalmentId || plan.allocations[0].instalmentId;
      const [matchedPayment] = await Payment.create(
        [
          {
            studentId: student._id,
            instalmentId: primaryInstalmentId,
            amount: payload.amount,
            source: 'gateway',
            gatewayRef: payload.gatewayRef,
            status: 'matched',
            receivedAt: receivedAtDate
          }
        ],
        session ? { session } : {}
      );

      // Apply allocations to instalments
      for (const alloc of plan.allocations) {
        const updated = await Instalment.findByIdAndUpdate(
          alloc.instalmentId,
          { $inc: { paid: alloc.amount } },
          { new: true, ...(session ? { session } : {}) }
        );
        if (updated && (updated.paid + (updated.discount || 0)) >= updated.amount) {
          await cancelPendingRemindersForInstalment(updated._id);
        }
      }

      // Generate sequential GST receipt
      const receipt = await generateReceiptForPayment(matchedPayment._id, payload.amount, session);

      return {
        status: 'matched',
        paymentId: matchedPayment._id,
        receiptNumber: receipt.number,
        allocations: plan.allocations,
        unallocated: plan.unallocated
      };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
