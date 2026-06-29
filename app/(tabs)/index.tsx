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
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { CalendarEvent, InteractionStat, VoiceNote } from '@/lib/types';

export default function TodayScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [stats, setStats] = useState<InteractionStat[]>([]);
  const [pendingReviews, setPendingReviews] = useState(0);

  const loadDashboard = useCallback(async () => {
    if (!user) return;

    const now = new Date();
    const weekAhead = new Date();
    weekAhead.setDate(now.getDate() + 7);

    const [eventsRes, notesRes, statsRes, pendingRes] = await Promise.all([
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
        .from('lifeos_v_interaction_stats')
        .select('*')
        .eq('owner_id', user.id)
        .order('this_month', { ascending: false })
        .limit(5),
      supabase
        .from('lifeos_interaction_extractions')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('review_status', 'pending'),
    ]);

    if (eventsRes.data) setEvents(eventsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (statsRes.data) setStats(statsRes.data);
    setPendingReviews(pendingRes.count ?? 0);
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
      case 'complete':
        return 'Ready';
      case 'failed':
        return 'Failed';
      case 'uploaded':
        return 'Queued';
      case 'transcribing':
        return 'Transcribing';
      case 'extracting':
        return 'Extracting';
      default:
        return 'Uploading';
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const completedNotes = notes.filter((note) => note.status === 'complete').length;
  const upcomingCount = events.length;
  const peopleTouched = stats.filter((item) => item.this_week > 0).length;

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
          Keep the calendar moving, capture conversations, and head into meetings with context.
        </Text>
      </View>

      <View style={styles.metricRow}>
        <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.metricValue, { color: brand.primaryLight }]}>{upcomingCount}</Text>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Next 7 Days</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.metricValue, { color: brand.accent }]}>{completedNotes}</Text>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Ready Notes</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.metricValue, { color: brand.warning }]}>{peopleTouched}</Text>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>People This Week</Text>
        </View>
      </View>

      {pendingReviews > 0 && (
        <TouchableOpacity
          style={[styles.pendingBanner, { backgroundColor: brand.warning + '15', borderColor: brand.warning + '44' }]}
          onPress={() => router.push('/(tabs)/record')}
        >
          <Text style={[styles.pendingBannerText, { color: brand.warning }]}>
            {pendingReviews} extraction{pendingReviews === 1 ? '' : 's'} pending review
          </Text>
          <Text style={[styles.pendingBannerAction, { color: brand.warning }]}>Review →</Text>
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
          onPress={() => router.push('/(tabs)/calendar')}
        >
          <Text style={[styles.quickBtnTextSecondary, { color: colors.text }]}>Open Calendar</Text>
        </TouchableOpacity>
      </View>

      <SectionHeader
        title="Upcoming Events"
        action="View all"
        onPress={() => router.push('/(tabs)/calendar')}
        colors={colors}
      />
      <View style={styles.listGap}>
        {events.length === 0 ? (
          <EmptyCard text="No events lined up yet. Add one from the Calendar tab." colors={colors} />
        ) : (
          events.map((event) => (
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
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {event.location ? ` · ${event.location}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <SectionHeader title="Recent Voice Notes" action="Record" onPress={() => router.push('/(tabs)/record')} colors={colors} />
      <View style={styles.listGap}>
        {notes.length === 0 ? (
          <EmptyCard text="Your recordings will appear here once you start capturing them." colors={colors} />
        ) : (
          notes.map((note) => (
            <TouchableOpacity
              key={note.id}
              style={[styles.cardRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
              onPress={() => router.push(`/voice/${note.id}`)}
            >
              <View style={[styles.noteDot, { backgroundColor: note.status === 'complete' ? brand.success : brand.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {new Date(note.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {formatNoteStatus(note.status)}
                  {note.duration_secs ? ` · ${Math.floor(note.duration_secs / 60)}:${String(note.duration_secs % 60).padStart(2, '0')}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <SectionHeader title="People To Reconnect With" action="People" onPress={() => router.push('/(tabs)/people')} colors={colors} />
      <View style={styles.listGap}>
        {stats.length === 0 ? (
          <EmptyCard text="As voice notes and events accumulate, your strongest relationships will surface here." colors={colors} />
        ) : (
          stats.map((stat) => (
            <TouchableOpacity
              key={stat.person_id}
              style={[styles.cardRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
              onPress={() => router.push(`/person/${stat.person_id}`)}
            >
              <View style={[styles.personBadge, { backgroundColor: brand.primaryLight + '22' }]}>
                <Text style={[styles.personBadgeText, { color: brand.primaryLight }]}>
                  {stat.person_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{stat.person_name}</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {stat.this_month} interaction{stat.this_month === 1 ? '' : 's'} this month
                  {stat.last_seen ? ` · last seen ${new Date(stat.last_seen).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function SectionHeader({
  title,
  action,
  onPress,
  colors,
}: {
  title: string;
  action: string;
  onPress: () => void;
  colors: typeof Colors.light;
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
  hero: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
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
  pendingBannerAction: { fontSize: 13, fontWeight: '700' },
});
