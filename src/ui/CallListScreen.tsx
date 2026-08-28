import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Binar } from '../core/BinarCore';
import { useBinarCalls, useDeliveryFeedback } from './hooks';
import { formatDuration, formatSize } from '../utils/format';
import { callsToText } from '../utils/export';
import { copyOrShare } from './deliver';
import { filterCalls, STATUS_FILTERS, type StatusFilterValue } from '../utils/filter';
import type { HttpCall } from '../types';

export function statusColor(call: HttpCall): string {
  if (call.state === 'pending') return '#9e9e9e';
  if (call.state === 'error') return '#e53935';
  const s = call.response?.status ?? 0;
  if (s >= 500) return '#e53935';
  if (s >= 400) return '#fb8c00';
  if (s >= 300) return '#8e24aa';
  return '#43a047';
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
            placeholderTextColor="#999"
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
                  {f === 'all' ? 'All' : f}
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
          <Text style={styles.emptyText}>No HTTP calls captured yet</Text>
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
              <View style={[styles.statusPill, { backgroundColor: statusColor(item) }]}>
                <Text style={styles.statusText}>
                  {item.state === 'pending' ? '…' : item.state === 'error' ? 'ERR' : item.response?.status}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLine} numberOfLines={1}>
                  <Text style={styles.method}>{item.method}</Text> {pathOf(item.url)}
                </Text>
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#222' },
  headerActions: { flexDirection: 'row', gap: 14 },
  headerAction: { fontSize: 14, color: '#1565c0', fontWeight: '600' },
  headerActionOff: { color: '#bbb' },
  filters: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  search: {
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#222',
  },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 4, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f2f2f2',
  },
  chipActive: { backgroundColor: '#1565c0' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },
  toast: { backgroundColor: '#323232', paddingVertical: 8, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#888' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  statusPill: {
    minWidth: 44,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  rowBody: { flex: 1 },
  rowLine: { fontSize: 13, color: '#222' },
  method: { fontWeight: '700' },
  rowMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#eee' },
});
