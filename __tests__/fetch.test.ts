import { BinarCore } from '../src/core/BinarCore';
import { TRACE_HEADER } from '../src/interceptors/xhr';

function fakeResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return {
    status,
    headers: {
      forEach: (cb: (v: string, k: string) => void) =>
        Object.entries(headers).forEach(([k, v]) => cb(v, k)),
    },
    clone() {
      return { text: async () => body };
    },
  } as unknown as Response;
}

describe('fetch interceptor', () => {
  let core: BinarCore;
  let received: { input: unknown; init?: RequestInit } | null;

  beforeEach(() => {
    received = null;
    delete (globalThis as any).XMLHttpRequest; // isolate: no XHR interceptor here
    (globalThis as any).fetch = jest.fn(async (input: any, init?: RequestInit) => {
      received = { input, init };
      return fakeResponse(200, '{"ok":true}', { 'content-type': 'application/json' });
    });
    core = new BinarCore();
    core.init({ enabled: true });
  });

  afterEach(() => {
    core.uninstall();
    delete (globalThis as any).fetch;
  });

  it('records fetch calls with request/response bodies and adds the trace marker', async () => {
    const res = await (globalThis as any).fetch('https://api.dev/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
      body: '{"name":"a"}',
    });
    expect(res.status).toBe(200);

    // marker forwarded to the underlying transport (XHR patch strips it there)
    const sentHeaders = received!.init!.headers as Record<string, string>;
    expect(sentHeaders[TRACE_HEADER]).toBeDefined();

    // exactly one record, from the fetch layer
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // let the async body read settle
    const calls = core.store.getAll();
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.client).toBe('fetch');
    expect(call.method).toBe('POST');
    expect(call.request.body).toBe('{"name":"a"}');
    expect(call.request.headers.Authorization).toBe('***');
    expect(call.state).toBe('success');
    expect(call.response?.body).toBe('{"ok":true}');
    expect(call.response?.headers['content-type']).toBe('application/json');
  });

  it('stamps the active screen onto calls captured while it is set', async () => {
    core.setScreen('Home');
    await (globalThis as any).fetch('https://api.dev/items');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(core.store.getAll()[0].screen).toBe('Home');

    core.setScreen(null);
    await (globalThis as any).fetch('https://api.dev/items');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(core.store.getAll()[0].screen).toBeUndefined();
  });

  it('records network failures as errors and rethrows', async () => {
    ((globalThis as any).fetch as jest.Mock).mockRestore?.();
    core.uninstall();
    (globalThis as any).fetch = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    core = new BinarCore();
    core.init({ enabled: true });

    await expect((globalThis as any).fetch('https://api.dev/fail')).rejects.toThrow(
      'Network request failed'
    );
    const call = core.store.getAll()[0];
    expect(call.state).toBe('error');
    expect(call.error?.message).toBe('Network request failed');
  });

  it('skips reading oversized response bodies, recording a sized marker instead', async () => {
    core.uninstall();
    let cloned = false;
    (globalThis as any).fetch = jest.fn(async () => ({
      status: 200,
      headers: {
        forEach: (cb: (v: string, k: string) => void) => {
          cb('application/json', 'content-type');
          cb('5000000', 'content-length'); // 5 MB, over the default 1 MB cap
        },
      },
      clone() {
        cloned = true;
        return { text: async () => 'x'.repeat(5_000_000) };
      },
    }));
    core = new BinarCore();
    core.init({ enabled: true });

    await (globalThis as any).fetch('https://api.dev/big.json');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(cloned).toBe(false); // never materialized the 5 MB body
    const call = core.store.getAll()[0];
    expect(call.response?.body).toBe('[response body too large to capture: 4.8 MB]');
    expect(call.response?.bodyTruncated).toBe(true);
    expect(call.response?.size).toBe(5_000_000);
  });

  it('skips reading binary response bodies by content-type, keeping the real size', async () => {
    core.uninstall();
    let cloned = false;
    (globalThis as any).fetch = jest.fn(async () => ({
      status: 200,
      headers: {
        forEach: (cb: (v: string, k: string) => void) => {
          cb('image/png', 'content-type');
          cb('2048', 'content-length');
        },
      },
      clone() {
        cloned = true;
        return { text: async () => 'binary-ish garbage' };
      },
    }));
    core = new BinarCore();
    core.init({ enabled: true });

    await (globalThis as any).fetch('https://api.dev/logo.png');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(cloned).toBe(false);
    const call = core.store.getAll()[0];
    expect(call.response?.body).toBe('[image/png response, 2.0 KB]');
    expect(call.response?.size).toBe(2048);
  });

  it('still reads small JSON bodies normally', async () => {
    await (globalThis as any).fetch('https://api.dev/items');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const call = core.store.getAll()[0];
    expect(call.response?.body).toBe('{"ok":true}');
    expect(call.response?.bodyTruncated).toBe(false);
  });

  it('uninstall restores the original fetch', () => {
    const orig = ((): unknown => {
      core.uninstall();
      return (globalThis as any).fetch;
    })();
    expect(jest.isMockFunction(orig)).toBe(true);
  });
});
