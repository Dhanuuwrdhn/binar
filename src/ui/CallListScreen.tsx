import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Binar } from '../core/BinarCore';
import { useBinarCalls, useDeliveryFeedback } from './hooks';
import { formatDuration, formatSize } from '../utils/format';
import { callsToText } from '../utils/export';
import { copyOrShare } from './deliver';
import {
  filterCalls,
  matchesStatusFilter,
  STATUS_FILTERS,
  type StatusFilterValue,
} from '../utils/filter';
import { colors, methodColor, statusColor as themeStatusColor } from './theme';
import type { HttpCall } from '../types';

/** Kept as the existing call-shaped export other screens already import — sources its color from the shared theme so list/detail never drift apart. */
export function statusColor(call: HttpCall): string {
  return themeStatusColor(call.state, call.response?.status);
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

const FILTER_LABELS: Record<StatusFilterValue, string> = {
  all: 'All',
  '2xx': '2xx',
  '3xx': '3xx',
  '4xx': '4xx',
  '5xx': '5xx',
  error: 'Failed',
};

interface Props {
  onSelect: (call: HttpCall) => void;
  onClose: () => void;
}

export function CallListScreen({ onSelect, onClose }: Props) {
  const calls = useBinarCalls();
  const [feedback, deliver] = useDeliveryFeedback();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const filtered = useMemo(
    () => filterCalls(calls, query, statusFilter),
    [calls, query, statusFilter]
  );
  const filterActive = query.trim() !== '' || statusFilter !== 'all';

  // Lets each chip read "Failed (3)" etc. — tells you where the problems are before you tap a filter.
  const counts = useMemo(() => {
    const out = {} as Record<StatusFilterValue, number>;
    for (const f of STATUS_FILTERS) {
      out[f] = f === 'all' ? calls.length : calls.filter((c) => matchesStatusFilter(c, f)).length;
    }
    return out;
  }, [calls]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Binar — HTTP Inspector</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => deliver(() => copyOrShare(callsToText(filtered), 'Binar — calls'))}
            hitSlop={8}
            disabled={filtered.length === 0}
          >
            <Text style={[styles.headerAction, filtered.length === 0 && styles.headerActionOff]}>
              {filterActive ? `Copy ${filtered.length}` : 'Copy all'}
            </Text>
          </Pressable>
          <Pressable onPress={() => Binar.clear()} hitSlop={8}>
            <Text style={styles.headerAction}>Clear</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.headerAction}>Close</Text>
          </Pressable>
        </View>
      </View>
      {calls.length > 0 && (
        <View style={styles.filters}>
          <TextInput
            style={styles.search}
            placeholder="Search method, URL, screen…"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <View style={styles.chipRow}>
            {STATUS_FILTERS.map((f) => (
              <Pressable
                key={f}
                style={[styles.chip, statusFilter === f && styles.chipActive]}
                onPress={() => setStatusFilter(f)}
              >
                <Text style={[styles.chipText, statusFilter === f && styles.chipTextActive]}>
                  {FILTER_LABELS[f]} ({counts[f]})
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {feedback && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{feedback}</Text>
        </View>
      )}
      {calls.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⇅</Text>
          <Text style={styles.emptyText}>Fire a request from your app —{'\n'}it appears here automatically.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No calls match this search</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => onSelect(item)}>
              <View style={[styles.accentBar, { backgroundColor: statusColor(item) }]} />
              <View style={[styles.statusPill, { backgroundColor: statusColor(item) }]}>
                <Text style={styles.statusText}>
                  {item.state === 'pending' ? '…' : item.state === 'error' ? 'ERR' : item.response?.status}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <View style={[styles.methodTag, { backgroundColor: methodColor(item.method) }]}>
                    <Text style={styles.methodTagText}>{item.method}</Text>
                  </View>
                  <Text style={styles.path} numberOfLines={1}>
                    {pathOf(item.url)}
                  </Text>
                </View>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.screen ? `/${item.screen} · ` : ''}
                  {hostOf(item.url)} · {formatDuration(item.durationMs)} ·{' '}
                  {formatSize(item.response?.size)} · {item.client}
                </Text>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  headerActions: { flexDirection: 'row', gap: 14 },
  headerAction: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  headerActionOff: { color: '#bbb' },
  filters: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  search: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: colors.text,
  },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 4, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },
  toast: { backgroundColor: '#323232', paddingVertical: 8, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 28, color: '#ccc', marginBottom: 8 },
  emptyText: { color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accentBar: { width: 4, alignSelf: 'stretch' },
  statusPill: {
    minWidth: 44,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginLeft: 8,
  },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  rowBody: { flex: 1, paddingVertical: 12, paddingRight: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  methodTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  methodTagText: { color: '#fff', fontWeight: '700', fontSize: 10 },
  path: { flex: 1, fontSize: 13, color: colors.text },
  rowMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderFaint },
});
