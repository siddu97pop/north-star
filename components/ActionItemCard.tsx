import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { ActionItem, ActionStatus } from '@/lib/types';

const CERTAINTY_LABELS = {
  c5_explicit: 'C5 · Explicit',
  c4_agreed: 'C4 · Agreed',
  c3_implied: 'C3 · Implied',
  c2_weak: 'C2 · Weak signal',
  c1_low: 'C1 · Review only',
} as const;

export default function ActionItemCard({
  item,
  onStatusChange,
  compact = false,
}: {
  item: ActionItem;
  onStatusChange?: (item: ActionItem, status: ActionStatus) => void | Promise<void>;
  compact?: boolean;
}) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const isFinished = ['completed', 'dismissed', 'no_longer_relevant'].includes(item.status);
  const certainty = item.commitment_certainty ? CERTAINTY_LABELS[item.commitment_certainty] : 'Manual';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{certainty}
            {item.person?.name ? ` · ${item.person.name}` : ''}
            {item.due_at ? ` · ${new Date(item.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '18' }]}>
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      {!compact && item.description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
      ) : null}

      {onStatusChange && !isFinished ? (
        <View style={styles.actions}>
          <Action label="Done" color={brand.success} onPress={() => onStatusChange(item, 'completed')} />
          <Action label="Snooze" color={brand.primaryLight} onPress={() => onStatusChange(item, 'snoozed')} />
          {!compact ? <Action label="Defer" color={brand.warning} onPress={() => onStatusChange(item, 'deferred')} /> : null}
          {!compact ? <Action label="Dismiss" color={colors.textSecondary} onPress={() => onStatusChange(item, 'dismissed')} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Action({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.action, { borderColor: color + '66' }]} onPress={onPress}>
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function statusColor(status: ActionStatus) {
  if (status === 'completed') return brand.success;
  if (status === 'dismissed' || status === 'no_longer_relevant') return '#6B7280';
  if (status === 'snoozed' || status === 'deferred') return brand.warning;
  if (status === 'suggested') return brand.primaryLight;
  return brand.accent;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  description: { fontSize: 13, lineHeight: 19 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  action: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderRadius: 9, paddingHorizontal: 11 },
  actionText: { fontSize: 12, fontWeight: '700' },
});
