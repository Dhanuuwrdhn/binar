import { callToCurl } from '../src/utils/curl';
import type { HttpCall } from '../src/types';

function call(over: Partial<HttpCall> = {}): HttpCall {
  return {
    id: '1',
    client: 'fetch',
    method: 'GET',
    url: 'https://api.example.com/users',
    startedAt: 0,
    state: 'success',
    request: { headers: {} },
    response: { status: 200, headers: {} },
    ...over,
  };
}

describe('callToCurl', () => {
  it('builds a runnable curl command with method, URL and headers', () => {
    const c = call({
      method: 'POST',
      url: 'https://api.dev/items',
      request: { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } },
    });
    const out = callToCurl(c);
    expect(out).toContain(`curl -X POST 'https://api.dev/items'`);
    expect(out).toContain(`-H 'Content-Type: application/json'`);
    expect(out).toContain(`-H 'Accept: application/json'`);
  });

  it('includes the request body as --data-raw', () => {
    const c = call({
      method: 'POST',
      request: { headers: {}, body: '{"name":"a"}' },
    });
    expect(callToCurl(c)).toContain(`--data-raw '{"name":"a"}'`);
  });

  it('escapes embedded single quotes so the command stays valid shell', () => {
    const c = call({ method: 'POST', request: { headers: {}, body: `{"name":"O'Brien"}` } });
    const out = callToCurl(c);
    expect(out).toContain(`--data-raw '{"name":"O'\\''Brien"}'`);
  });

  it('omits headers curl derives itself (content-length, host, connection, trace marker)', () => {
    const c = call({
      request: {
        headers: {
          'Content-Length': '12',
          Host: 'api.dev',
          Connection: 'keep-alive',
          'x-binar-trace': 'a:1',
          Accept: 'application/json',
        },
      },
    });
    const out = callToCurl(c);
    expect(out).not.toContain('Content-Length');
    expect(out).not.toContain('Host');
    expect(out).not.toContain('Connection');
    expect(out).not.toContain('x-binar-trace');
    expect(out).toContain('Accept');
  });

  it('flags a redacted header with a comment instead of silently shipping ***', () => {
    const c = call({ request: { headers: { Authorization: '***' } } });
    const out = callToCurl(c);
    expect(out).toContain('# Redacted values shown as *** need the real value filled in.');
    expect(out).toContain(`-H 'Authorization: ***'`);
  });

  it('flags a redacted body field the same way', () => {
    const c = call({ method: 'POST', request: { headers: {}, body: '{"password":"***"}' } });
    expect(callToCurl(c)).toContain('# Redacted values shown as *** need the real value filled in.');
  });

  it('does not emit --data-raw for a placeholder body, and explains why', () => {
    const c = call({ method: 'POST', request: { headers: {}, body: '[FormData]' } });
    const out = callToCurl(c);
    expect(out).not.toContain('--data-raw');
    expect(out).toContain('Original body was not captured verbatim ([FormData])');
  });

  it('adds no notes section when nothing was redacted or placeholder', () => {
    const c = call({ request: { headers: { Accept: 'application/json' } } });
    expect(callToCurl(c)).not.toContain('#');
  });
});
