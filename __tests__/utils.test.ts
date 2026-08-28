import { redactHeaders, redactBodyFields } from '../src/utils/redact';
import { toStoredBody, parseRawHeaders, prettyBody } from '../src/utils/format';
import { DEFAULT_REDACTED_HEADERS, DEFAULT_REDACTED_BODY_FIELDS, resolveConfig } from '../src/types';

describe('redactHeaders', () => {
  it('redacts sensitive headers case-insensitively', () => {
    const out = redactHeaders(
      { Authorization: 'Bearer secret', 'Content-Type': 'application/json', COOKIE: 'sid=1' },
      DEFAULT_REDACTED_HEADERS
    );
    expect(out.Authorization).toBe('***');
    expect(out.COOKIE).toBe('***');
    expect(out['Content-Type']).toBe('application/json');
  });
});

describe('redactBodyFields', () => {
  it('redacts matching fields in a JSON string body, case-insensitively', () => {
    const raw = JSON.stringify({ email: 'a@b.com', PASSWORD: 'hunter2' });
    const out = redactBodyFields(raw, DEFAULT_REDACTED_BODY_FIELDS) as string;
    expect(JSON.parse(out)).toEqual({ email: 'a@b.com', PASSWORD: '***' });
  });

  it('redacts nested fields inside objects and arrays', () => {
    const raw = JSON.stringify({
      user: { name: 'Budi', token: 'abc.def.ghi' },
      cards: [{ card_number: '4111111111111111', last4: '1111' }],
    });
    const out = JSON.parse(redactBodyFields(raw, DEFAULT_REDACTED_BODY_FIELDS) as string);
    expect(out.user).toEqual({ name: 'Budi', token: '***' });
    expect(out.cards[0]).toEqual({ card_number: '***', last4: '1111' });
  });

  it('redacts a plain (already-parsed) object the same way as a JSON string', () => {
    const out = redactBodyFields({ secret: 'x', ok: true }, DEFAULT_REDACTED_BODY_FIELDS);
    expect(out).toEqual({ secret: '***', ok: true });
  });

  it('respects a caller-supplied field list instead of the default', () => {
    const raw = JSON.stringify({ password: 'plain', ktp_number: '3201xxxx' });
    const out = JSON.parse(redactBodyFields(raw, ['ktp_number']) as string);
    expect(out).toEqual({ password: 'plain', ktp_number: '***' });
  });

  it('leaves non-JSON strings untouched rather than risk corrupting them', () => {
    const raw = 'password=hunter2&ok=true';
    expect(redactBodyFields(raw, DEFAULT_REDACTED_BODY_FIELDS)).toBe(raw);
  });

  it('leaves FormData/Blob/ArrayBuffer bodies untouched', () => {
    expect(redactBodyFields(new ArrayBuffer(4), DEFAULT_REDACTED_BODY_FIELDS)).toBeInstanceOf(
      ArrayBuffer
    );
  });

  it('passes a SkippedBody marker through untouched even if a field name collides', () => {
    const marker = { binarSkipped: true, note: '[image/png response, 2.0 KB]', size: 2048 };
    expect(redactBodyFields(marker, ['note', 'size'])).toBe(marker);
  });

  it('is a no-op when the field list is empty', () => {
    const raw = JSON.stringify({ password: 'plain' });
    expect(redactBodyFields(raw, [])).toBe(raw);
  });
});

describe('toStoredBody', () => {
  it('passes small strings through', () => {
    expect(toStoredBody('hello', 100)).toEqual({ body: 'hello', bodyTruncated: false, size: 5 });
  });

  it('truncates bodies beyond maxBodySize and flags it', () => {
    const out = toStoredBody('x'.repeat(50), 10);
    expect(out.bodyTruncated).toBe(true);
    expect(out.size).toBe(50);
    expect(out.body!.startsWith('xxxxxxxxxx')).toBe(true);
    expect(out.body).toContain('[truncated');
  });

  it('handles null/undefined and non-string values', () => {
    expect(toStoredBody(undefined, 100)).toEqual({});
    expect(toStoredBody({ a: 1 }, 100).body).toBe('{"a":1}');
    expect(toStoredBody(new ArrayBuffer(8), 100).body).toBe('[ArrayBuffer 8 bytes]');
  });

  it('passes a SkippedBody marker through using its own reported size', () => {
    const out = toStoredBody(
      { binarSkipped: true, note: '[image/png response, 2.3 MB]', size: 2_411_724 },
      100
    );
    expect(out).toEqual({
      body: '[image/png response, 2.3 MB]',
      bodyTruncated: true,
      size: 2_411_724,
    });
  });
});

describe('parseRawHeaders', () => {
  it('parses getAllResponseHeaders output', () => {
    const raw = 'content-type: application/json\r\nx-request-id: abc\r\n';
    expect(parseRawHeaders(raw)).toEqual({
      'content-type': 'application/json',
      'x-request-id': 'abc',
    });
  });

  it('handles empty input', () => {
    expect(parseRawHeaders(null)).toEqual({});
  });
});

describe('prettyBody', () => {
  it('pretty-prints JSON and passes non-JSON through', () => {
    expect(prettyBody('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyBody('plain text')).toBe('plain text');
  });
});

describe('resolveConfig', () => {
  it('applies documented defaults', () => {
    const c = resolveConfig({ enabled: true });
    expect(c.showNotification).toBe(true);
    expect(c.maxCallsCount).toBe(1000);
    expect(c.maxBodySize).toBe(1_000_000);
    expect(c.redactedHeaders).toEqual(['authorization', 'cookie', 'set-cookie']);
    expect(c.redactedBodyFields).toEqual(DEFAULT_REDACTED_BODY_FIELDS);
  });
});
