import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { AuditEvent } from '@/lib/types';

const EVENT_TYPE_LABELS: Record<string, string> = {
  extraction_reviewed: 'Extraction Reviewed',
  field_confirmed: 'Field Confirmed',
  field_rejected: 'Field Rejected',
  field_corrected: 'Field Corrected',
  sensitive_memory_consent: 'Sensitive Consent',
  sensitive_memory_revoked: 'Sensitive Revoked',
  action_status_changed: 'Action Updated',
  reminder_state_changed: 'Reminder Updated',
  recommendation_decision: 'Recommendation Decision',
  recommendations_generated: 'Recommendations Generated',
  signal_confirmed: 'Signal Confirmed',
  signal_rejected: 'Signal Rejected',
  state_override: 'State Override',
  global_sensitivity_defaults_updated: 'Defaults Updated',
  person_deleted: 'Person Deleted',
  interaction_deleted: 'Interaction Deleted',
  data_exported: 'Data Exported',
  briefing_generated: 'Briefing Generated',
};

const FILTER_OPTIONS = ['all', 'user', 'ai', 'system'] as const;

export default function AuditScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 30;

  const loadEvents = useCallback(async (pageNum: number, append = false) => {
    if (!user) return;
    let query = supabase
      .from('lifeos_audit_events')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (filter !== 'all') {
      query = query.eq('actor_type', filter);
    }

    const { data } = await query;
    const results = (data ?? []) as AuditEvent[];
    setEvents(prev => append ? [...prev, ...results] : results);
    setHasMore(results.length === PAGE_SIZE);
    setLoading(false);
  }, [user, filter]);

  useEffect(() => {
    setLoading(true);
    setPage(0);
    loadEvents(0);
  }, [loadEvents]);

  function loadMore() {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    loadEvents(next, true);
  }

  function actorIcon(type: string) {
    switch (type) {
      case 'user': return 'U';
      case 'ai': return 'AI';
      case 'system': return 'S';
      default: return '?';
    }
  }

  function actorColor(type: string) {
    switch (type) {
      case 'user': return brand.primary;
      case 'ai': return brand.accent;
      case 'system': return brand.warning;
      default: return colors.textSecondary;
    }
  }

  function renderItem({ item }: { item: AuditEvent }) {
    return (
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={[styles.actorBadge, { backgroundColor: actorColor(item.actor_type) + '22' }]}>
          <Text style={[styles.actorText, { color: actorColor(item.actor_type) }]}>{actorIcon(item.actor_type)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eventType, { color: colors.text }]}>
            {EVENT_TYPE_LABELS[item.event_type] ?? item.event_type}
          </Text>
          {item.event_summary && (
            <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.event_summary}
            </Text>
          )}
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {new Date(item.created_at).toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
            {item.object_type ? ` · ${item.object_type}` : ''}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Audit Log', headerBackTitle: 'Settings' }} />

      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.filterChip,
              { borderColor: colors.surfaceBorder },
              filter === opt && { backgroundColor: brand.primary + '22', borderColor: brand.primary },
            ]}
            onPress={() => setFilter(opt)}
          >
            <Text style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === opt && { color: brand.primary },
            ]}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No audit events found</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={hasMore ? <ActivityIndicator style={{ padding: 16 }} color={colors.tint} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  list: { padding: 16, paddingTop: 8, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  actorBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  actorText: { fontSize: 12, fontWeight: '800' },
  eventType: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  summary: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  timestamp: { fontSize: 11 },
  emptyText: { fontSize: 14 },
});
