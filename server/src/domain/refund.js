import { dateOnly } from './instalment.js';
const DAY_MS = 86_400_000;
const MAX_PROCESSING_FEE_PAISE = 500_000; // ₹5,000
const PROCESSING_RATE_BPS = 500; // 5%
const roundDiv = (numerator, denominator) => Math.floor((numerator + Math.floor(denominator / 2)) / denominator);

/** Assumption: refund = max(0, paid - usedShare - processingFee). */
export function calculateProRataRefund({ totalFee, paid, daysUsed, termDays, gstRatePct = 18, discount = 0, leftOn }) {
  if (!Number.isSafeInteger(termDays) || termDays <= 0) throw new RangeError('termDays must be a positive integer');
  for (const [name, value] of Object.entries({ totalFee, paid, daysUsed, termDays, discount })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer in paise/days`);
  }
  if (!Number.isFinite(gstRatePct) || gstRatePct < 0 || gstRatePct > 100) throw new RangeError('Invalid GST rate');
  const clampedDaysUsed = Math.min(daysUsed, termDays);
  const feeAfterDiscount = Math.max(0, totalFee - discount);
  const usedShare = Math.min(feeAfterDiscount, roundDiv(feeAfterDiscount * clampedDaysUsed, termDays));
  const processingFee = Math.min(roundDiv(totalFee * PROCESSING_RATE_BPS, 10_000), MAX_PROCESSING_FEE_PAISE);
  const grossRefund = Math.max(0, paid - usedShare - processingFee);
  const refundGst = roundDiv(grossRefund * gstRatePct, 100 + gstRatePct);
  const refundBase = grossRefund - refundGst;
  const deadline = leftOn ? new Date(dateOnly(leftOn) + 10 * DAY_MS).toISOString().slice(0, 10) : null;
  return { assumptions: 'refund-assumption-v1', totalFee, discount, feeAfterDiscount, paid, daysUsed: clampedDaysUsed, termDays, usedShare, processingFee, grossRefund, refundBase, refundGst, refundTotal: grossRefund, deadline };
}
