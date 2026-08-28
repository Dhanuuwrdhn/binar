/**
 * Shared visual tokens for Binar's screens (bubble, call list, call detail).
 * Pure constants — no styling library, RN StyleSheet consumes these directly.
 * Centralizing these (previously duplicated ad hoc per file) is what makes
 * the three screens read as one consistent UI instead of three plain ones.
 */

export const colors = {
  accent: '#1565c0',
  accentSoft: 'rgba(21, 101, 192, 0.85)',
  danger: '#e53935',
  warning: '#fb8c00',
  info: '#8e24aa',
  success: '#43a047',
  pending: '#9e9e9e',
  text: '#222',
  textMuted: '#888',
  textFaint: '#999',
  border: '#ddd',
  borderFaint: '#eee',
  surface: '#fff',
  surfaceMuted: '#f2f2f2',
  surfaceCode: '#f6f6f6',
};

/** HTTP status → color, the single source of truth reused by the list row, its accent bar, and the detail screen's status banner. */
export function statusColor(state: 'pending' | 'success' | 'error', httpStatus?: number): string {
  if (state === 'pending') return colors.pending;
  if (state === 'error') return colors.danger;
  const s = httpStatus ?? 0;
  if (s >= 500) return colors.danger;
  if (s >= 400) return colors.warning;
  if (s >= 300) return colors.info;
  return colors.success;
}

/** A small fixed palette so method tags are scannable at a glance, Postman/Insomnia-style. */
const METHOD_COLORS: Record<string, string> = {
  GET: '#1565c0',
  POST: '#2e7d32',
  PUT: '#ef6c00',
  PATCH: '#ef6c00',
  DELETE: '#c62828',
};

export function methodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] ?? colors.textMuted;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
