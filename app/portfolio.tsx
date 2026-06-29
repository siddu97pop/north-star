import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import { fetchPortfolio, type PortfolioResponse } from '@/lib/api';

const DOMAIN_LABELS: Record<string, string> = { work: 'Work', personal: 'Personal', other_strategic: 'Strategic' };
const DOMAIN_COLORS: Record<string, string> = { work: brand.accent, personal: brand.primary, other_strategic: brand.warning };

const HEALTH_LABELS: Record<string, string> = {
  stable: 'Stable', positive: 'Positive', quiet_but_ok: 'Quiet but OK',
  needs_attention: 'Needs Attention', care_followup: 'Care Follow-up',
  repair_tension: 'Repair/Tension', unknown: 'Not Yet Assessed',
};
const HEALTH_COLORS: Record<string, string> = {
  stable: brand.success, positive: '#34D399', quiet_but_ok: '#94A3B8',
  needs_attention: brand.warning, care_followup: brand.accent,
  repair_tension: brand.danger, unknown: '#64748B',
};

export default function PortfolioScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { session } = useAuth();

  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchPortfolio(session);
      setData(result);
    } catch { /* empty */ }
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function daysSince(dateStr: string | null): string {
    if (!dateStr) return 'Never contacted';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Relationship Portfolio', headerBackTitle: 'Back' }} />
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Relationship Portfolio', headerBackTitle: 'Back' }} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Unable to load portfolio data</Text>
      </View>
    );
  }

  const domainTotal = data.domainBalance.work + data.domainBalance.personal + data.domainBalance.other_strategic;
  const healthTotal = Object.values(data.healthDistribution).reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
    >
      <Stack.Screen options={{ title: 'Relationship Portfolio', headerBackTitle: 'Back' }} />

      {/* Overview */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Portfolio Overview</Text>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
          A qualitative view of your relationships — no scores, no rankings.
        </Text>
        <View style={styles.overviewRow}>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, { color: brand.primary }]}>{data.totalPeople}</Text>
            <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>People</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, { color: brand.accent }]}>{data.totalSignals}</Text>
            <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>Signals</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, { color: brand.success }]}>
              {data.dataConfidence.total > 0
                ? Math.round((data.dataConfidence.highConfidence / data.dataConfidence.total) * 100)
                : 0}%
            </Text>
            <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>Confidence</Text>
          </View>
        </View>
      </View>

      {/* Domain Balance */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DOMAIN BALANCE</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.barChart}>
          {Object.entries(data.domainBalance).map(([domain, count]) => {
            const pct = domainTotal > 0 ? (count / domainTotal) * 100 : 0;
            return (
              <View key={domain} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: colors.text }]}>{DOMAIN_LABELS[domain] ?? domain}</Text>
                <View style={[styles.barTrack, { backgroundColor: colors.surfaceBorder }]}>
                  <View style={[styles.barFill, { backgroundColor: DOMAIN_COLORS[domain] ?? brand.primary, width: `${Math.max(pct, 4)}%` as `${number}%` }]} />
                </View>
                <Text style={[styles.barValue, { color: colors.textSecondary }]}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Relationship Health */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>RELATIONSHIP HEALTH</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        {healthTotal === 0 ? (
          <View style={styles.emptySection}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No relationship states computed yet. Record interactions to build signal data.
            </Text>
          </View>
        ) : (
          <View style={styles.chipGrid}>
            {Object.entries(data.healthDistribution).map(([state, count]) => (
              <View key={state} style={[styles.healthChip, { borderColor: (HEALTH_COLORS[state] ?? '#64748B') + '44' }]}>
                <View style={[styles.healthDot, { backgroundColor: HEALTH_COLORS[state] ?? '#64748B' }]} />
                <Text style={[styles.healthLabel, { color: colors.text }]}>{HEALTH_LABELS[state] ?? state}</Text>
                <Text style={[styles.healthCount, { color: colors.textSecondary }]}>{count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Data Confidence */}
      {data.dataConfidence.lowConfidence > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DATA CONFIDENCE</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <View style={styles.confidenceSection}>
              <Text style={[styles.confidenceText, { color: colors.textSecondary }]}>
                {data.dataConfidence.lowConfidence} of {data.dataConfidence.total} relationship{data.dataConfidence.total === 1 ? '' : 's'} ha{data.dataConfidence.lowConfidence === 1 ? 's' : 've'} low-confidence
                assessments. Record more interactions to improve accuracy.
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Dormant Relationships */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>WORTH REVISITING</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        {data.dormantCandidates.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No dormant relationships detected. You're staying connected.
            </Text>
          </View>
        ) : (
          data.dormantCandidates.map((person, idx) => (
            <TouchableOpacity
              key={person.id}
              style={[
                styles.dormantRow,
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
              ]}
              onPress={() => router.push(`/person/${person.id}`)}
            >
              <View style={[styles.dormantAvatar, { backgroundColor: brand.primary + '18' }]}>
                <Text style={[styles.dormantAvatarText, { color: brand.primary }]}>
                  {person.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dormantName, { color: colors.text }]}>{person.name}</Text>
                <Text style={[styles.dormantMeta, { color: colors.textSecondary }]}>
                  {daysSince(person.last_interaction_at)}
                  {person.dormancy_state === 'reactivation_candidate' ? ' · Reactivation candidate' : ''}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 20, marginLeft: 4 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  cardTitle: { fontSize: 18, fontWeight: '700', padding: 16, paddingBottom: 4 },
  cardDesc: { fontSize: 13, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 12 },
  overviewRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewValue: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  overviewLabel: { fontSize: 11 },
  barChart: { padding: 16, gap: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 70, fontSize: 13, fontWeight: '600' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { width: 28, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  healthChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthLabel: { fontSize: 12, fontWeight: '600' },
  healthCount: { fontSize: 12, fontWeight: '700' },
  confidenceSection: { padding: 16 },
  confidenceText: { fontSize: 13, lineHeight: 20 },
  emptySection: { padding: 16 },
  emptyText: { fontSize: 13, lineHeight: 20 },
  dormantRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  dormantAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dormantAvatarText: { fontSize: 16, fontWeight: '700' },
  dormantName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  dormantMeta: { fontSize: 12 },
  chevron: { fontSize: 22, fontWeight: '300' },
});
