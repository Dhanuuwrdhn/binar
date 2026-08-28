import { CallStore } from './CallStore';
import { installXHRInterceptor } from '../interceptors/xhr';
import { installFetchInterceptor } from '../interceptors/fetch';
import { redactHeaders, redactBodyFields } from '../utils/redact';
import { toStoredBody } from '../utils/format';
import type { BinarConfig, HttpCall, ResolvedBinarConfig } from '../types';
import { resolveConfig } from '../types';

type Listener = () => void;

/** Metro / dev-server noise ignored by default. */
const DEFAULT_IGNORED: RegExp[] = [/\/symbolicate$/, /\/logs$/];

let counter = 0;
function nextId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

export class BinarCore {
  config: ResolvedBinarConfig = resolveConfig({ enabled: false });
  store: CallStore = new CallStore(1000);

  private installed = false;
  private uninstallers: Array<() => void> = [];

  private inspectorVisible = false;
  private uiListeners = new Set<Listener>();
  /** Calls captured since the inspector was last opened (drives the bubble badge). */
  private unseenCount = 0;
  /** Active app screen, reported by the host app via setScreen. */
  private currentScreen: string | null = null;

  // ── lifecycle ──────────────────────────────────────────────────────────────

  init(config: BinarConfig = {}): void {
    this.config = resolveConfig(config);
    this.store.setMaxCallsCount(this.config.maxCallsCount);
    if (!this.config.enabled || this.installed) return;
    this.uninstallers.push(installXHRInterceptor(this));
    this.uninstallers.push(installFetchInterceptor(this));
    this.installed = true;
  }

  /** Restore original XHR/fetch implementations. */
  uninstall(): void {
    this.uninstallers.forEach((u) => {
      try {
        u();
      } catch {
        // ignore
      }
    });
    this.uninstallers = [];
    this.installed = false;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.installed;
  }

  // ── capture API (used by interceptors) ─────────────────────────────────────

  shouldIgnore(url: string): boolean {
    const patterns: (string | RegExp)[] = [...DEFAULT_IGNORED, ...this.config.ignoredUrls];
    return patterns.some((p) =>
      typeof p === 'string' ? url.includes(p) : p.test(url)
    );
  }

  recordStart(input: {
    client: HttpCall['client'];
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
    id?: string;
  }): string | null {
    if (!this.isEnabled() || this.shouldIgnore(input.url)) return null;
    const id = input.id ?? nextId();
    const call: HttpCall = {
      id,
      client: input.client,
      method: (input.method || 'GET').toUpperCase(),
      url: input.url,
      screen: this.currentScreen ?? undefined,
      startedAt: Date.now(),
      state: 'pending',
      request: {
        headers: redactHeaders(input.headers, this.config.redactedHeaders),
        ...toStoredBody(
          redactBodyFields(input.body, this.config.redactedBodyFields),
          this.config.maxBodySize
        ),
      },
    };
    this.store.add(call);
    this.unseenCount += 1;
    this.emitUi();
    return id;
  }

  recordSuccess(
    id: string,
    input: { status: number; headers: Record<string, string>; body?: unknown }
  ): void {
    const started = this.store.get(id)?.startedAt;
    this.store.update(id, {
      state: 'success',
      durationMs: started !== undefined ? Date.now() - started : undefined,
      response: {
        status: input.status,
        headers: redactHeaders(input.headers, this.config.redactedHeaders),
        ...toStoredBody(
          redactBodyFields(input.body, this.config.redactedBodyFields),
          this.config.maxBodySize
        ),
      },
    });
  }

  recordError(id: string, message: string): void {
    const started = this.store.get(id)?.startedAt;
    this.store.update(id, {
      state: 'error',
      durationMs: started !== undefined ? Date.now() - started : undefined,
      error: { message },
    });
  }

  // ── UI state ───────────────────────────────────────────────────────────────

  open(): void {
    if (!this.config.enabled) return;
    this.inspectorVisible = true;
    this.unseenCount = 0;
    this.emitUi();
  }

  close(): void {
    this.inspectorVisible = false;
    this.emitUi();
  }

  isOpen(): boolean {
    return this.inspectorVisible;
  }

  getUnseenCount(): number {
    return this.unseenCount;
  }

  /**
   * Report the active app screen (e.g. from react-navigation's onStateChange).
   * Shown as a floating label and stamped onto every call captured while active.
   */
  setScreen(name: string | null): void {
    if (!this.config.enabled || this.currentScreen === name) return;
    this.currentScreen = name;
    this.emitUi();
  }

  getScreen(): string | null {
    return this.currentScreen;
  }

  setNotification(show: boolean): void {
    this.config = { ...this.config, showNotification: show };
    this.emitUi();
  }

  clear(): void {
    this.store.clear();
    this.unseenCount = 0;
    this.emitUi();
  }

  subscribeUi(listener: Listener): () => void {
    this.uiListeners.add(listener);
    return () => this.uiListeners.delete(listener);
  }

  private emitUi(): void {
    this.uiListeners.forEach((l) => {
      try {
        l();
      } catch {
        // ignore
      }
    });
  }
}

/** Singleton instance used by the public API and the UI. */
export const Binar = new BinarCore();
