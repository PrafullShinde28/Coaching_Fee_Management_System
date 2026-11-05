/** Pure allocation planner; persist transactionally and enforce unique gatewayRef in storage. */
export function planPaymentAllocation({ payment, instalments, existingGatewayRefs = [] }) {
  if (!payment || !Number.isSafeInteger(payment.amount) || payment.amount <= 0) throw new TypeError('Payment amount must be a positive integer number of paise');
  if (!payment.gatewayRef || typeof payment.gatewayRef !== 'string') throw new TypeError('gatewayRef is required');
  if (existingGatewayRefs.includes(payment.gatewayRef)) return { duplicate: true, unmatched: false, allocations: [], unallocated: payment.amount };
  const ordered = [...instalments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() || (a.seq ?? 0) - (b.seq ?? 0));
  if (payment.studentId && ordered.some(i => String(i.studentId) !== String(payment.studentId))) throw new TypeError('All instalments must belong to the payment student');
  const target = payment.instalmentId ? ordered.filter(i => String(i._id) === String(payment.instalmentId)) : ordered;
  if (payment.instalmentId && target.length === 0) return { duplicate: false, unmatched: true, allocations: [], unallocated: payment.amount };
  let remaining = payment.amount;
  const allocations = [];
  for (const item of target) {
    if (remaining <= 0) break;
    const balance = Math.max(0, Math.trunc(item.amount) - Math.trunc(item.discount ?? 0) - Math.trunc(item.paid ?? 0));
    if (!balance) continue;
    const applied = Math.min(balance, remaining);
    allocations.push({ instalmentId: String(item._id), amount: applied });
    remaining -= applied;
    if (payment.instalmentId) break;
  }
  return { duplicate: false, unmatched: allocations.length === 0, allocations, unallocated: remaining };
}
