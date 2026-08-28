import type { BinarCore } from '../core/BinarCore';
import { TRACE_HEADER } from './xhr';
import { formatSize, type SkippedBody } from '../utils/format';

let traceCounter = 0;

/**
 * Wrap global.fetch so fetch traffic is recorded with full request/response
 * bodies (via Response.clone()).
 *
 * Dedupe: React Native's default fetch is a polyfill on top of XMLHttpRequest,
 * so the same request would also hit the XHR patch. The wrapper adds an
 * internal TRACE_HEADER; the XHR patch sees it, skips recording, and strips
 * the header before the request is sent.
 *
 * Returns an uninstaller that restores the original fetch.
 */
export function installFetchInterceptor(core: BinarCore): () => void {
  const g = globalThis as any;
  const origFetch: typeof fetch | undefined = g.fetch;
  if (!origFetch) return () => {};

  const wrapped: typeof fetch = async (input: any, init?: RequestInit) => {
    let id: string | null = null;
    let finalInit = init;
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input?.url ?? String(input));
      const method =
        init?.method ?? (typeof input === 'object' && input?.method) ?? 'GET';
      const headers = normalizeHeaders(init?.headers ?? (typeof input === 'object' ? input?.headers : undefined));

      id = core.recordStart({
        client: 'fetch',
        method,
        url,
        headers,
        body: init?.body,
      });

      if (id) {
        traceCounter += 1;
        // Attach the marker so the underlying XHR layer does not double-record.
        finalInit = {
          ...init,
          headers: { ...headers, [TRACE_HEADER]: `${id}:${traceCounter}` },
        };
      }
    } catch {
      // capture must never break networking
    }

    try {
      const response = await origFetch(input, finalInit);
      if (id) {
        recordResponse(core, id, response).catch(() => {});
      }
      return response;
    } catch (err: any) {
      if (id) {
        try {
          core.recordError(id, err?.message ? String(err.message) : 'Network request failed');
        } catch {
          // ignore
        }
      }
      throw err;
    }
  };

  g.fetch = wrapped;
  return () => {
    g.fetch = origFetch;
  };
}

async function recordResponse(core: BinarCore, id: string, response: Response): Promise<void> {
  const headers: Record<string, string> = {};
  try {
    response.headers?.forEach?.((value: string, key: string) => {
      headers[key] = value;
    });
  } catch {
    // ignore
  }
  const body = await readResponseBody(response, headers, core.config.maxBodySize);
  core.recordSuccess(id, { status: response.status, headers, body });
}

/**
 * response.clone().text() buffers the entire body in memory — fine for a
 * JSON reply, a real problem for a multi-MB image/video/file download.
 * Content-Length and Content-Type are plain headers, already known without
 * reading anything, so use them to skip the read entirely when the body is
 * oversized or not text, recording a marker with the real size instead.
 */
async function readResponseBody(
  response: Response,
  headers: Record<string, string>,
  maxBodySize: number,
): Promise<string | SkippedBody> {
  const contentType = headers['content-type'] ?? '';
  const contentLength = Number(headers['content-length']);
  const knownSize = Number.isFinite(contentLength) ? contentLength : undefined;

  if (knownSize !== undefined && knownSize > maxBodySize) {
    return { binarSkipped: true, note: `[response body too large to capture: ${formatSize(knownSize)}]`, size: knownSize };
  }
  if (contentType && !isTextualContentType(contentType)) {
    const sizeNote = knownSize !== undefined ? `, ${formatSize(knownSize)}` : '';
    return { binarSkipped: true, note: `[${contentType} response${sizeNote}]`, size: knownSize ?? 0 };
  }

  try {
    // Clone so the app can still consume the original stream.
    return await response.clone().text();
  } catch {
    return '[unreadable body]';
  }
}

const TEXTUAL_CONTENT_TYPE =
  /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded|graphql)|.*\+json$|.*\+xml$)/i;

function isTextualContentType(contentType: string): boolean {
  return TEXTUAL_CONTENT_TYPE.test(contentType.split(';')[0].trim());
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  try {
    const h = headers as { forEach?: (cb: (value: string, key: string) => void) => void };
    if (typeof h.forEach === 'function') {
      h.forEach((value: string, key: string) => {
        out[key] = value;
      });
    } else if (Array.isArray(headers)) {
      for (const [k, v] of headers as [string, string][]) out[k] = v;
    } else {
      for (const [k, v] of Object.entries(headers as Record<string, string>)) out[k] = String(v);
    }
  } catch {
    // ignore
  }
  return out;
}
