/** Next shot designation on a slate: A → B, Z → AA, 3 → 4, 2B → 2C, blank → A. */
export function nextShotId(current: string): string {
  const s = current.trim().toUpperCase();
  if (!s) return 'A';
  const letters = s.match(/^(.*?)([A-Z]+)$/);
  if (letters) {
    const [, prefix, tail] = letters;
    const last = tail.charCodeAt(tail.length - 1);
    return last >= 90 ? `${prefix}${tail}A` : `${prefix}${tail.slice(0, -1)}${String.fromCharCode(last + 1)}`;
  }
  const digits = s.match(/^(.*?)(\d+)$/);
  if (digits) return `${digits[1]}${Number(digits[2]) + 1}`;
  return `${s}A`;
}
