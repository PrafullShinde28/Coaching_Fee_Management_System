const DAY_MS = 86_400_000;

export function dateOnly(value) {
  if (value instanceof Date) return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Invalid date');
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Derived instalment state. All monetary values are integer paise. */
export function calculateInstalmentStatus(instalment, now) {
  const amount = Math.max(0, Math.trunc(instalment.amount));
  const discount = Math.max(0, Math.trunc(instalment.discount ?? 0));
  const paid = Math.max(0, Math.trunc(instalment.paid ?? 0));
  const outstanding = Math.max(0, amount - discount - paid);
  const daysFromDue = Math.floor((dateOnly(now) - dateOnly(instalment.dueDate)) / DAY_MS);
  let status;
  if (outstanding === 0) status = 'paid';
  else if (paid > 0) status = 'part_paid';
  else if (daysFromDue > 0) status = 'overdue';
  else if (daysFromDue >= -7) status = 'due_soon';
  else status = 'upcoming';
  return { outstanding, status, daysOverdue: outstanding > 0 ? Math.max(0, daysFromDue) : 0 };
}
