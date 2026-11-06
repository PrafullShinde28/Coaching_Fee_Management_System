/**
 * OWASP-compliant CSV cell sanitizer that prevents CSV Formula Injection
 * (also known as Spreadsheet Formula Injection or DDE attacks).
 *
 * Handles:
 * - null / undefined -> empty string ''
 * - Null bytes (\0) -> stripped
 * - Leading whitespace (spaces, tabs, newlines, carriage returns) before triggers
 * - Formula trigger characters: =, +, -, @, |, %
 * - Leading control characters: \t, \r, \n
 * - RFC-4180 escaping for commas, quotes, and newlines
 */
export function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '';

  let str = String(val);

  // 1. Strip null bytes
  str = str.replace(/\0/g, '');

  // 2. Check for formula injection triggers, including after any leading whitespace or control characters
  // Trigger characters: =, +, -, @, |, %
  const strippedLeading = str.replace(/^[\s\x00-\x1f\x7f-\x9f]+/, '');
  const hasTrigger = /^[=+\-@|%]/.test(strippedLeading);
  const startsWithControl = /^[\t\r\n]/.test(str);

  if (hasTrigger || startsWithControl) {
    // Prefix with single quote (') to force spreadsheet software to treat as plain text
    str = `'${str}`;
  }

  // 3. RFC-4180 escaping: if field contains commas, double-quotes, or newlines, wrap in quotes and escape internal quotes
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}
