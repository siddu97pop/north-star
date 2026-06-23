import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { Person, Interaction } from '@/lib/types';

const RELATIONSHIPS = ['family', 'friend', 'colleague', 'acquaintance', 'other'] as const;

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const [person, setPerson] = useState<Person | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [editName, setEditName] = useState('');
  const [editRelationship, setEditRelationship] = useState<string>('friend');
  const [editCompany, setEditCompany] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const loadPerson = useCallback(async () => {
    const [personRes, intRes] = await Promise.all([
      supabase.from('lifeos_people').select('*').eq('id', id).single(),
      supabase
        .from('lifeos_interactions')
        .select('*')
        .eq('person_id', id)
        .order('interaction_date', { ascending: false })
        .limit(50),
    ]);

    if (personRes.data) {
      setPerson(personRes.data);
      setEditName(personRes.data.name);
      setEditRelationship(personRes.data.relationship ?? 'other');
      setEditCompany(personRes.data.company ?? '');
      setEditNotes(personRes.data.notes ?? '');
    }
    if (intRes.data) setInteractions(intRes.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadPerson();
  }, [loadPerson]);

  function relColor(rel: string | null) {
    switch (rel) {
      case 'family': return '#FF6B6B';
      case 'friend': return brand.primary;
      case 'colleague': return brand.accent;
      case 'acquaintance': return brand.warning;
      default: return colors.textSecondary;
    }
  }

  function sourceIcon(source: string) {
    switch (source) {
      case 'voice_note': return '🎙';
      case 'calendar_event': return '📅';
      default: return '✏️';
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
          {person.relationship && (
            <View style={[styles.relBadge, { backgroundColor: relColor(person.relationship) + '22' }]}>
              <Text style={[styles.relBadgeText, { color: relColor(person.relationship) }]}>
                {person.relationship}
              </Text>
            </View>
          )}
          {person.company && (
            <Text style={[styles.company, { color: colors.textSecondary }]}>{person.company}</Text>
          )}
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: brand.primary }]}
            onPress={() => setShowEdit(true)}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

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

        {person.notes && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text>
            <Text style={[styles.bodyText, { color: colors.text }]}>{person.notes}</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 12 }]}>
          Interaction History
        </Text>
        {interactions.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>No interactions recorded yet</Text>
        ) : (
          interactions.map(item => (
            <View
              key={item.id}
              style={[styles.interactionRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
            >
              <Text style={styles.sourceIcon}>{sourceIcon(item.source)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.interactionCtx, { color: colors.text }]}>
                  {item.context || item.source.replace('_', ' ')}
                </Text>
                <Text style={[styles.interactionDate, { color: colors.textSecondary }]}>
                  {new Date(item.interaction_date).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                  })}
                  {item.topics.length > 0 ? ` · ${item.topics.join(', ')}` : ''}
                </Text>
              </View>
              {item.sentiment && (
                <Text style={styles.sentiment}>
                  {item.sentiment === 'positive' ? '😊' : item.sentiment === 'negative' ? '😔' : item.sentiment === 'mixed' ? '😐' : ''}
                </Text>
              )}
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
              {RELATIONSHIPS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.relChip,
                    { borderColor: colors.surfaceBorder },
                    editRelationship === r && { backgroundColor: brand.primary, borderColor: brand.primary },
                  ]}
                  onPress={() => setEditRelationship(r)}
                >
                  <Text
                    style={[
                      styles.relChipText,
                      { color: colors.textSecondary },
                      editRelationship === r && { color: '#fff' },
                    ]}
                  >
                    {r}
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
                disabled={saving}
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
  headerSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  relBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 4 },
  relBadgeText: { fontSize: 13, fontWeight: '600' },
  company: { fontSize: 14, marginTop: 4 },
  editBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  editBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: 12 },
  section: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  bodyText: { fontSize: 14, lineHeight: 22 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 12 },
  interactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  sourceIcon: { fontSize: 18, marginRight: 10 },
  interactionCtx: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  interactionDate: { fontSize: 12 },
  sentiment: { fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '88%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  relRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  relChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  relChipText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24, paddingBottom: 12 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
