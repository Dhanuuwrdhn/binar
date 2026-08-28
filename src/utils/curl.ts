import { isPlaceholderBody } from './format';
import type { HttpCall } from '../types';

/** Headers curl derives itself or that would conflict with a re-sent request. */
const OMIT_HEADERS = new Set(['content-length', 'host', 'connection', 'x-binar-trace']);

/** Single-quote a shell argument, escaping any embedded single quotes. */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Reconstruct the captured request as a runnable `curl` command — the
 * most-asked-for way to hand a captured call to a backend engineer.
 * Redacted values (`***`, from redactedHeaders/redactedBodyFields) are
 * copied as-is: the real value was never stored, so the command needs it
 * filled in by hand before it will actually work — flagged with a comment
 * rather than silently shipping a broken-looking curl line.
 */
export function callToCurl(call: HttpCall): string {
  const lines = [`curl -X ${call.method} ${shQuote(call.url)}`];

  for (const [name, value] of Object.entries(call.request.headers)) {
    if (OMIT_HEADERS.has(name.toLowerCase())) continue;
    lines.push(`  -H ${shQuote(`${name}: ${value}`)}`);
  }

  const body = call.request.body;
  const bodyIsPlaceholder = isPlaceholderBody(body);
  if (body && !bodyIsPlaceholder) {
    lines.push(`  --data-raw ${shQuote(body)}`);
  }

  const notes: string[] = [];
  const hasRedactedValue =
    Object.values(call.request.headers).includes('***') || (body?.includes('***') ?? false);
  if (hasRedactedValue) {
    notes.push('# Redacted values shown as *** need the real value filled in.');
  }
  if (body && bodyIsPlaceholder) {
    notes.push(`# Original body was not captured verbatim (${body}) — add it manually if needed.`);
  }

  const command = lines.join(' \\\n');
  return notes.length > 0 ? `${notes.join('\n')}\n${command}` : command;
}
