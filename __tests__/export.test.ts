import { callToText, callsToText } from '../src/utils/export';
import type { HttpCall } from '../src/types';

function call(over: Partial<HttpCall> = {}): HttpCall {
  return {
    id: '1',
    client: 'fetch',
    method: 'POST',
    url: 'https://api.example.com/input-calculation',
    screen: 'BusinessCalculationConfirm',
    startedAt: 1_700_000_000_000,
    durationMs: 219,
    state: 'success',
    request: {
      headers: { 'Content-Type': 'application/json', Authorization: '***' },
      body: '{"business_name":"Warmindo"}',
      size: 28,
    },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: '{"status":1,"data":{"irr":0.1701}}',
      size: 34,
    },
    ...over,
  };
}

describe('callToText', () => {
  it('carries the metadata, both header sets and both bodies', () => {
    const text = callToText(call());

    expect(text).toContain('POST https://api.example.com/input-calculation');
    expect(text).toContain('Status:        HTTP 200');
    expect(text).toContain('Screen:        /BusinessCalculationConfirm');
    expect(text).toContain('Duration:      219 ms');
    expect(text).toContain('REQUEST HEADERS');
    expect(text).toContain('Content-Type: application/json');
    expect(text).toContain('REQUEST BODY');
    expect(text).toContain('"business_name": "Warmindo"'); // pretty-printed
    expect(text).toContain('RESPONSE BODY');
    expect(text).toContain('"irr": 0.1701');
  });

  it('exports the body in full, not the window the screen renders', () => {
    const big = JSON.stringify({ items: Array.from({ length: 4000 }, (_, i) => i) });
    const text = callToText(call({ response: { status: 200, headers: {}, body: big } }));

    expect(big.length).toBeGreaterThan(50_000 / 4);
    expect(text).toContain('3999');
  });

  it('explains a redacted value rather than leaving *** unexplained', () => {
    expect(callToText(call())).toContain('redacted when the call was captured');
  });

  it('explains a redacted value found only in the body', () => {
    const bodyRedacted = call({
      request: { headers: { Accept: 'application/json' }, body: '{"password":"***"}' },
    });
    expect(callToText(bodyRedacted)).toContain('redacted when the call was captured');
  });

  it('does not claim redaction when nothing was redacted', () => {
    const clean = call({ request: { headers: { Accept: 'application/json' } } });
    expect(callToText(clean)).not.toContain('redacted when the call was captured');
  });

  it('reports a failure instead of an empty response section', () => {
    const failed = call({ state: 'error', response: undefined, error: { message: 'Network request failed' } });
    const text = callToText(failed);

    expect(text).toContain('failed — Network request failed');
    expect(text).toContain('ERROR');
    expect(text).not.toContain('RESPONSE BODY');
  });

  it('says a call is still in flight', () => {
    const pending = call({ state: 'pending', response: undefined, durationMs: undefined });
    expect(callToText(pending)).toContain('still pending');
  });

  it('flags a body truncated at capture time', () => {
    const truncated = call({
      response: { status: 200, headers: {}, body: 'x', bodyTruncated: true },
    });
    expect(callToText(truncated)).toContain('truncated at capture time');
  });
});

describe('callsToText', () => {
  it('numbers every call and orders them oldest first', () => {
    const text = callsToText([
      call({ id: '2', startedAt: 2000, url: 'https://api.example.com/second' }),
      call({ id: '1', startedAt: 1000, url: 'https://api.example.com/first' }),
    ]);

    expect(text).toContain('Binar — 2 HTTP calls');
    expect(text.indexOf('/first')).toBeLessThan(text.indexOf('/second'));
    expect(text).toContain('═══ 1/2 ═══');
    expect(text).toContain('═══ 2/2 ═══');
  });

  it('does not leave the share sheet with an empty message', () => {
    expect(callsToText([])).toBe('No HTTP calls captured.');
  });
});
