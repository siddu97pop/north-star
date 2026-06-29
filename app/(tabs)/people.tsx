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
import type { Person, CategoryAssignment, CategoryDomain, AttentionTier, RelationshipState } from '@/lib/types';

const DOMAIN_FILTERS: { key: CategoryDomain | 'all'; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: brand.primary },
  { key: 'work', label: 'Work', color: brand.accent },
  { key: 'personal', label: 'Personal', color: brand.danger },
  { key: 'other_strategic', label: 'Strategic', color: brand.warning },
];

const TIER_FILTERS: { key: AttentionTier | 'all'; label: string }[] = [
  { key: 'all', label: 'All Tiers' },
  { key: 'high_attention', label: 'High' },
  { key: 'active_maintenance', label: 'Active' },
  { key: 'light_touch', label: 'Light' },
  { key: 'needs_attention', label: 'Needs Attn' },
];

const RELATIONSHIPS = ['family', 'friend', 'colleague', 'acquaintance', 'other'] as const;
type StateFilter = 'all' | 'needs_attention' | 'dormant' | 'care_followup';
const STATE_FILTERS: { key: StateFilter; label: string }[] = [
  { key: 'all', label: 'All states' },
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'dormant', label: 'Dormant' },
  { key: 'care_followup', label: 'Care follow-up' },
];

