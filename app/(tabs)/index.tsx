import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import ActionItemCard from '@/components/ActionItemCard';
import RecommendationCard from '@/components/RecommendationCard';
import { acceptRecommendation, decideRecommendation, loadRecommendations } from '@/lib/recommendations';
import type { ActionItem, CalendarEvent, Person, Recommendation, RecommendationEvidence, VoiceNote } from '@/lib/types';

interface PendingCounts {
  extractions: number;
  actions: number;
  signals: number;
  milestones: number;
  recommendations: number;
  total: number;
}

export default function TodayScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [highAttention, setHighAttention] = useState<Pick<Person, 'id' | 'name' | 'attention_tier' | 'last_interaction_at'>[]>([]);
  const [pending, setPending] = useState<PendingCounts>({ extractions: 0, actions: 0, signals: 0, milestones: 0, recommendations: 0, total: 0 });
  const [sensitiveReviewCount, setSensitiveReviewCount] = useState(0);

  const loadDashboard = useCallback(async () => {
    if (!user) return;

    const now = new Date();
    const weekAhead = new Date();
    weekAhead.setDate(now.getDate() + 7);

    const [eventsRes, notesRes, actionsRes, pendingExtRes, highAttRes, pendingActionsRes, pendingSignalsRes, pendingMilestonesRes, activeRecsRes, sensitiveRes] = await Promise.all([
      supabase
        .from('lifeos_events')
        .select('*')
        .gte('start_at', now.toISOString())
        .lte('start_at', weekAhead.toISOString())
        .order('start_at')
        .limit(8),
      supabase
        .from('lifeos_voice_notes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('lifeos_action_items')
        .select('*, person:lifeos_people(id,name)')
        .eq('owner_id', user.id)
        .in('commitment_certainty', ['c5_explicit', 'c4_agreed'])
        .in('status', ['accepted', 'active', 'snoozed', 'deferred', 'blocked'])
        .is('deleted_at', null)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(6),
      supabase
        .from('lifeos_interaction_extractions')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('review_status', 'pending'),
      supabase
        .from('lifeos_people')
        .select('id, name, attention_tier, last_interaction_at')
        .eq('owner_id', user.id)
        .in('attention_tier', ['high_attention', 'needs_attention'])
        .eq('is_archived', false)
        .is('deleted_at', null)
        .order('last_interaction_at', { ascending: true, nullsFirst: true })
        .limit(6),
      supabase
        .from('lifeos_action_items')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('confirmation_status', 'suggested')
        .is('deleted_at', null),
      supabase
        .from('lifeos_relationship_signals')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('confirmation_status', 'suggested')
        .is('deleted_at', null),
      supabase
        .from('lifeos_milestones')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('confirmation_status', 'suggested')
        .is('deleted_at', null),
      supabase
        .from('lifeos_recommendations')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('state', 'active')
        .is('deleted_at', null),
      supabase
        .from('lifeos_sensitive_memories')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('storage_consent_status', 'pending')
        .is('deleted_at', null),
    ]);

    if (eventsRes.data) setEvents(eventsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (actionsRes.data) setActions(actionsRes.data as ActionItem[]);
    if (highAttRes.data) setHighAttention(highAttRes.data as Pick<Person, 'id' | 'name' | 'attention_tier' | 'last_interaction_at'>[]);
    setRecommendations(await loadRecommendations(undefined, 3).catch(() => []));
    setSensitiveReviewCount(sensitiveRes.count ?? 0);

    const extCount = pendingExtRes.count ?? 0;
    const actCount = pendingActionsRes.count ?? 0;
    const sigCount = pendingSignalsRes.count ?? 0;
    const milCount = pendingMilestonesRes.count ?? 0;
    const recCount = activeRecsRes.count ?? 0;
    setPending({
      extractions: extCount,
      actions: actCount,
      signals: sigCount,
      milestones: milCount,
      recommendations: recCount,
      total: extCount + actCount + sigCount + milCount + recCount,
    });

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function onRefresh() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  function formatNoteStatus(status: VoiceNote['status']) {
    switch (status) {
      case 'complete': return 'Ready';
      case 'failed': return 'Failed';
      case 'uploaded': return 'Queued';
      case 'transcribing': return 'Transcribing';
      case 'extracting': return 'Extracting';
      default: return 'Uploading';
    }
  }

  function daysSince(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  }

  async function acceptSuggestion(item: Recommendation) {
    if (!user) return;
    const run = async () => {
      try {
        await acceptRecommendation(item, user.id);
        setRecommendations(prev => prev.filter(r => r.id !== item.id));
      } catch {
        router.push('/recommendations');
      }
    };
    if (item.agency_level === 'ask_confirmation') {
      Alert.alert('Confirm suggestion', 'Accepting creates only the action or reminder shown. Nothing is sent automatically.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: run },
      ]);
    } else await run();
  }

  async function snoozeSuggestion(item: Recommendation) {
    if (!user) return;
    try {
      await decideRecommendation(item, user.id, 'snoozed');
      setRecommendations(prev => prev.filter(r => r.id !== item.id));
    } catch {
      router.push('/recommendations');
    }
  }

  function openEvidence(item: Recommendation, evidence: RecommendationEvidence) {
    if (evidence.evidence_object_type === 'interaction') router.push(`/interaction/${evidence.evidence_object_id}`);
    else if (evidence.evidence_object_type === 'action_item') router.push('/actions');
    else if (item.person_id) router.push(`/person/${item.person_id}`);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
    >
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.heroEyebrow, { color: brand.primaryLight }]}>Life OS</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          {profile?.display_name ? `Good to see you, ${profile.display_name}` : 'Your day at a glance'}
        </Text>
        <Text style={[styles.heroBody, { color: colors.textSecondary }]}>
          A calm view of promises, conversations, and notes that deserve your attention.
        </Text>
      </View>

      <View style={styles.metricRow}>
        <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.metricValue, { color: brand.primaryLight }]}>{actions.length}</Text>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Commitments</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.metricValue, { color: brand.accent }]}>{events.length}</Text>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Conversations</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.metricValue, { color: brand.warning }]}>{pending.total}</Text>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Pending</Text>
        </View>
      </View>

      {pending.total > 0 && (
        <TouchableOpacity
          style={[styles.pendingBanner, { backgroundColor: brand.warning + '15', borderColor: brand.warning + '44' }]}
          onPress={() => router.push('/(tabs)/record')}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.pendingBannerText, { color: brand.warning }]}>
              {pending.total} item{pending.total === 1 ? '' : 's'} pending confirmation
            </Text>
            <Text style={[styles.pendingBreakdown, { color: brand.warning }]}>
              {[
                pending.extractions > 0 && `${pending.extractions} extraction${pending.extractions === 1 ? '' : 's'}`,
                pending.actions > 0 && `${pending.actions} action${pending.actions === 1 ? '' : 's'}`,
                pending.signals > 0 && `${pending.signals} signal${pending.signals === 1 ? '' : 's'}`,
                pending.milestones > 0 && `${pending.milestones} milestone${pending.milestones === 1 ? '' : 's'}`,
                pending.recommendations > 0 && `${pending.recommendations} suggestion${pending.recommendations === 1 ? '' : 's'}`,
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Text style={[styles.pendingBannerAction, { color: brand.warning }]}>Review →</Text>
        </TouchableOpacity>
      )}

      {sensitiveReviewCount > 0 && (
        <TouchableOpacity
          style={[styles.pendingBanner, { backgroundColor: brand.danger + '12', borderColor: brand.danger + '44' }]}
          onPress={() => router.push('/(tabs)/record')}
        >
          <Text style={[styles.pendingBannerText, { color: brand.danger }]}>
            {sensitiveReviewCount} sensitive memor{sensitiveReviewCount === 1 ? 'y' : 'ies'} awaiting consent
          </Text>
          <Text style={[styles.pendingBannerAction, { color: brand.danger }]}>Review →</Text>
        </TouchableOpacity>
      )}

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: brand.primary }]}
          onPress={() => router.push('/(tabs)/record')}
        >
          <Text style={styles.quickBtnText}>New Voice Note</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, styles.quickBtnSecondary, { borderColor: colors.surfaceBorder }]}
          onPress={() => router.push('/actions')}
        >
          <Text style={[styles.quickBtnTextSecondary, { color: colors.text }]}>Action Center</Text>
        </TouchableOpacity>
      </View>

      <SectionHeader title="Suggestions" action="Review all" onPress={() => router.push('/recommendations')} colors={colors} />
      <View style={styles.listGap}>
        {recommendations.length === 0 ? (
          <EmptyCard text="No evidence-based suggestions are waiting. Generate them from a person profile when you want a fresh review." colors={colors} />
        ) : recommendations.map(item => (
          <RecommendationCard
            key={item.id}
            recommendation={item}
            compact
            onAccept={() => acceptSuggestion(item)}
            onSnooze={() => snoozeSuggestion(item)}
            onEvidencePress={evidence => openEvidence(item, evidence)}
          />
        ))}
      </View>

      <SectionHeader title="Today's Commitments" action="View all" onPress={() => router.push('/actions')} colors={colors} />
      <View style={styles.listGap}>
        {actions.length === 0 ? (
          <EmptyCard text="No explicit commitments are due. Low-confidence ideas stay in review instead of becoming pressure." colors={colors} />
        ) : actions.map(action => <ActionItemCard key={action.id} item={action} compact />)}
      </View>

      <SectionHeader title="High Attention" action="People" onPress={() => router.push('/(tabs)/people')} colors={colors} />
      <View style={styles.listGap}>
        {highAttention.length === 0 ? (
          <EmptyCard text="No one currently needs extra attention. Relationships are looking healthy." colors={colors} />
        ) : highAttention.map(person => (
          <TouchableOpacity
            key={person.id}
            style={[styles.cardRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
            onPress={() => router.push(`/person/${person.id}`)}
          >
            <View style={[styles.personBadge, { backgroundColor: person.attention_tier === 'needs_attention' ? brand.warning + '22' : brand.primary + '22' }]}>
              <Text style={[styles.personBadgeText, { color: person.attention_tier === 'needs_attention' ? brand.warning : brand.primary }]}>
                {person.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{person.name}</Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {person.attention_tier === 'needs_attention' ? 'Needs attention' : 'High attention'} · Last: {daysSince(person.last_interaction_at)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <SectionHeader title="Upcoming Conversations" action="View all" onPress={() => router.push('/(tabs)/calendar')} colors={colors} />
      <View style={styles.listGap}>
        {events.length === 0 ? (
          <EmptyCard text="No events lined up yet. Add one from the Calendar tab." colors={colors} />
        ) : events.map(event => (
          <TouchableOpacity
            key={event.id}
            style={[styles.cardRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
            onPress={() => router.push(`/event/${event.id}`)}
          >
            <View style={[styles.eventAccent, { backgroundColor: event.color ?? brand.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{event.title}</Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {new Date(event.start_at).toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
                {event.location ? ` · ${event.location}` : ''}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <SectionHeader title="Recent Voice Notes" action="Record" onPress={() => router.push('/(tabs)/record')} colors={colors} />
      <View style={styles.listGap}>
        {notes.length === 0 ? (
          <EmptyCard text="Your recordings will appear here once you start capturing them." colors={colors} />
        ) : notes.map(note => (
          <TouchableOpacity
            key={note.id}
            style={[styles.cardRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
            onPress={() => router.push(`/voice/${note.id}`)}
          >
            <View style={[styles.noteDot, { backgroundColor: note.status === 'complete' ? brand.success : brand.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {new Date(note.created_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {formatNoteStatus(note.status)}
                {note.duration_secs ? ` · ${Math.floor(note.duration_secs / 60)}:${String(note.duration_secs % 60).padStart(2, '0')}` : ''}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

    </ScrollView>
  );
}

function SectionHeader({
  title, action, onPress, colors,
}: {
  title: string; action: string; onPress: () => void; colors: typeof Colors.light;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <TouchableOpacity onPress={onPress}>
        <Text style={[styles.sectionAction, { color: brand.primaryLight }]}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyCard({ text, colors }: { text: string; colors: typeof Colors.light }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  heroEyebrow: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  heroBody: { fontSize: 14, lineHeight: 22 },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metricCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14 },
  metricValue: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  metricLabel: { fontSize: 12 },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  quickBtn: { flex: 1, minHeight: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  quickBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1 },
  quickBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  quickBtnTextSecondary: { fontWeight: '700', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionAction: { fontSize: 13, fontWeight: '700' },
  listGap: { gap: 8, marginBottom: 18 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  eventAccent: { width: 10, alignSelf: 'stretch', borderRadius: 999 },
  noteDot: { width: 10, height: 10, borderRadius: 999 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cardMeta: { fontSize: 13, lineHeight: 18 },
  personBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  personBadgeText: { fontSize: 16, fontWeight: '800' },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
  emptyText: { fontSize: 14, lineHeight: 20 },
  pendingBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  pendingBannerText: { fontSize: 14, fontWeight: '600' },
  pendingBreakdown: { fontSize: 11, marginTop: 3, opacity: 0.8 },
  pendingBannerAction: { fontSize: 13, fontWeight: '700' },
});
