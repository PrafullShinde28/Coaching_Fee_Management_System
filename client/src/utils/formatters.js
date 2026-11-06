/**
 * Formats integer paise into Indian Rupee currency string.
 * Example: 3000000 -> "₹30,000" or 1500050 -> "₹15,000.50"
 */
export function formatInr(paise = 0) {
  if (typeof paise !== 'number' || isNaN(paise)) return '₹0';
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2
  }).format(rupees);
}

/**
 * Formats a Date object or ISO string to a human-readable Indian English date.
 * Example: "2026-10-10" -> "10 Oct 2026"
 */
export function formatDate(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (_e) {
    return '—';
  }
}

/**
 * Formats an international phone number for clean display.
 * Example: "+919900000041" -> "+91 99000 00041"
 */
export function formatPhone(phone = '') {
  if (!phone) return '';
  const clean = String(phone).trim();
  if (clean.startsWith('+91') && clean.length === 13) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`;
  }
  return clean;
}
