import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { RelationshipState } from '@/lib/types';

const LABELS: Record<string, string> = {
  stable: 'Stable', positive: 'Positive', quiet_but_ok: 'Quiet but OK', needs_attention: 'Needs attention',
  care_followup: 'Care follow-up', repair_tension: 'Repair may help', unknown: 'Not enough context',
  growing: 'Growing', steady: 'Steady', slowing: 'Slowing', stalled: 'Paused',
  active: 'Active', quiet: 'Quiet', dormant: 'Dormant', reactivation_candidate: 'Open to reconnecting',
};

const OVERLAYS: Record<string, { title: string; text: string }> = {
  needs_attention: { title: 'A confirmed signal may need attention', text: 'Review the context and decide what feels appropriate.' },
  care_needed: { title: 'A gentle care follow-up may help', text: 'This is a prompt, not an obligation.' },
  commitment_pending: { title: 'A confirmed commitment is still open', text: 'You can review or update it in Open Actions.' },
  milestone_upcoming: { title: 'A saved milestone is coming up', text: 'Open Milestones if you want to plan around it.' },
};

export default function RelationshipStateCard({ state, onEdit }: { state: RelationshipState | null; onEdit: () => void }) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const overlay = state?.attention_overlay ? OVERLAYS[state.attention_overlay] : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Relationship State</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>Qualitative context, never a score</Text>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={onEdit} accessibilityRole="button" accessibilityLabel="Override relationship state">
          <Text style={[styles.editText, { color: brand.primaryLight }]}>{state?.created_by === 'user' ? 'Edit override' : 'Adjust'}</Text>
        </TouchableOpacity>
      </View>

      {overlay ? (
        <View style={[styles.overlay, { backgroundColor: brand.warning + '16', borderColor: brand.warning + '55' }]}>
          <Text style={[styles.overlayTitle, { color: colors.text }]}>{overlay.title}</Text>
          <Text style={[styles.overlayText, { color: colors.textSecondary }]}>{overlay.text}</Text>
        </View>
      ) : null}

      <View style={styles.states}>
        {[
          ['Health', state?.health_state ?? 'unknown'],
          ['Momentum', state?.momentum_state ?? 'unknown'],
          ['Rhythm', state?.dormancy_state ?? 'active'],
        ].map(([label, value]) => (
          <View key={label} style={[styles.stateCell, { borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.stateLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.stateValue, { color: colors.text }]}>{LABELS[value] ?? value.replace(/_/g, ' ')}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <View style={[styles.confidence, { backgroundColor: brand.primary + '18' }]}>
          <Text style={[styles.confidenceText, { color: brand.primaryLight }]}>{state?.confidence_level ?? 'low'} confidence</Text>
        </View>
        <Text style={[styles.source, { color: colors.textSecondary }]}>{state?.created_by === 'user' ? 'Your override' : state ? 'Based on confirmed evidence' : 'No state yet'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '700' },
  caption: { fontSize: 12, marginTop: 3 },
  editButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  editText: { fontSize: 12, fontWeight: '800' },
  overlay: { borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 12 },
  overlayTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  overlayText: { fontSize: 12, lineHeight: 18 },
  states: { flexDirection: 'row', gap: 8 },
  stateCell: { flex: 1, minHeight: 72, borderWidth: 1, borderRadius: 10, padding: 9, justifyContent: 'center' },
  stateLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 },
  stateValue: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  confidence: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  confidenceText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  source: { fontSize: 11, flex: 1 },
});
