import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDuration, formatSize, prettyBody } from '../utils/format';
import { callToText } from '../utils/export';
import { callToCurl } from '../utils/curl';
import { copyOrShare, shareText } from './deliver';
import { useDeliveryFeedback } from './hooks';
import { statusColor } from './CallListScreen';
import type { HttpCall } from '../types';

const TABS = ['Overview', 'Request', 'Response'] as const;
type Tab = (typeof TABS)[number];

/** Render at most this many characters of a body to keep the UI responsive. */
const BODY_WINDOW = 50_000;

interface Props {
  call: HttpCall;
  onBack: () => void;
}

export function CallDetailScreen({ call, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('Overview');
  const [showFullBody, setShowFullBody] = useState(false);
  const [feedback, deliver] = useDeliveryFeedback();

  // The whole call, not the tab in view: someone reaching for Copy wants the
  // request and the response together, and the untruncated bodies.
  const label = `${call.method} ${call.url}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {call.method} {call.url}
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => deliver(() => copyOrShare(callToCurl(call), label))} hitSlop={8}>
            <Text style={styles.headerAction}>cURL</Text>
          </Pressable>
          <Pressable onPress={() => deliver(() => copyOrShare(callToText(call), label))} hitSlop={8}>
            <Text style={styles.headerAction}>Copy</Text>
          </Pressable>
          <Pressable onPress={() => deliver(() => shareText(callToText(call), label))} hitSlop={8}>
            <Text style={styles.headerAction}>Share</Text>
          </Pressable>
        </View>
      </View>
      {feedback && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{feedback}</Text>
        </View>
      )}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'Overview' && <Overview call={call} />}
        {tab === 'Request' && (
          <HeadersAndBody
            headers={call.request.headers}
            body={call.request.body}
            truncated={call.request.bodyTruncated}
            showFull={showFullBody}
            onShowFull={() => setShowFullBody(true)}
          />
        )}
        {tab === 'Response' &&
          (call.state === 'error' ? (
            <Text style={styles.error}>{call.error?.message ?? 'Unknown error'}</Text>
          ) : call.response ? (
            <HeadersAndBody
              headers={call.response.headers}
              body={call.response.body}
              truncated={call.response.bodyTruncated}
              showFull={showFullBody}
              onShowFull={() => setShowFullBody(true)}
            />
          ) : (
            <Text style={styles.pending}>Waiting for response…</Text>
          ))}
      </ScrollView>
    </View>
  );
}

function Overview({ call }: { call: HttpCall }) {
  const rows: [string, string][] = [
    ['URL', call.url],
    ['Method', call.method],
    ...(call.screen ? ([['Screen', `/${call.screen}`]] as [string, string][]) : []),
    ['Status', call.state === 'error' ? `Error — ${call.error?.message ?? ''}` : String(call.response?.status ?? 'pending')],
    ['Client', call.client],
    ['Started', new Date(call.startedAt).toLocaleTimeString()],
    ['Duration', formatDuration(call.durationMs)],
    ['Request size', formatSize(call.request.size)],
    ['Response size', formatSize(call.response?.size)],
  ];
  return (
    <View>
      <View style={[styles.statusBanner, { backgroundColor: statusColor(call) }]}>
        <Text style={styles.statusBannerText}>
          {call.state === 'pending' ? 'PENDING' : call.state === 'error' ? 'FAILED' : `HTTP ${call.response?.status}`}
        </Text>
      </View>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.kvRow}>
          <Text style={styles.k}>{k}</Text>
          <Text style={styles.v} selectable>
            {v}
          </Text>
        </View>
      ))}
    </View>
  );
}

function HeadersAndBody({
  headers,
  body,
  truncated,
  showFull,
  onShowFull,
}: {
  headers: Record<string, string>;
  body?: string;
  truncated?: boolean;
  showFull: boolean;
  onShowFull: () => void;
}) {
  const entries = Object.entries(headers);
  const pretty = prettyBody(body);
  const windowed = !showFull && pretty.length > BODY_WINDOW;
  const shown = windowed ? pretty.slice(0, BODY_WINDOW) : pretty;
  return (
    <View>
      <Text style={styles.section}>Headers</Text>
      {entries.length === 0 ? (
        <Text style={styles.muted}>(none)</Text>
      ) : (
        entries.map(([k, v]) => (
          <View key={k} style={styles.kvRow}>
            <Text style={styles.k}>{k}</Text>
            <Text style={styles.v} selectable>
              {v}
            </Text>
          </View>
        ))
      )}
      <Text style={styles.section}>Body</Text>
      {shown ? (
        <>
          <Text style={styles.body} selectable>
            {shown}
          </Text>
          {windowed && (
            <Pressable onPress={onShowFull}>
              <Text style={styles.showMore}>Show more…</Text>
            </Pressable>
          )}
          {truncated && <Text style={styles.muted}>Body truncated at capture time (maxBodySize).</Text>}
        </>
      ) : (
        <Text style={styles.muted}>(empty)</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  back: { color: '#1565c0', fontSize: 15, fontWeight: '600' },
  title: { flex: 1, fontSize: 13, fontWeight: '600', color: '#222' },
  headerActions: { flexDirection: 'row', gap: 14 },
  headerAction: { fontSize: 14, color: '#1565c0', fontWeight: '600' },
  toast: { backgroundColor: '#323232', paddingVertical: 8, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1565c0' },
  tabText: { fontSize: 13, color: '#666' },
  tabTextActive: { color: '#1565c0', fontWeight: '700' },
  content: { padding: 16 },
  statusBanner: { borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 12 },
  statusBannerText: { color: '#fff', fontWeight: '700' },
  kvRow: { flexDirection: 'row', paddingVertical: 4 },
  k: { width: 120, fontSize: 12, color: '#888', fontWeight: '600' },
  v: { flex: 1, fontSize: 12, color: '#222' },
  section: { fontSize: 13, fontWeight: '700', color: '#222', marginTop: 16, marginBottom: 6 },
  body: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#222',
    backgroundColor: '#f6f6f6',
    borderRadius: 6,
    padding: 8,
  },
  muted: { fontSize: 12, color: '#999', marginTop: 4 },
  pending: { color: '#888' },
  error: { color: '#e53935', fontWeight: '600' },
  showMore: { color: '#1565c0', fontWeight: '600', marginTop: 8 },
});
