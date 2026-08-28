import type { HttpCall } from '../types';

/** Quick status triage buckets for the call list — 'error' means a failed/aborted call, not an HTTP 4xx/5xx. */
export type StatusFilterValue = 'all' | '2xx' | '3xx' | '4xx' | '5xx' | 'error';

export const STATUS_FILTERS: StatusFilterValue[] = ['all', '2xx', '3xx', '4xx', '5xx', 'error'];

/** Case-insensitive substring match against method, URL, and screen — covers "find the /login calls" and "find everything on the Checkout screen". */
export function matchesQuery(call: HttpCall, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    call.url.toLowerCase().includes(q) ||
    call.method.toLowerCase().includes(q) ||
    (call.screen?.toLowerCase().includes(q) ?? false)
  );
}

export function matchesStatusFilter(call: HttpCall, filter: StatusFilterValue): boolean {
  if (filter === 'all') return true;
  if (filter === 'error') return call.state === 'error';
  if (call.state !== 'success' || call.response === undefined) return false;
  const s = call.response.status;
  if (filter === '2xx') return s >= 200 && s < 300;
  if (filter === '3xx') return s >= 300 && s < 400;
  if (filter === '4xx') return s >= 400 && s < 500;
  return s >= 500;
}

export function filterCalls(
  calls: HttpCall[],
  query: string,
  filter: StatusFilterValue
): HttpCall[] {
  return calls.filter((c) => matchesQuery(c, query) && matchesStatusFilter(c, filter));
}
