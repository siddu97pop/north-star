import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { sendEventInvite } from '@/lib/api';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { CalendarEvent, EventAttendee } from '@/lib/types';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { session } = useAuth();

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const [eventRes, attendeeRes] = await Promise.all([
      supabase.from('lifeos_events').select('*').eq('id', id).single(),
      supabase.from('lifeos_event_attendees').select('*').eq('event_id', id).order('invited_at'),
    ]);

    if (eventRes.data) setEvent(eventRes.data);
    if (attendeeRes.data) setAttendees(attendeeRes.data);
    setLoading(false);
  }

  async function handleDelete() {
    Alert.alert('Delete Event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('lifeos_events').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

  async function handleAddAttendee() {
    if (!newEmail.trim() && !newName.trim()) return;

    const inviteToken = Crypto.randomUUID().replace(/-/g, '');
    const { data } = await supabase
      .from('lifeos_event_attendees')
      .insert({
        event_id: id,
        name: newName.trim() || null,
        email: newEmail.trim().toLowerCase() || null,
        invite_token: inviteToken,
      })
      .select('*')
      .single();

    if (data) {
      setAttendees((prev) => [...prev, data]);
    }

    setNewName('');
    setNewEmail('');
    setShowAdd(false);
  }

  async function handleSendInvite(attendee: EventAttendee) {
    setSendingId(attendee.id);

    try {
      const result = await sendEventInvite({ eventId: id, attendeeId: attendee.id }, session);
      Alert.alert(
        result.delivery === 'sent' ? 'Invite Sent' : 'Invite Prepared',
        `${attendee.email ?? attendee.name ?? 'Attendee'}\n\nRSVP: ${result.inviteUrl}\nICS: ${result.icsUrl}`
      );
    } catch (error) {
      Alert.alert('Invite Send Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSendingId(null);
    }
  }

  const recurrenceLabel = useMemo(() => {
    if (!event?.rrule) return 'Does not repeat';
    if (typeof event.metadata?.recurrence_label === 'string') return event.metadata.recurrence_label;
    if (event.rrule.includes('DAILY')) return 'Daily';
    if (event.rrule.includes('WEEKLY')) return 'Weekly';
    if (event.rrule.includes('MONTHLY')) return 'Monthly';
    return event.rrule;
  }, [event]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Event not found</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={[styles.colorBar, { backgroundColor: event.color ?? brand.primary }]} />

        <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>When</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {event.all_day
              ? new Date(event.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : `${new Date(event.start_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – ${new Date(event.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </Text>
        </View>

        {event.location ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Where</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{event.location}</Text>
          </View>
        ) : null}

        {event.description ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Notes</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{event.description}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Visibility</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {event.visibility.charAt(0).toUpperCase() + event.visibility.slice(1)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Recurrence</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{recurrenceLabel}</Text>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Attendees</Text>
              <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
                Add people now, then send RSVP links from the companion API.
              </Text>
            </View>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: brand.primary }]} onPress={() => setShowAdd(true)}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {attendees.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No attendees yet</Text>
          ) : (
            attendees.map((attendee) => (
              <View key={attendee.id} style={[styles.attendeeRow, { borderColor: colors.surfaceBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.attendeeName, { color: colors.text }]}>
                    {attendee.name || attendee.email || 'Unnamed attendee'}
                  </Text>
                  <Text style={[styles.attendeeMeta, { color: colors.textSecondary }]}>
                    {attendee.email ?? 'No email'}
                    {' · '}
                    {attendee.rsvp_status}
                  </Text>
                </View>
                {attendee.email ? (
                  <TouchableOpacity
                    style={[styles.inviteBtn, { borderColor: colors.surfaceBorder }]}
                    onPress={() => handleSendInvite(attendee)}
                    disabled={sendingId === attendee.id}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600' }}>
                      {sendingId === attendee.id ? 'Sending...' : 'Send Invite'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={[styles.deleteBtn, { borderColor: brand.danger }]} onPress={handleDelete}>
          <Text style={{ color: brand.danger, fontWeight: '600' }}>Delete Event</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Attendee</Text>

            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Ahmed"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="ahmed@example.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.surfaceBorder, borderWidth: 1 }]}
                onPress={() => setShowAdd(false)}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: brand.primary }]} onPress={handleAddAttendee}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  colorBar: { height: 4, borderRadius: 2, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  infoRow: { marginBottom: 16 },
  infoLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 16, lineHeight: 24 },
  sectionCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionHint: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  attendeeName: { fontSize: 15, fontWeight: '600' },
  attendeeMeta: { fontSize: 13, marginTop: 3 },
  inviteBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  empty: { fontSize: 14 },
  deleteBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '75%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 40 },
  modalBtn: { flex: 1, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
