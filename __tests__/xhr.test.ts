import { BinarCore } from '../src/core/BinarCore';
import { TRACE_HEADER } from '../src/interceptors/xhr';

/**
 * Minimal fake XMLHttpRequest mimicking the surface the interceptor patches.
 * Requests complete synchronously when the test calls respond()/fail().
 */
class FakeXHR {
  static sentHeaders: Record<string, string> = {};
  static lastInstance: FakeXHR | null = null;

  status = 0;
  responseText = '';
  responseType: string | undefined = '';
  response: unknown;

  private listeners: Record<string, Array<() => void>> = {};
  private responseHeaders = '';

  open(_method: string, _url: string) {
    FakeXHR.lastInstance = this;
  }

  setRequestHeader(name: string, value: string) {
    FakeXHR.sentHeaders[name] = value;
  }

  send(_body?: unknown) {
    // network in-flight; test decides the outcome
  }

  addEventListener(event: string, cb: () => void) {
    (this.listeners[event] ??= []).push(cb);
  }

  getAllResponseHeaders() {
    return this.responseHeaders;
  }

  respond(status: number, headers: string, body: string) {
    this.status = status;
    this.responseHeaders = headers;
    this.responseText = body;
    this.fire('loadend');
  }

  failNetwork() {
    this.status = 0;
    this.fire('loadend');
  }

  timeout() {
    this.fire('timeout');
    this.fire('loadend'); // browsers/RN fire loadend after timeout
  }

  private fire(event: string) {
    (this.listeners[event] ?? []).forEach((cb) => cb());
  }
}

describe('XHR interceptor', () => {
  let core: BinarCore;

  beforeEach(() => {
    FakeXHR.sentHeaders = {};
    FakeXHR.lastInstance = null;
    (globalThis as any).XMLHttpRequest = FakeXHR;
    delete (globalThis as any).fetch; // isolate: no fetch interceptor in these tests
    core = new BinarCore();
    core.init({ enabled: true });
  });

  afterEach(() => {
    core.uninstall();
    delete (globalThis as any).XMLHttpRequest;
  });

  function fire(method = 'GET', url = 'https://api.dev/users') {
    const xhr = new (globalThis as any).XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader('Authorization', 'Bearer secret');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send('{"q":1}');
    return xhr as FakeXHR;
  }

  it('records a successful request with redacted headers, body, status and duration', () => {
    const xhr = fire('POST');
    let call = core.store.getAll()[0];
    expect(call).toBeDefined();
    expect(call.state).toBe('pending');
    expect(call.method).toBe('POST');
    expect(call.request.headers.Authorization).toBe('***');
    expect(call.request.headers.Accept).toBe('application/json');
    expect(call.request.body).toBe('{"q":1}');

    xhr.respond(200, 'content-type: application/json\r\n', '{"ok":true}');
    call = core.store.getAll()[0];
    expect(call.state).toBe('success');
    expect(call.response?.status).toBe(200);
    expect(call.response?.headers['content-type']).toBe('application/json');
    expect(call.response?.body).toBe('{"ok":true}');
    expect(typeof call.durationMs).toBe('number');
  });

  it('redacts sensitive fields inside JSON request and response bodies', () => {
    const xhr = new (globalThis as any).XMLHttpRequest();
    xhr.open('POST', 'https://api.dev/login');
    xhr.send(JSON.stringify({ email: 'a@b.com', password: 'hunter2' }));
    xhr.respond(
      200,
      'content-type: application/json\r\n',
      JSON.stringify({ user: 'a@b.com', token: 'abc.def.ghi' })
    );
    const call = core.store.getAll()[0];
    expect(JSON.parse(call.request.body!)).toEqual({ email: 'a@b.com', password: '***' });
    expect(JSON.parse(call.response!.body!)).toEqual({ user: 'a@b.com', token: '***' });
  });

  it('records status 0 as an error', () => {
    const xhr = fire();
    xhr.failNetwork();
    const call = core.store.getAll()[0];
    expect(call.state).toBe('error');
    expect(call.error?.message).toMatch(/Network error/);
  });

  it('records timeout once — loadend after timeout does not overwrite it', () => {
    const xhr = fire();
    xhr.timeout();
    const call = core.store.getAll()[0];
    expect(call.state).toBe('error');
    expect(call.error?.message).toBe('Request timed out');
  });

  it('strips the fetch trace header and skips double-recording', () => {
    const xhr = new (globalThis as any).XMLHttpRequest();
    xhr.open('GET', 'https://api.dev/traced');
    xhr.setRequestHeader(TRACE_HEADER, 'abc:1');
    xhr.send();
    // header never reaches the wire
    expect(FakeXHR.sentHeaders[TRACE_HEADER]).toBeUndefined();
    // and the XHR layer records nothing (fetch layer owns this request)
    expect(core.store.getAll()).toHaveLength(0);
  });

  it('ignores configured URLs and Metro noise', () => {
    core.uninstall();
    core = new BinarCore();
    core.init({ enabled: true, ignoredUrls: [/analytics/] });
    fire('GET', 'https://api.dev/analytics/track');
    fire('GET', 'http://localhost:8081/symbolicate');
    expect(core.store.getAll()).toHaveLength(0);
  });

  it('does nothing when disabled', () => {
    core.uninstall();
    core = new BinarCore();
    core.init({ enabled: false });
    fire();
    expect(core.store.getAll()).toHaveLength(0);
  });

  it('uninstall restores original prototype methods', () => {
    const patched = FakeXHR.prototype.send;
    core.uninstall();
    expect(FakeXHR.prototype.send).not.toBe(patched);
    fire();
    expect(core.store.getAll()).toHaveLength(0);
  });
});