export default function PeopleScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const [people, setPeople] = useState<Person[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, CategoryAssignment[]>>({});
  const [stateMap, setStateMap] = useState<Record<string, RelationshipState>>({});
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [domainFilter, setDomainFilter] = useState<CategoryDomain | 'all'>('all');
  const [tierFilter, setTierFilter] = useState<AttentionTier | 'all'>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelationship, setNewRelationship] = useState<string>('friend');
  const [newCompany, setNewCompany] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const loadPeople = useCallback(async () => {
    if (!user) return;
    const [peopleRes, catRes, stateRes] = await Promise.all([
      supabase
        .from('lifeos_people')
        .select('*')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .order('last_interaction_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('lifeos_category_assignments')
        .select('*')
        .eq('owner_id', user.id)
        .is('deleted_at', null),
      supabase
        .from('lifeos_relationship_state')
        .select('*')
        .eq('owner_id', user.id)
        .eq('snapshot_type', 'current')
        .is('superseded_at', null),
    ]);

    if (peopleRes.data) setPeople(peopleRes.data);

    if (catRes.data) {
      const map: Record<string, CategoryAssignment[]> = {};
      for (const ca of catRes.data) {
        if (!map[ca.person_id]) map[ca.person_id] = [];
        map[ca.person_id].push(ca);
      }
      setCategoryMap(map);
    }
    if (stateRes.data) {
      const map: Record<string, RelationshipState> = {};
      for (const state of stateRes.data) map[state.person_id] = state as RelationshipState;
      setStateMap(map);
    }
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

  const filtered = people.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (tierFilter !== 'all' && p.attention_tier !== tierFilter) return false;
    if (domainFilter !== 'all') {
      const cats = categoryMap[p.id] ?? [];
      if (!cats.some(c => c.category_domain === domainFilter)) return false;
    }
    if (stateFilter !== 'all') {
      const state = stateMap[p.id];
      if (!state) return false;
      if (stateFilter === 'dormant' && state.dormancy_state !== 'dormant') return false;
      if (stateFilter === 'care_followup' && state.health_state !== 'care_followup' && state.attention_overlay !== 'care_needed') return false;
      if (stateFilter === 'needs_attention' && state.health_state !== 'needs_attention' && state.health_state !== 'repair_tension' && state.attention_overlay !== 'needs_attention') return false;
    }
    return true;
  });

  function getDomainColor(personId: string): string {
    const cats = categoryMap[personId] ?? [];
    const primary = cats.find(c => c.is_primary) ?? cats[0];
    if (!primary) return colors.textSecondary;
    const domain = DOMAIN_FILTERS.find(d => d.key === primary.category_domain);
    return domain?.color ?? colors.textSecondary;
  }

  function getDomainLabels(personId: string): string {
    const cats = categoryMap[personId] ?? [];
    if (cats.length === 0) return 'untagged';
    return cats.map(c => {
      const d = DOMAIN_FILTERS.find(df => df.key === c.category_domain);
      const sub = c.subcategory ? c.subcategory.replace(/_/g, ' ') : '';
      return sub || d?.label || c.category_domain;
    }).join(', ');
  }

  function tierBadge(tier: AttentionTier): { label: string; color: string } {
    switch (tier) {
      case 'high_attention': return { label: 'HIGH', color: brand.danger };
      case 'active_maintenance': return { label: 'ACTIVE', color: brand.success };
      case 'needs_attention': return { label: 'NEEDS ATTN', color: brand.warning };
      case 'private_do_not_analyze': return { label: 'PRIVATE', color: colors.textSecondary };
      default: return { label: '', color: '' };
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

      {/* Domain filter row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {DOMAIN_FILTERS.map(d => (
          <TouchableOpacity
            key={d.key}
            style={[
              styles.filterChip,
              { borderColor: colors.surfaceBorder },
              domainFilter === d.key && { backgroundColor: d.color + '22', borderColor: d.color },
            ]}
            onPress={() => setDomainFilter(domainFilter === d.key ? 'all' : d.key)}
          >
            <Text style={[
              styles.filterChipText,
              { color: colors.textSecondary },
              domainFilter === d.key && { color: d.color },
            ]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.filterSpacer} />
        {TIER_FILTERS.filter(t => t.key !== 'all').map(t => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.filterChip,
              { borderColor: colors.surfaceBorder },
              tierFilter === t.key && { backgroundColor: brand.primary + '22', borderColor: brand.primary },
            ]}
            onPress={() => setTierFilter(tierFilter === t.key ? 'all' : t.key)}
          >
            <Text style={[
              styles.filterChipText,
              { color: colors.textSecondary },
              tierFilter === t.key && { color: brand.primary },
            ]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateFilterScroll} contentContainerStyle={styles.filterRow}>
        {STATE_FILTERS.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.stateFilterChip, { borderColor: colors.surfaceBorder }, stateFilter === item.key && { backgroundColor: brand.primary + '22', borderColor: brand.primaryLight }]}
            onPress={() => setStateFilter(item.key)}
          >
            <Text style={[styles.filterChipText, { color: stateFilter === item.key ? brand.primaryLight : colors.textSecondary }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
        renderItem={({ item }) => {
          const dColor = getDomainColor(item.id);
          const tier = tierBadge(item.attention_tier);
          const relationshipState = stateMap[item.id];
          return (
            <TouchableOpacity
              style={[styles.personRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
              onPress={() => router.push(`/person/${item.id}`)}
            >
              <View style={[styles.avatar, { backgroundColor: dColor + '22' }]}>
                <Text style={[styles.avatarText, { color: dColor }]}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.personInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.personName, { color: colors.text }]}>{item.name}</Text>
                  {tier.label ? (
                    <View style={[styles.tierBadge, { backgroundColor: tier.color + '22' }]}>
                      <Text style={[styles.tierBadgeText, { color: tier.color }]}>{tier.label}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.personMeta, { color: colors.textSecondary }]}>
                  {getDomainLabels(item.id)}
                  {item.company ? ` · ${item.company}` : ''}
                  {' · '}
                  {item.total_interactions} interaction{item.total_interactions !== 1 ? 's' : ''}
                </Text>
                {relationshipState ? (
                  <Text style={[styles.stateMeta, { color: colors.textSecondary }]}>
                    {relationshipState.health_state.replace(/_/g, ' ')} · {relationshipState.dormancy_state.replace(/_/g, ' ')}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.lastSeen, { color: colors.textSecondary }]}>
                {timeAgo(item.last_interaction_at)}
              </Text>
            </TouchableOpacity>
          );
        }}
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
  filterScroll: { maxHeight: 44, paddingLeft: 16 },
  stateFilterScroll: { maxHeight: 52, paddingLeft: 16, marginTop: 6 },
  filterRow: { gap: 8, paddingRight: 16, alignItems: 'center' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  stateFilterChip: { minHeight: 44, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  filterSpacer: { width: 1, height: 20, backgroundColor: '#334155', marginHorizontal: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12, flexGrow: 1 },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  personName: { fontSize: 15, fontWeight: '600' },
  tierBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tierBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  personMeta: { fontSize: 12 },
  stateMeta: { fontSize: 11, marginTop: 4, textTransform: 'capitalize' },
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
