import { Receipt, Counter } from '../models/index.js';
import { clock } from '../config/clock.js';

/**
 * Calculate base and GST from GST-inclusive amount in integer paise.
 * Established project rule: GST is 18%, gst = Math.round(amount * 18 / 118).
 * Base = amount - gst, ensuring base + gst === amount exactly.
 */
export function calculateGst(amountPaise, gstRatePct = 18) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new TypeError('Payment amount must be a positive integer in paise');
  }
  const gst = Math.round((amountPaise * gstRatePct) / (100 + gstRatePct));
  const base = amountPaise - gst;
  return { base, gst, total: amountPaise };
}

/**
 * Generate an atomic, monotonically increasing receipt number.
 * Format: RCP-YYYY-XXXXXX
 */
export async function getNextReceiptNumber(year = new Date(clock.today()).getFullYear()) {
  const counter = await Counter.findByIdAndUpdate(
    `receipt_${year}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `RCP-${year}-${String(counter.seq).padStart(6, '0')}`;
}

/**
 * Generate a GST receipt for a successfully matched payment.
 * Idempotent: If a receipt for paymentId already exists, returns it without creating a duplicate.
 */
export async function generateReceiptForPayment(paymentId, amountPaise, session = null) {
  const existing = await Receipt.findOne({ paymentId }).session(session);
  if (existing) {
    return existing;
  }

  const { base, gst, total } = calculateGst(amountPaise);
  const number = await getNextReceiptNumber();

  const [receipt] = await Receipt.create(
    [{ number, base, gst, total, paymentId }],
    session ? { session } : {}
  );
  return receipt;
}
