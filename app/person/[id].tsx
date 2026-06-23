import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchPersonBriefing } from '@/lib/api';
import { buildLocalBriefing } from '@/lib/briefing';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { CalendarEvent, Interaction, Person } from '@/lib/types';

const RELATIONSHIPS = ['family', 'friend', 'colleague', 'acquaintance', 'other'] as const;

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { session } = useAuth();

  const [person, setPerson] = useState<Person | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingSource, setBriefingSource] = useState<'anthropic' | 'fallback' | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const [editName, setEditName] = useState('');
  const [editRelationship, setEditRelationship] = useState<string>('friend');
  const [editCompany, setEditCompany] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const loadPerson = useCallback(async () => {
    const personRes = await supabase.from('lifeos_people').select('*').eq('id', id).single();

    if (personRes.data) {
      setPerson(personRes.data);
      setEditName(personRes.data.name);
      setEditRelationship(personRes.data.relationship ?? 'other');
      setEditCompany(personRes.data.company ?? '');
      setEditNotes(personRes.data.notes ?? '');

      const [interactionRes, attendeeRes] = await Promise.all([
        supabase
          .from('lifeos_interactions')
          .select('*')
          .eq('person_id', id)
          .order('interaction_date', { ascending: false })
          .limit(50),
        supabase
          .from('lifeos_event_attendees')
          .select('event_id')
          .or(
            [
              personRes.data.email ? `email.eq.${personRes.data.email}` : null,
              `name.ilike.${personRes.data.name}`,
            ]
              .filter(Boolean)
              .join(',')
          ),
      ]);

      if (interactionRes.data) setInteractions(interactionRes.data);

      const eventIds = (attendeeRes.data ?? []).map((item) => item.event_id);

      if (eventIds.length > 0) {
        const eventsRes = await supabase
          .from('lifeos_events')
          .select('*')
          .in('id', eventIds)
          .gte('start_at', new Date().toISOString())
          .order('start_at')
          .limit(5);

        if (eventsRes.data) setUpcomingEvents(eventsRes.data);
      } else {
        setUpcomingEvents([]);
      }
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadPerson();
  }, [loadPerson]);

  function relColor(rel: string | null) {
    switch (rel) {
      case 'family':
        return '#FF6B6B';
      case 'friend':
        return brand.primary;
      case 'colleague':
        return brand.accent;
      case 'acquaintance':
        return brand.warning;
      default:
        return colors.textSecondary;
    }
  }

  function sourceIcon(source: string) {
    switch (source) {
      case 'voice_note':
        return '🎙';
      case 'calendar_event':
        return '📅';
      default:
        return '✏️';
    }
  }

  async function handleSave() {
    if (!person || !editName.trim()) return;
    setSaving(true);

    const payload = {
      name: editName.trim(),
      normalized_name: editName.trim().toLowerCase(),
      relationship: editRelationship,
      company: editCompany.trim() || null,
      notes: editNotes.trim() || null,
    };

    const { data, error } = await supabase
      .from('lifeos_people')
      .update(payload)
      .eq('id', person.id)
      .select('*')
      .single();

    setSaving(false);

    if (error) {
      console.error('Failed to update person:', error);
      return;
    }

    if (data) setPerson(data);
    setShowEdit(false);
  }

  async function handleBriefMe() {
    if (!person) return;

    setBriefingLoading(true);

    try {
      const result = await fetchPersonBriefing(person.id, session);
      setBriefing(result.briefing);
      setBriefingSource(result.source);
    } catch (_error) {
      setBriefing(buildLocalBriefing({ person, interactions, upcomingEvents }));
      setBriefingSource('fallback');
    } finally {
      setBriefingLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!person) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Person not found</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={styles.headerSection}>
          <View style={[styles.avatar, { backgroundColor: relColor(person.relationship) + '22' }]}>
            <Text style={[styles.avatarText, { color: relColor(person.relationship) }]}>
              {person.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{person.name}</Text>
          {person.relationship ? (
            <View style={[styles.relBadge, { backgroundColor: relColor(person.relationship) + '22' }]}>
              <Text style={[styles.relBadgeText, { color: relColor(person.relationship) }]}>{person.relationship}</Text>
            </View>
          ) : null}
          {person.company ? <Text style={[styles.company, { color: colors.textSecondary }]}>{person.company}</Text> : null}
          <View style={styles.headerButtons}>
            <TouchableOpacity style={[styles.editBtn, { backgroundColor: brand.primary }]} onPress={() => setShowEdit(true)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editBtn, styles.briefBtn, { borderColor: colors.surfaceBorder }]} onPress={handleBriefMe}>
              <Text style={[styles.briefBtnText, { color: colors.text }]}>Brief Me</Text>
            </TouchableOpacity>
          </View>
        </View>

        {briefingLoading ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <ActivityIndicator color={brand.accent} />
            <Text style={[styles.briefingMeta, { color: colors.textSecondary, marginTop: 10 }]}>
              Building a meeting brief...
            </Text>
          </View>
        ) : briefing ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <View style={styles.briefingHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Briefing</Text>
              <Text style={[styles.briefingMeta, { color: colors.textSecondary }]}>
                {briefingSource === 'anthropic' ? 'AI summary' : 'Local fallback'}
              </Text>
            </View>
            <Text style={[styles.bodyText, { color: colors.text }]}>{briefing}</Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>{person.total_interactions}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Interactions</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>
              {person.last_interaction_at
                ? new Date(person.last_interaction_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Last Seen</Text>
          </View>
        </View>

        {upcomingEvents.length > 0 ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Shared Events</Text>
            {upcomingEvents.map((event) => (
              <View key={event.id} style={styles.inlineRow}>
                <Text style={[styles.inlineTitle, { color: colors.text }]}>{event.title}</Text>
                <Text style={[styles.inlineMeta, { color: colors.textSecondary }]}>
                  {new Date(event.start_at).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {person.notes ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text>
            <Text style={[styles.bodyText, { color: colors.text }]}>{person.notes}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 12 }]}>Interaction History</Text>
        {interactions.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>No interactions recorded yet</Text>
        ) : (
          interactions.map((item) => (
            <View key={item.id} style={[styles.interactionRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <Text style={styles.sourceIcon}>{sourceIcon(item.source)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.interactionCtx, { color: colors.text }]}>{item.context || item.source.replace('_', ' ')}</Text>
                <Text style={[styles.interactionDate, { color: colors.textSecondary }]}>
                  {new Date(item.interaction_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {item.topics.length > 0 ? ` · ${item.topics.join(', ')}` : ''}
                </Text>
              </View>
              {item.sentiment ? (
                <Text style={styles.sentiment}>
                  {item.sentiment === 'positive' ? '😊' : item.sentiment === 'negative' ? '😔' : item.sentiment === 'mixed' ? '😐' : ''}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Person</Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Correct the name"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Relationship</Text>
            <View style={styles.relRow}>
              {RELATIONSHIPS.map((relationship) => (
                <TouchableOpacity
                  key={relationship}
                  style={[
                    styles.relChip,
                    { borderColor: colors.surfaceBorder },
                    editRelationship === relationship && { backgroundColor: brand.primary, borderColor: brand.primary },
                  ]}
                  onPress={() => setEditRelationship(relationship)}
                >
                  <Text
                    style={[
                      styles.relChipText,
                      { color: colors.textSecondary },
                      editRelationship === relationship && { color: '#fff' },
                    ]}
                  >
                    {relationship}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Company</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editCompany}
              onChangeText={setEditCompany}
              placeholder="Optional"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Optional notes..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.surfaceBorder, borderWidth: 1 }]}
                onPress={() => setShowEdit(false)}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: brand.primary }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{saving ? 'Saving...' : 'Save'}</Text>
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
  headerSection: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 78, height: 78, borderRadius: 39, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 34, fontWeight: '700' },
  name: { fontSize: 28, fontWeight: '700' },
  relBadge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  relBadgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  company: { fontSize: 14, marginTop: 8 },
  headerButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editBtn: { minWidth: 92, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  editBtnText: { color: '#fff', fontWeight: '700' },
  briefBtn: { backgroundColor: 'transparent', borderWidth: 1 },
  briefBtnText: { fontWeight: '700' },
  section: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  briefingHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  briefingMeta: { fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12 },
  bodyText: { fontSize: 14, lineHeight: 22 },
  inlineRow: { marginTop: 8 },
  inlineTitle: { fontSize: 14, fontWeight: '600' },
  inlineMeta: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14 },
  interactionRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8, gap: 10 },
  sourceIcon: { fontSize: 18 },
  interactionCtx: { fontSize: 14, fontWeight: '600' },
  interactionDate: { fontSize: 12, marginTop: 3 },
  sentiment: { fontSize: 18 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  relRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  relChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  relChipText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 40 },
  modalBtn: { flex: 1, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
