import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { Person } from '@/lib/types';

const RELATIONSHIPS = ['family', 'friend', 'colleague', 'acquaintance', 'other'] as const;

export default function PeopleScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelationship, setNewRelationship] = useState<string>('friend');
  const [newCompany, setNewCompany] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const loadPeople = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('lifeos_people')
      .select('*')
      .eq('owner_id', user.id)
      .order('last_interaction_at', { ascending: false, nullsFirst: false });
    if (data) setPeople(data);
  }, [user]);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  useFocusEffect(
    useCallback(() => {
      loadPeople();
    }, [loadPeople])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadPeople();
    setRefreshing(false);
  }

  async function handleAdd() {
    if (!user || !newName.trim()) return;
    await supabase.from('lifeos_people').insert({
      owner_id: user.id,
      name: newName.trim(),
      normalized_name: newName.trim().toLowerCase(),
      relationship: newRelationship,
      company: newCompany.trim() || null,
      notes: newNotes.trim() || null,
    });
    setNewName('');
    setNewCompany('');
    setNewNotes('');
    setShowAdd(false);
    loadPeople();
  }

  const filtered = search
    ? people.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : people;

  function relColor(rel: string | null) {
    switch (rel) {
      case 'family': return '#FF6B6B';
      case 'friend': return brand.primary;
      case 'colleague': return brand.accent;
      case 'acquaintance': return brand.warning;
      default: return colors.textSecondary;
    }
  }

  function timeAgo(iso: string | null) {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TextInput
          style={[styles.searchInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
          placeholder="Search people..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: brand.primary }]}
          onPress={() => setShowAdd(true)}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.personRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
            onPress={() => router.push(`/person/${item.id}`)}
          >
            <View style={[styles.avatar, { backgroundColor: relColor(item.relationship) + '22' }]}>
              <Text style={[styles.avatarText, { color: relColor(item.relationship) }]}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.personInfo}>
              <Text style={[styles.personName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.personMeta, { color: colors.textSecondary }]}>
                {item.relationship ?? 'contact'}
                {item.company ? ` · ${item.company}` : ''}
                {' · '}
                {item.total_interactions} interaction{item.total_interactions !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={[styles.lastSeen, { color: colors.textSecondary }]}>
              {timeAgo(item.last_interaction_at)}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No people yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Record voice notes mentioning people, or add contacts manually.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        alwaysBounceVertical
      />

      {/* Add person modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Person</Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Ahmed Al Maktoum"
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
                    newRelationship === r && { backgroundColor: brand.primary, borderColor: brand.primary },
                  ]}
                  onPress={() => setNewRelationship(r)}
                >
                  <Text style={[
                    styles.relChipText,
                    { color: colors.textSecondary },
                    newRelationship === r && { color: '#fff' },
                  ]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Company</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={newCompany}
              onChangeText={setNewCompany}
              placeholder="Optional"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={newNotes}
              onChangeText={setNewNotes}
              placeholder="Optional notes..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.surfaceBorder, borderWidth: 1 }]}
                onPress={() => setShowAdd(false)}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: brand.primary }]}
                onPress={handleAdd}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', padding: 16, gap: 10 },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  addBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '700' },
  personInfo: { flex: 1 },
  personName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  personMeta: { fontSize: 12 },
  lastSeen: { fontSize: 12 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  relRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  relChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  relChipText: { fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 40 },
  modalBtn: { flex: 1, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
