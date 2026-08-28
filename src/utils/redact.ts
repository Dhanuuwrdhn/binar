/** Replace values of sensitive headers (case-insensitive match) with "***". */
export function redactHeaders(
  headers: Record<string, string>,
  redactedNames: string[]
): Record<string, string> {
  const lower = new Set(redactedNames.map((h) => h.toLowerCase()));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = lower.has(k.toLowerCase()) ? '***' : v;
  }
  return out;
}

/**
 * Redact matching field values (case-insensitive, any nesting depth) in a
 * body that's about to be captured — headers only cover header-shaped
 * secrets, but a login/checkout request's password or card number lives in
 * the JSON body instead, and Binar makes captured bodies easy to share
 * (Copy/Share), so a stored plaintext password is one tap from leaving the
 * device.
 *
 * Only handles bodies that parse as JSON — request/response bodies aren't
 * always JSON, and guessing at other formats (form-urlencoded, plain text)
 * risks corrupting them for no reliable gain. Non-JSON and non-string
 * bodies (FormData, Blob, ArrayBuffer) pass through untouched; they're
 * already summarized elsewhere in toStoredBody.
 */
export function redactBodyFields(raw: unknown, fieldNames: string[]): unknown {
  if (fieldNames.length === 0) return raw;
  // Binar's own internal "body too large/binary to capture" marker (see
  // format.ts's SkippedBody) must pass through untouched — it isn't user
  // body data, and running it through JSON redaction could corrupt it if a
  // configured field name happens to collide with its `note`/`size` keys.
  if (raw !== null && typeof raw === 'object' && (raw as { binarSkipped?: unknown }).binarSkipped === true) {
    return raw;
  }
  const lower = new Set(fieldNames.map((f) => f.toLowerCase()));

  if (typeof raw === 'string') {
    const parsed = tryParseJson(raw);
    if (parsed === undefined) return raw;
    return JSON.stringify(redactDeep(parsed, lower));
  }
  if (isPlainJsonish(raw)) {
    return redactDeep(raw, lower);
  }
  return raw;
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function isPlainJsonish(raw: unknown): boolean {
  if (raw === null || typeof raw !== 'object') return false;
  if (Array.isArray(raw)) return true;
  if (typeof FormData !== 'undefined' && raw instanceof FormData) return false;
  if (typeof Blob !== 'undefined' && raw instanceof Blob) return false;
  if (raw instanceof ArrayBuffer) return false;
  return true;
}

function redactDeep(value: unknown, lowerFieldNames: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => redactDeep(v, lowerFieldNames));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = lowerFieldNames.has(k.toLowerCase()) ? '***' : redactDeep(v, lowerFieldNames);
    }
    return out;
  }
  return value;
}
