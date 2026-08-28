export interface StoredBody {
  body?: string;
  bodyTruncated?: boolean;
  size?: number;
}

/**
 * Passed instead of a raw body when the caller already decided not to
 * materialize it (e.g. a large or binary fetch response read via
 * Content-Length/Content-Type alone) but still knows its real size —
 * bypasses toStoredBody's usual stringify-then-measure path so that size
 * reflects the actual response, not the marker text.
 */
export interface SkippedBody {
  binarSkipped: true;
  note: string;
  size: number;
}

function isSkippedBody(raw: unknown): raw is SkippedBody {
  return typeof raw === 'object' && raw !== null && (raw as { binarSkipped?: unknown }).binarSkipped === true;
}

/** Normalize an arbitrary request/response body into a bounded string for storage. */
export function toStoredBody(raw: unknown, maxBodySize: number): StoredBody {
  if (raw === undefined || raw === null) return {};
  if (isSkippedBody(raw)) {
    return { body: raw.note, bodyTruncated: true, size: raw.size };
  }
  let text: string;
  if (typeof raw === 'string') {
    text = raw;
  } else if (typeof FormData !== 'undefined' && raw instanceof FormData) {
    text = '[FormData]';
  } else if (typeof Blob !== 'undefined' && raw instanceof Blob) {
    text = `[Blob ${raw.size} bytes]`;
  } else if (raw instanceof ArrayBuffer) {
    text = `[ArrayBuffer ${raw.byteLength} bytes]`;
  } else {
    try {
      text = JSON.stringify(raw);
    } catch {
      text = String(raw);
    }
  }
  const size = text.length;
  if (size > maxBodySize) {
    return {
      body: text.slice(0, maxBodySize) + `\n… [truncated, total ${size} chars]`,
      bodyTruncated: true,
      size,
    };
  }
  return { body: text, bodyTruncated: false, size };
}

const PLACEHOLDER_BODY_PATTERNS = [
  /^\[FormData\]$/,
  /^\[Blob \d+ bytes\]$/,
  /^\[ArrayBuffer \d+ bytes\]$/,
  /^\[response body too large to capture: .+\]$/,
  /^\[.+ response(, .+)?\]$/,
];

/**
 * True for one of Binar's own "body not captured verbatim" placeholders
 * (FormData/Blob/ArrayBuffer summaries above, or a SkippedBody marker) —
 * consumers that reconstruct the real request (e.g. the cURL exporter)
 * need to know not to treat this text as the actual body.
 */
export function isPlaceholderBody(body: string | undefined): boolean {
  if (!body) return false;
  return PLACEHOLDER_BODY_PATTERNS.some((p) => p.test(body));
}

export function prettyBody(body?: string): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export function formatSize(size?: number): string {
  if (size === undefined) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(ms?: number): string {
  if (ms === undefined) return '…';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Parse the string produced by XMLHttpRequest.getAllResponseHeaders(). */
export function parseRawHeaders(raw: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}
