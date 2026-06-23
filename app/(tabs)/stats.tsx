import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { InteractionStat } from '@/lib/types';

type Period = 'today' | 'this_week' | 'this_month' | 'this_year' | 'all_time';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'Week' },
  { key: 'this_month', label: 'Month' },
  { key: 'this_year', label: 'Year' },
  { key: 'all_time', label: 'All' },
];

export default function StatsScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const [stats, setStats] = useState<InteractionStat[]>([]);
  const [period, setPeriod] = useState<Period>('this_week');
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('lifeos_v_interaction_stats')
      .select('*')
      .eq('owner_id', user.id);
    if (data) setStats(data);
  }, [user]);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function onRefresh() {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }

  const sorted = [...stats]
    .filter(s => s[period] > 0)
    .sort((a, b) => b[period] - a[period]);

  const totalInteractions = sorted.reduce((sum, s) => sum + s[period], 0);
  const uniquePeople = sorted.length;

  function relColor(rel: string | null) {
    switch (rel) {
      case 'family': return '#FF6B6B';
      case 'friend': return brand.primary;
      case 'colleague': return brand.accent;
      default: return brand.warning;
    }
  }

  function barWidth(count: number): `${number}%` {
    const max = sorted.length > 0 ? sorted[0][period] : 1;
    const pct = Math.max((count / max) * 100, 8);
    return `${pct}%` as `${number}%`;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.summaryNum, { color: brand.primary }]}>{totalInteractions}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Interactions</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.summaryNum, { color: brand.accent }]}>{uniquePeople}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>People</Text>
        </View>
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[
              styles.periodChip,
              { borderColor: colors.surfaceBorder },
              period === p.key && { backgroundColor: brand.primary, borderColor: brand.primary },
            ]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[
              styles.periodText,
              { color: colors.textSecondary },
              period === p.key && { color: '#fff' },
            ]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leaderboard */}
      <FlatList
        data={sorted}
        keyExtractor={s => s.person_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.leaderRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
            onPress={() => router.push(`/person/${item.person_id}`)}
          >
            <Text style={[styles.rank, { color: colors.textSecondary }]}>{index + 1}</Text>
            <View style={[styles.avatar, { backgroundColor: relColor(item.relationship) + '22' }]}>
              <Text style={[styles.avatarText, { color: relColor(item.relationship) }]}>
                {item.person_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.leaderInfo}>
              <View style={styles.leaderHeader}>
                <Text style={[styles.leaderName, { color: colors.text }]}>{item.person_name}</Text>
                <Text style={[styles.leaderCount, { color: brand.primary }]}>{item[period]}</Text>
              </View>
              <View style={styles.barContainer}>
                <View
                  style={[styles.bar, { backgroundColor: relColor(item.relationship), width: barWidth(item[period]) }]}
                />
              </View>
              <Text style={[styles.leaderMeta, { color: colors.textSecondary }]}>
                {item.relationship ?? 'contact'}
                {item.last_seen ? ` · Last: ${new Date(item.last_seen).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No interactions yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Record voice notes and create calendar events to start tracking.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  summaryCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  summaryNum: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  summaryLabel: { fontSize: 12 },
  periodRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  periodChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  periodText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  rank: { fontSize: 14, fontWeight: '700', width: 24, textAlign: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginHorizontal: 10 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  leaderInfo: { flex: 1 },
  leaderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leaderName: { fontSize: 15, fontWeight: '600' },
  leaderCount: { fontSize: 16, fontWeight: '800' },
  barContainer: { height: 4, backgroundColor: '#1E293B', borderRadius: 2, marginVertical: 6 },
  bar: { height: 4, borderRadius: 2 },
  leaderMeta: { fontSize: 12 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
