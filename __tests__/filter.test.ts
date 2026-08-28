import { matchesQuery, matchesStatusFilter, filterCalls } from '../src/utils/filter';
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

describe('matchesQuery', () => {
  it('matches on URL, method, or screen, case-insensitively', () => {
    const c = call({ method: 'POST', url: 'https://api.dev/Login', screen: 'SignInScreen' });
    expect(matchesQuery(c, 'login')).toBe(true);
    expect(matchesQuery(c, 'POST')).toBe(true);
    expect(matchesQuery(c, 'signin')).toBe(true);
    expect(matchesQuery(c, 'logout')).toBe(false);
  });

  it('an empty or whitespace-only query matches everything', () => {
    const c = call();
    expect(matchesQuery(c, '')).toBe(true);
    expect(matchesQuery(c, '   ')).toBe(true);
  });

  it('does not throw when screen is unset', () => {
    const c = call({ screen: undefined });
    expect(matchesQuery(c, 'anything')).toBe(false);
  });
});

describe('matchesStatusFilter', () => {
  it('buckets 2xx/3xx/4xx/5xx by response status', () => {
    expect(matchesStatusFilter(call({ response: { status: 204, headers: {} } }), '2xx')).toBe(true);
    expect(matchesStatusFilter(call({ response: { status: 301, headers: {} } }), '3xx')).toBe(true);
    expect(matchesStatusFilter(call({ response: { status: 404, headers: {} } }), '4xx')).toBe(true);
    expect(matchesStatusFilter(call({ response: { status: 503, headers: {} } }), '5xx')).toBe(true);
    expect(matchesStatusFilter(call({ response: { status: 404, headers: {} } }), '2xx')).toBe(false);
  });

  it('"error" matches failed calls, not HTTP error statuses', () => {
    const failed = call({ state: 'error', response: undefined, error: { message: 'x' } });
    expect(matchesStatusFilter(failed, 'error')).toBe(true);
    expect(matchesStatusFilter(call({ response: { status: 500, headers: {} } }), 'error')).toBe(false);
  });

  it('a pending call matches nothing but "all"', () => {
    const pending = call({ state: 'pending', response: undefined });
    expect(matchesStatusFilter(pending, 'all')).toBe(true);
    expect(matchesStatusFilter(pending, '2xx')).toBe(false);
    expect(matchesStatusFilter(pending, 'error')).toBe(false);
  });

  it('"all" matches everything', () => {
    expect(matchesStatusFilter(call(), 'all')).toBe(true);
  });
});

describe('filterCalls', () => {
  it('applies both the query and the status filter together', () => {
    const calls = [
      call({ id: 'a', url: 'https://api.dev/login', response: { status: 200, headers: {} } }),
      call({ id: 'b', url: 'https://api.dev/login', response: { status: 500, headers: {} } }),
      call({ id: 'c', url: 'https://api.dev/logout', response: { status: 200, headers: {} } }),
    ];
    const out = filterCalls(calls, 'login', '2xx');
    expect(out.map((c) => c.id)).toEqual(['a']);
  });
});
