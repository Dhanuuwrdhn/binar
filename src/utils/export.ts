// Getting a captured call *out* of the device.
//
// Reading a 40 KB response through a phone-sized scroll view is not really
// reading it, and the detail screen deliberately renders only the first 50k
// characters to stay responsive. These helpers produce the whole thing as one
// block of text so it can go to the clipboard or a share sheet and be read
// somewhere with a real window.

import { prettyBody, formatDuration, formatSize } from './format';
import type { HttpCall } from '../types';

const RULE = '─'.repeat(56);

function section(title: string, content: string): string {
  return `${RULE}\n${title}\n${RULE}\n${content || '(empty)'}`;
}

function headerLines(headers: Record<string, string>): string {
  const entries = Object.entries(headers);
  if (entries.length === 0) return '(none)';
  return entries.map(([k, v]) => `${k}: ${v}`).join('\n');
}

function isRedacted(call: HttpCall): boolean {
  const headerValues = [
    ...Object.values(call.request.headers),
    ...Object.values(call.response?.headers ?? {}),
  ];
  if (headerValues.includes('***')) return true;
  return Boolean(call.request.body?.includes('***') || call.response?.body?.includes('***'));
}

/** One call as plain text: metadata, both header sets, and both full bodies. */
export function callToText(call: HttpCall): string {
  const status =
    call.state === 'pending'
      ? 'pending'
      : call.state === 'error'
        ? `failed — ${call.error?.message ?? 'unknown error'}`
        : `HTTP ${call.response?.status}`;

  const meta = [
    `${call.method} ${call.url}`,
    `Status:        ${status}`,
    call.screen ? `Screen:        /${call.screen}` : null,
    `Client:        ${call.client}`,
    `Started:       ${new Date(call.startedAt).toISOString()}`,
    `Duration:      ${formatDuration(call.durationMs)}`,
    `Request size:  ${formatSize(call.request.size)}`,
    `Response size: ${formatSize(call.response?.size)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const parts = [
    meta,
    section('REQUEST HEADERS', headerLines(call.request.headers)),
    section('REQUEST BODY', prettyBody(call.request.body)),
  ];

  if (call.state === 'error') {
    parts.push(section('ERROR', call.error?.message ?? 'unknown error'));
  } else if (call.response) {
    parts.push(section('RESPONSE HEADERS', headerLines(call.response.headers)));
    parts.push(section('RESPONSE BODY', prettyBody(call.response.body)));
  } else {
    parts.push(section('RESPONSE', 'still pending'));
  }

  // Worth saying out loud: a reader who finds "***" where a token should be
  // will otherwise assume the export dropped it, when in fact the value was
  // never stored — redaction happens at capture time.
  if (isRedacted(call)) {
    parts.push(
      'Values shown as *** were redacted when the call was captured ' +
        '(BinarConfig.redactedHeaders / redactedBodyFields); the real value was never stored.',
    );
  }
  if (call.request.bodyTruncated || call.response?.bodyTruncated) {
    parts.push('A body was truncated at capture time (BinarConfig.maxBodySize).');
  }

  return parts.join('\n\n');
}

/** Every captured call, oldest first, separated by a header line. */
export function callsToText(calls: HttpCall[]): string {
  if (calls.length === 0) return 'No HTTP calls captured.';
  const ordered = [...calls].sort((a, b) => a.startedAt - b.startedAt);
  const body = ordered
    .map((call, i) => `\n═══ ${i + 1}/${ordered.length} ═══\n\n${callToText(call)}`)
    .join('\n');
  return `Binar — ${ordered.length} HTTP call${ordered.length === 1 ? '' : 's'}\n${body}`;
}
