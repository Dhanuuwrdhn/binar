// Shared types for Binar (Bornworks network interceptor plugin).

export type CallState = 'pending' | 'success' | 'error';

export interface HttpCallRequest {
  headers: Record<string, string>;
  body?: string;
  bodyTruncated?: boolean;
  size?: number;
}

export interface HttpCallResponse {
  status: number;
  headers: Record<string, string>;
  body?: string;
  bodyTruncated?: boolean;
  size?: number;
}

export interface HttpCall {
  id: string;
  /** Which capture source produced this record. */
  client: 'xhr' | 'fetch';
  method: string;
  url: string;
  /** App screen active when the request started (set via Binar.setScreen). */
  screen?: string;
  startedAt: number;
  durationMs?: number;
  request: HttpCallRequest;
  response?: HttpCallResponse;
  error?: { message: string };
  state: CallState;
}

export interface BinarConfig {
  /** When false, nothing is patched and every API is a no-op. Default: __DEV__ if available, else true. */
  enabled?: boolean;
  /** Show the in-app floating bubble when new calls arrive. Default: true. */
  showNotification?: boolean;
  /** Show the floating label with the current screen name (needs Binar.setScreen wiring). Default: true. */
  showScreenLabel?: boolean;
  /** Ring buffer size. Default: 1000. */
  maxCallsCount?: number;
  /** Max stored body size in characters; longer bodies are truncated. Default: 1_000_000. */
  maxBodySize?: number;
  /** Header names (case-insensitive) whose values are replaced with "***". */
  redactedHeaders?: string[];
  /**
   * JSON body field names (case-insensitive, matched at any nesting depth)
   * whose values are replaced with "***" before storage. Only applies to
   * bodies that parse as JSON — headers cover everything else already, and
   * guessing at other body formats risks corrupting them.
   */
  redactedBodyFields?: string[];
  /** Requests whose URL matches any entry are not captured. */
  ignoredUrls?: (string | RegExp)[];
}

export type ResolvedBinarConfig = Required<BinarConfig>;

export const DEFAULT_REDACTED_HEADERS = ['authorization', 'cookie', 'set-cookie'];

export const DEFAULT_REDACTED_BODY_FIELDS = [
  'password',
  'passwd',
  'token',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'secret',
  'client_secret',
  'clientSecret',
  'api_key',
  'apiKey',
  'card_number',
  'cardNumber',
  'cvv',
  'cvc',
];

export function resolveConfig(config: BinarConfig = {}): ResolvedBinarConfig {
  // __DEV__ is defined by React Native / Metro; guard for plain Node (tests).
  const dev =
    typeof (globalThis as any).__DEV__ === 'boolean'
      ? (globalThis as any).__DEV__
      : true;
  return {
    enabled: config.enabled ?? dev,
    showNotification: config.showNotification ?? true,
    showScreenLabel: config.showScreenLabel ?? true,
    maxCallsCount: config.maxCallsCount ?? 1000,
    maxBodySize: config.maxBodySize ?? 1_000_000,
    redactedHeaders: config.redactedHeaders ?? DEFAULT_REDACTED_HEADERS,
    redactedBodyFields: config.redactedBodyFields ?? DEFAULT_REDACTED_BODY_FIELDS,
    ignoredUrls: config.ignoredUrls ?? [],
  };
}
