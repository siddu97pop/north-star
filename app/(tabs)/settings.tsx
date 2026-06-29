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
  Switch,
  TextInput,
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

interface PendingUser {
  id: string;
  display_name: string;
  email?: string;
  created_at: string;
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, profile, session, signOut } = useAuth();

  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [managingUser, setManagingUser] = useState<string | null>(null);

  const [globalAllowAI, setGlobalAllowAI] = useState(true);
  const [globalSensitiveBriefing, setGlobalSensitiveBriefing] = useState(false);
  const [globalBriefingDepth, setGlobalBriefingDepth] = useState('standard');
  const [savingGlobal, setSavingGlobal] = useState(false);

  const [aiRecsEnabled, setAiRecsEnabled] = useState(true);
  const [scoringMode, setScoringMode] = useState('qualitative');
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

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

  const loadPendingUsers = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoadingPending(true);
    const { data } = await supabase
      .from('lifeos_profiles')
      .select('id, display_name, created_at')
      .eq('role', 'pending')
      .order('created_at', { ascending: true });
    setPendingUsers(data ?? []);
    setLoadingPending(false);
  }, [profile?.role]);

  useEffect(() => { loadPendingUsers(); }, [loadPendingUsers]);

  const loadGlobalDefaults = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('lifeos_person_preferences')
      .select('allow_ai_suggestions, allow_sensitive_in_briefings, briefing_depth')
      .eq('owner_id', user.id)
      .eq('person_id', '00000000-0000-0000-0000-000000000000');

    if (data && data.length > 0) {
      setGlobalAllowAI(data[0].allow_ai_suggestions);
      setGlobalSensitiveBriefing(data[0].allow_sensitive_in_briefings);
      setGlobalBriefingDepth(data[0].briefing_depth);
    }
  }, [user]);

  useEffect(() => { loadGlobalDefaults(); }, [loadGlobalDefaults]);

  const loadProfilePrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('lifeos_profiles')
      .select('ai_recommendations_enabled, default_scoring_mode_personal, notification_quiet_hours_start, notification_quiet_hours_end')
      .eq('id', user.id)
      .single();
    if (data) {
      setAiRecsEnabled(data.ai_recommendations_enabled ?? true);
      setScoringMode(data.default_scoring_mode_personal ?? 'qualitative');
      setQuietStart(data.notification_quiet_hours_start ?? '');
      setQuietEnd(data.notification_quiet_hours_end ?? '');
    }
  }, [user]);

  useEffect(() => { loadProfilePrefs(); }, [loadProfilePrefs]);

  async function handleSaveGlobalDefaults() {
    if (!user) return;
    setSavingGlobal(true);
    const globalId = '00000000-0000-0000-0000-000000000000';
    const payload = {
      person_id: globalId,
      owner_id: user.id,
      allow_ai_suggestions: globalAllowAI,
      allow_sensitive_in_briefings: globalSensitiveBriefing,
      briefing_depth: globalBriefingDepth,
      reminder_policy: 'normal',
      boundary_state: 'none',
    };

    const { data: existing } = await supabase
      .from('lifeos_person_preferences')
      .select('id')
      .eq('owner_id', user.id)
      .eq('person_id', globalId);

    if (existing && existing.length > 0) {
      await supabase
        .from('lifeos_person_preferences')
        .update(payload)
        .eq('id', existing[0].id);
    } else {
      await supabase
        .from('lifeos_person_preferences')
        .insert(payload);
    }

    await supabase.from('lifeos_audit_events').insert({
      owner_id: user.id,
      actor_type: 'user',
      event_type: 'global_sensitivity_defaults_updated',
      object_type: 'person_preferences',
      object_id: globalId,
      event_summary: 'Global sensitivity defaults saved',
    });

    setSavingGlobal(false);
    Alert.alert('Saved', 'Global sensitivity defaults updated.');
  }

  async function handleSaveProfilePrefs() {
    if (!user) return;
    setSavingPrefs(true);

    const update: Record<string, unknown> = {
      ai_recommendations_enabled: aiRecsEnabled,
      default_scoring_mode_personal: scoringMode,
    };
    if (quietStart) update.notification_quiet_hours_start = quietStart;
    else update.notification_quiet_hours_start = null;
    if (quietEnd) update.notification_quiet_hours_end = quietEnd;
    else update.notification_quiet_hours_end = null;

    await supabase
      .from('lifeos_profiles')
      .update(update)
      .eq('id', user.id);

    await supabase.from('lifeos_audit_events').insert({
      owner_id: user.id,
      actor_type: 'user',
      event_type: 'profile_preferences_updated',
      object_type: 'profile',
      object_id: user.id,
      event_summary: `AI recs=${aiRecsEnabled}, scoring=${scoringMode}, quiet=${quietStart || 'off'}-${quietEnd || 'off'}`,
    });

    setSavingPrefs(false);
    Alert.alert('Saved', 'AI and notification preferences updated.');
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadUpcomingEvents(), loadPendingUsers(), loadGlobalDefaults(), loadProfilePrefs()]);
    setRefreshing(false);
  }

  async function handleApprove(pendingUser: PendingUser) {
    Alert.alert(
      `Approve ${pendingUser.display_name}`,
      'Choose a role for this user:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Family', onPress: () => submitManage(pendingUser.id, 'approve', 'family') },
        { text: 'Friend', onPress: () => submitManage(pendingUser.id, 'approve', 'friend') },
        { text: 'Member', onPress: () => submitManage(pendingUser.id, 'approve', 'member') },
      ]
    );
  }

  async function handleReject(pendingUser: PendingUser) {
    Alert.alert(
      'Reject user',
      `Remove ${pendingUser.display_name}'s account permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => submitManage(pendingUser.id, 'reject'),
        },
      ]
    );
  }

  async function submitManage(userId: string, action: 'approve' | 'reject', role?: string) {
    if (!session) return;
    setManagingUser(userId);
    try {
      const res = await fetch(`${API_URL}/api/auth/manage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setManagingUser(null);
    }
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
    const joinUrl = `${API_URL}/join`;
    await Share.share({
      message: `Join Life OS — sign up here: ${joinUrl}`,
      url: joinUrl,
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

      {/* Pending Users — admin only */}
      {profile?.role === 'admin' && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PENDING USERS</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            {loadingPending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.tint} />
              </View>
            ) : pendingUsers.length === 0 ? (
              <View style={styles.emptyInvites}>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>No pending sign-ups</Text>
              </View>
            ) : (
              pendingUsers.map((pu, idx) => (
                <View
                  key={pu.id}
                  style={[
                    styles.pendingRow,
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
                  ]}
                >
                  <View style={[styles.accountAvatar, { backgroundColor: brand.warning + '22' }]}>
                    <Text style={[styles.accountAvatarText, { color: brand.warning }]}>
                      {pu.display_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={[styles.menuLabel, { color: colors.text }]}>{pu.display_name}</Text>
                    <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                      Joined {new Date(pu.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  {managingUser === pu.id ? (
                    <ActivityIndicator size="small" color={colors.tint} />
                  ) : (
                    <View style={styles.pendingActions}>
                      <TouchableOpacity
                        style={[styles.approveBtn, { backgroundColor: brand.success + '22' }]}
                        onPress={() => handleApprove(pu)}
                      >
                        <Text style={[styles.approveBtnText, { color: brand.success }]}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rejectBtn, { borderColor: brand.danger + '44' }]}
                        onPress={() => handleReject(pu)}
                      >
                        <Text style={[styles.rejectBtnText, { color: brand.danger }]}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </>
      )}

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

      {/* Sensitivity & Privacy */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SENSITIVITY & PRIVACY</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.sensitivitySection}>
          <Text style={[styles.sensitivityDesc, { color: colors.textSecondary }]}>
            These defaults apply to all people unless overridden in their individual preferences.
          </Text>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Allow AI suggestions</Text>
              <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                AI can suggest actions and recommendations
              </Text>
            </View>
            <Switch value={globalAllowAI} onValueChange={setGlobalAllowAI} trackColor={{ true: brand.primary }} />
          </View>

          <View style={[styles.switchRow, { marginTop: 14 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Include sensitive in briefings</Text>
              <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                Show sensitive notes in pre-conversation briefings
              </Text>
            </View>
            <Switch value={globalSensitiveBriefing} onValueChange={setGlobalSensitiveBriefing} trackColor={{ true: brand.primary }} />
          </View>

          <View style={{ marginTop: 14 }}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Default briefing depth</Text>
            <View style={[styles.depthRow, { marginTop: 8 }]}>
              {['minimal', 'standard', 'detailed'].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.depthChip,
                    { borderColor: colors.surfaceBorder },
                    globalBriefingDepth === d && { backgroundColor: brand.primary + '22', borderColor: brand.primary },
                  ]}
                  onPress={() => setGlobalBriefingDepth(d)}
                >
                  <Text style={[
                    styles.depthChipText,
                    { color: colors.textSecondary },
                    globalBriefingDepth === d && { color: brand.primary },
                  ]}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: brand.primary }]}
            onPress={handleSaveGlobalDefaults}
            disabled={savingGlobal}
          >
            <Text style={styles.saveBtnText}>{savingGlobal ? 'Saving...' : 'Save Defaults'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Privacy Controls */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PRIVACY CONTROLS</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/export')}>
          <Text style={styles.menuIcon}>📦</Text>
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Export Data</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Download a JSON copy of your data</Text>
          </View>
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder }]} onPress={() => router.push('/audit')}>
          <Text style={styles.menuIcon}>📋</Text>
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Audit Log</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Review all changes made to your data</Text>
          </View>
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* AI Preferences */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>AI PREFERENCES</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.sensitivitySection}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>AI recommendations</Text>
              <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                Enable or disable all AI-generated suggestions
              </Text>
            </View>
            <Switch value={aiRecsEnabled} onValueChange={setAiRecsEnabled} trackColor={{ true: brand.primary }} />
          </View>

          <View style={{ marginTop: 14 }}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Default scoring mode</Text>
            <View style={[styles.depthRow, { marginTop: 8 }]}>
              {['qualitative', 'quantitative'].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.depthChip,
                    { borderColor: colors.surfaceBorder },
                    scoringMode === m && { backgroundColor: brand.primary + '22', borderColor: brand.primary },
                  ]}
                  onPress={() => setScoringMode(m)}
                >
                  <Text style={[
                    styles.depthChipText,
                    { color: colors.textSecondary },
                    scoringMode === m && { color: brand.primary },
                  ]}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Notification Preferences */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTIFICATION PREFERENCES</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.sensitivitySection}>
          <Text style={[styles.sensitivityDesc, { color: colors.textSecondary }]}>
            Set quiet hours to suppress non-urgent notifications. Use 24-hour format (e.g. 22:00).
          </Text>
          <View style={styles.quietRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchDesc, { color: colors.textSecondary, marginBottom: 4 }]}>Start</Text>
              <TextInput
                style={[styles.timeInput, { color: colors.text, borderColor: colors.surfaceBorder }]}
                value={quietStart}
                onChangeText={setQuietStart}
                placeholder="22:00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchDesc, { color: colors.textSecondary, marginBottom: 4 }]}>End</Text>
              <TextInput
                style={[styles.timeInput, { color: colors.text, borderColor: colors.surfaceBorder }]}
                value={quietEnd}
                onChangeText={setQuietEnd}
                placeholder="07:00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: brand.primary }]}
            onPress={handleSaveProfilePrefs}
            disabled={savingPrefs}
          >
            <Text style={styles.saveBtnText}>{savingPrefs ? 'Saving...' : 'Save Preferences'}</Text>
          </TouchableOpacity>
        </View>
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
  pendingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  pendingInfo: { flex: 1 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  approveBtnText: { fontSize: 12, fontWeight: '700' },
  rejectBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  rejectBtnText: { fontSize: 12, fontWeight: '600' },
  sensitivitySection: { padding: 16 },
  sensitivityDesc: { fontSize: 12, marginBottom: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  switchDesc: { fontSize: 12, marginTop: 2 },
  depthRow: { flexDirection: 'row', gap: 8 },
  depthChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  depthChipText: { fontSize: 12, fontWeight: '600' },
  saveBtn: { height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  quietRow: { flexDirection: 'row', gap: 12 },
  timeInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: '500' },
});
