import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import RecommendationCard from '@/components/RecommendationCard';
import { useAuth } from '@/lib/auth';
import {
  acceptRecommendation,
  decideRecommendation,
  editRecommendation,
  loadRecommendations,
} from '@/lib/recommendations';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { Recommendation, RecommendationEvidence, RecommendationType } from '@/lib/types';

const FILTERS: { key: 'all' | RecommendationType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'care_checkin', label: 'Care' },
  { key: 'milestone_reminder', label: 'Milestones' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'repair', label: 'Repair' },
];

export default function RecommendationsScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, loading: authLoading } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [filter, setFilter] = useState<'all' | RecommendationType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Recommendation | null>(null);
  const [editText, setEditText] = useState('');
  const [editAction, setEditAction] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setRecommendations(await loadRecommendations());
    } catch (error) {
      Alert.alert('Could not load suggestions', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => recommendations.filter(item => filter === 'all' || item.recommendation_type === filter),
    [filter, recommendations]
  );

  function remove(id: string) {
    setRecommendations(previous => previous.filter(item => item.id !== id));
  }

  async function accept(item: Recommendation) {
    if (!user) return;
    const proceed = async () => {
      try {
        await acceptRecommendation(item, user.id);
        remove(item.id);
      } catch (error) {
        Alert.alert('Could not accept suggestion', error instanceof Error ? error.message : 'Please try again.');
      }
    };
    if (item.agency_level === 'ask_confirmation' || ['category_review', 'tier_review'].includes(item.recommendation_type)) {
      Alert.alert('Confirm this suggestion', 'Nothing changes silently. Accepting records your decision and creates only the action or reminder shown.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: proceed },
      ]);
    } else {
      await proceed();
    }
  }

  async function decide(item: Recommendation, decision: 'dismissed' | 'snoozed' | 'disabled_similar') {
    if (!user) return;
    const run = async () => {
      try {
        await decideRecommendation(item, user.id, decision);
        remove(item.id);
      } catch (error) {
        Alert.alert('Could not update suggestion', error instanceof Error ? error.message : 'Please try again.');
      }
    };
    if (decision === 'disabled_similar') {
      Alert.alert(
        'Disable similar suggestions?',
        `North Star will stop generating ${item.recommendation_type.replace(/_/g, ' ')} suggestions for ${item.person?.name ?? 'this person'}.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Disable', style: 'destructive', onPress: run }]
      );
    } else {
      await run();
    }
  }

  function beginEdit(item: Recommendation) {
    setEditing(item);
    setEditText(item.recommendation_text);
    setEditAction(item.action_requested);
  }

  async function saveEdit() {
    if (!editing || !user || !editText.trim() || !editAction.trim()) return;
    setSavingEdit(true);
    try {
      const update = await editRecommendation(editing, user.id, editText, editAction);
      setRecommendations(previous => previous.map(item => item.id === editing.id ? { ...item, ...update } : item));
      setEditing(null);
    } catch (error) {
      Alert.alert('Could not save edit', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  function openEvidence(item: Recommendation, evidence: RecommendationEvidence) {
    if (evidence.evidence_object_type === 'interaction') router.push(`/interaction/${evidence.evidence_object_id}`);
    else if (evidence.evidence_object_type === 'action_item') router.push('/actions');
    else if (item.person_id) router.push(`/person/${item.person_id}`);
  }

  if (authLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.tint} /></View>;
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.tint} /></View>;
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }} tintColor={colors.tint} />}
      >
        <Text style={[styles.intro, { color: colors.textSecondary }]}>Every suggestion shows its evidence and stays under your control. Nothing is sent or changed automatically.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(option => (
            <TouchableOpacity
              key={option.key}
              style={[styles.filter, { borderColor: colors.surfaceBorder }, filter === option.key && { backgroundColor: brand.primary, borderColor: brand.primary }]}
              onPress={() => setFilter(option.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === option.key }}
            >
              <Text style={[styles.filterText, { color: colors.textSecondary }, filter === option.key && { color: '#fff' }]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.count, { color: colors.textSecondary }]}>{visible.length} suggestion{visible.length === 1 ? '' : 's'} ready for review</Text>
        <View style={styles.list}>
          {visible.map(item => (
            <RecommendationCard
              key={item.id}
              recommendation={item}
              onAccept={() => accept(item)}
              onEdit={() => beginEdit(item)}
              onDismiss={() => decide(item, 'dismissed')}
              onSnooze={() => decide(item, 'snoozed')}
              onDisableSimilar={() => decide(item, 'disabled_similar')}
              onEvidencePress={evidence => openEvidence(item, evidence)}
            />
          ))}
        </View>
        {visible.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No suggestions waiting</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>Generate suggestions from a person profile when you want a fresh, evidence-based review.</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Suggestion</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Recommendation text</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editText}
              onChangeText={setEditText}
              multiline
              accessibilityLabel="Recommendation text"
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Suggested action</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editAction}
              onChangeText={setEditAction}
              accessibilityLabel="Suggested action"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, { borderColor: colors.surfaceBorder }]} onPress={() => setEditing(null)}><Text style={{ color: colors.text }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: brand.primary, borderColor: brand.primary }, savingEdit && { opacity: 0.5 }]} onPress={saveEdit} disabled={savingEdit}><Text style={{ color: '#fff', fontWeight: '800' }}>{savingEdit ? 'Saving…' : 'Save edit'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 16 },
  filters: { gap: 8, paddingBottom: 14 },
  filter: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14 },
  filterText: { fontSize: 12, fontWeight: '700' },
  count: { fontSize: 12, marginBottom: 12 },
  list: { gap: 10 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 18 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 5 },
  emptyBody: { fontSize: 13, lineHeight: 19 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  modal: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, marginBottom: 16 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 12 },
  modalButton: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
