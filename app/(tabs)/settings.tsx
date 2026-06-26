import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import { sendEventInvite } from '@/lib/api';
import type { CalendarEvent, EventAttendee } from '@/lib/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

interface UpcomingEvent extends CalendarEvent {
  attendees: EventAttendee[];
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, profile, session, signOut } = useAuth();

  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  const loadUpcomingEvents = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const { data: evts } = await supabase
      .from('lifeos_events')
      .select('*')
      .eq('owner_id', user.id)
      .gte('start_at', now)
      .order('start_at', { ascending: true })
      .limit(10);

    if (!evts || evts.length === 0) {
      setEvents([]);
      setLoadingEvents(false);
      return;
    }

    const eventIds = evts.map(e => e.id);
    const { data: attendees } = await supabase
      .from('lifeos_event_attendees')
      .select('*')
      .in('event_id', eventIds);

    const withAttendees: UpcomingEvent[] = evts.map(e => ({
      ...e,
      attendees: (attendees ?? []).filter(a => a.event_id === e.id),
    }));

    setEvents(withAttendees);
    setLoadingEvents(false);
  }, [user]);

  useEffect(() => { loadUpcomingEvents(); }, [loadUpcomingEvents]);

  async function onRefresh() {
    setRefreshing(true);
    await loadUpcomingEvents();
    setRefreshing(false);
  }

  async function handleSendInvite(eventId: string, attendee: EventAttendee) {
    setSendingInvite(attendee.id);
    try {
      if (!session) throw new Error('Please sign in again');
      const result = await sendEventInvite({ eventId, attendeeId: attendee.id }, session);
      if (result.delivery === 'sent') {
        Alert.alert('Sent', `Invite emailed to ${attendee.email}`);
      } else {
        await Share.share({
          message: `You're invited! RSVP here: ${result.inviteUrl}`,
          url: result.inviteUrl,
        });
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setSendingInvite(null);
    }
  }

  async function handleShareEventLink(event: CalendarEvent) {
    const found = events.find(e => e.id === event.id);
    const firstAttendee = found?.attendees.find(a => a.invite_token);
    if (firstAttendee?.invite_token) {
      const url = `${API_URL}/invite/${firstAttendee.invite_token}`;
      await Share.share({ message: `${event.title} — RSVP: ${url}`, url });
    } else {
      const icsUrl = `${API_URL}/api/ics/${event.id}`;
      await Share.share({ message: `${event.title} — Add to calendar: ${icsUrl}`, url: icsUrl });
    }
  }

  async function handleShareApp() {
    await Share.share({
      message: 'Check out Life OS — a personal relationship and life management app. https://lifeos.lexitools.tech',
    });
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
    >
      {/* Account */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.accountRow}>
          <View style={[styles.accountAvatar, { backgroundColor: brand.primary + '22' }]}>
            <Text style={[styles.accountAvatarText, { color: brand.primary }]}>
              {(profile?.display_name ?? user?.email ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={[styles.accountName, { color: colors.text }]}>{profile?.display_name ?? 'User'}</Text>
            <Text style={[styles.accountEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* Invite Links */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>INVITE LINKS</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <TouchableOpacity style={styles.menuRow} onPress={handleShareApp}>
          <Text style={styles.menuIcon}>🔗</Text>
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Share Life OS</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Invite someone to try the app</Text>
          </View>
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>

        {loadingEvents ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.tint} />
          </View>
        ) : events.length === 0 ? (
          <View style={styles.emptyInvites}>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>No upcoming events to invite to</Text>
          </View>
        ) : (
          events.map(event => (
            <View key={event.id} style={[styles.eventBlock, { borderTopColor: colors.surfaceBorder }]}>
              <View style={styles.eventHeader}>
                <TouchableOpacity style={styles.eventTitleRow} onPress={() => router.push(`/event/${event.id}`)}>
                  <Text style={styles.menuIcon}>📅</Text>
                  <View style={styles.menuInfo}>
                    <Text style={[styles.menuLabel, { color: colors.text }]} numberOfLines={1}>{event.title}</Text>
                    <Text style={[styles.menuSub, { color: colors.textSecondary }]}>{formatDate(event.start_at)}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareBtn, { borderColor: colors.surfaceBorder }]}
                  onPress={() => handleShareEventLink(event)}
                >
                  <Text style={{ fontSize: 14 }}>📤</Text>
                </TouchableOpacity>
              </View>

              {event.attendees.length > 0 && (
                <View style={styles.attendeeList}>
                  {event.attendees.map(att => (
                    <View key={att.id} style={[styles.attendeeRow, { borderColor: colors.surfaceBorder }]}>
                      <View style={[styles.attendeeDot, { backgroundColor: rsvpColor(att.rsvp_status) }]} />
                      <Text style={[styles.attendeeName, { color: colors.text }]} numberOfLines={1}>
                        {att.name ?? att.email ?? 'Guest'}
                      </Text>
                      <Text style={[styles.rsvpBadge, { color: colors.textSecondary }]}>{att.rsvp_status}</Text>
                      {att.invite_token && (
                        <TouchableOpacity
                          style={[styles.sendBtn, { backgroundColor: brand.primary + '18' }]}
                          onPress={() => handleSendInvite(event.id, att)}
                          disabled={sendingInvite === att.id}
                        >
                          {sendingInvite === att.id ? (
                            <ActivityIndicator size="small" color={brand.primary} />
                          ) : (
                            <Text style={[styles.sendBtnText, { color: brand.primary }]}>
                              {att.email ? 'Send' : 'Share'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Quick Links */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>QUICK LINKS</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/stats')}>
          <Text style={styles.menuIcon}>📊</Text>
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Interaction Stats</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>See who you interact with most</Text>
          </View>
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ABOUT</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.menuRow}>
          <Text style={styles.menuIcon}>📱</Text>
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Life OS</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>v1.0.0 · Companion: {API_URL ? 'Connected' : 'Not configured'}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.signOutBtn, { borderColor: brand.danger + '44' }]}
        onPress={handleSignOut}
      >
        <Text style={[styles.signOutText, { color: brand.danger }]}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function rsvpColor(status: string) {
  switch (status) {
    case 'accepted': return brand.success;
    case 'declined': return brand.danger;
    case 'tentative': return brand.warning;
    default: return '#94A3B8';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 20, marginLeft: 4 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  accountRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  accountAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  accountAvatarText: { fontSize: 18, fontWeight: '700' },
  accountInfo: { marginLeft: 14, flex: 1 },
  accountName: { fontSize: 16, fontWeight: '600' },
  accountEmail: { fontSize: 13, marginTop: 2 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  menuIcon: { fontSize: 20, width: 30 },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '500' },
  menuSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '300' },
  loadingRow: { padding: 20, alignItems: 'center' },
  emptyInvites: { paddingHorizontal: 16, paddingBottom: 14 },
  eventBlock: { borderTopWidth: StyleSheet.hairlineWidth },
  eventHeader: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  eventTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  shareBtn: { borderWidth: 1, borderRadius: 8, padding: 8 },
  attendeeList: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8, gap: 8 },
  attendeeDot: { width: 8, height: 8, borderRadius: 4 },
  attendeeName: { flex: 1, fontSize: 13, fontWeight: '500' },
  rsvpBadge: { fontSize: 11, textTransform: 'capitalize' },
  sendBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  sendBtnText: { fontSize: 12, fontWeight: '600' },
  signOutBtn: { marginTop: 24, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  signOutText: { fontSize: 15, fontWeight: '600' },
});
