import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ActionItemCard from '@/components/ActionItemCard';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import type { ActionItem, ActionStatus } from '@/lib/types';

const GROUPS: { title: string; statuses: ActionStatus[] }[] = [
  { title: 'Needs Review', statuses: ['suggested'] },
  { title: 'Open', statuses: ['accepted', 'active', 'snoozed', 'deferred', 'blocked'] },
  { title: 'Finished', statuses: ['completed', 'dismissed', 'no_longer_relevant'] },
];

export default function ActionsScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('lifeos_action_items')
      .select('*, person:lifeos_people(id,name)')
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) Alert.alert('Could not load actions', error.message);
    if (data) setItems(data as ActionItem[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleStatusChange(item: ActionItem, status: ActionStatus) {
    const now = new Date();
    const actionUpdate: Record<string, string | null> = {
      status,
      updated_at: now.toISOString(),
      completed_at: status === 'completed' ? now.toISOString() : null,
    };

    if (status === 'snoozed') {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      actionUpdate.due_at = tomorrow.toISOString();
    } else if (status === 'deferred') {
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      actionUpdate.due_at = nextWeek.toISOString();
    }

    const { error } = await supabase.from('lifeos_action_items').update(actionUpdate).eq('id', item.id);
    if (error) {
      Alert.alert('Could not update action', error.message);
      return;
    }

    const reminderState = status === 'completed' ? 'done' : status === 'dismissed' ? 'dismissed' : status;
    const reminderUpdate: Record<string, string | null> = {
      state: reminderState,
      updated_at: now.toISOString(),
      completed_at: status === 'completed' ? now.toISOString() : null,
    };
    if (status === 'snoozed' || status === 'deferred') reminderUpdate.snoozed_until = actionUpdate.due_at;

    await supabase.from('lifeos_reminders').update(reminderUpdate).eq('action_item_id', item.id);
    await supabase.from('lifeos_audit_events').insert({
      owner_id: user!.id,
      actor_type: 'user',
      event_type: `action_item_${status}`,
      object_type: 'action_item',
      object_id: item.id,
      event_summary: `Action item marked ${status.replace(/_/g, ' ')}`,
    });

    setItems(prev => prev.map(current => current.id === item.id
      ? { ...current, ...actionUpdate, status } as ActionItem
      : current));
  }

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.tint} /></View>;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
        setRefreshing(true);
        await loadItems();
        setRefreshing(false);
      }} tintColor={colors.tint} />}
    >
      <Text style={[styles.intro, { color: colors.textSecondary }]}>Commitments and gentle follow-ups, grouped by what needs your attention.</Text>
      {GROUPS.map(group => {
        const grouped = items.filter(item => group.statuses.includes(item.status));
        if (grouped.length === 0) return null;
        return (
          <View key={group.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{group.title} · {grouped.length}</Text>
            <View style={styles.list}>{grouped.map(item => (
              <ActionItemCard key={item.id} item={item} onStatusChange={handleStatusChange} />
            ))}</View>
          </View>
        );
      })}
      {items.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing waiting on you</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>Confirmed commitments from voice-note reviews will appear here.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  list: { gap: 9 },
  empty: { borderWidth: 1, borderRadius: 14, padding: 18 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 5 },
  emptyBody: { fontSize: 13, lineHeight: 19 },
});
