import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { SensitiveMemory, SensitivityLevel } from '@/lib/types';

function sensitivityConfig(level: SensitivityLevel): { label: string; color: string } {
  switch (level) {
    case 'personal': return { label: 'PERSONAL', color: brand.primaryLight };
    case 'sensitive_lite': return { label: 'SENSITIVE', color: brand.warning };
    case 'sensitive': return { label: 'SENSITIVE', color: '#F97316' };
    case 'restricted': return { label: 'RESTRICTED', color: brand.danger };
    default: return { label: '', color: '' };
  }
}

function reasonLabel(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface Props {
  memory: SensitiveMemory;
  onRevoke?: (id: string) => void;
}

export default function SensitiveMemoryCard({ memory, onRevoke }: Props) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [revealed, setRevealed] = useState(false);

  const sens = sensitivityConfig(memory.sensitivity_level);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {memory.memory_title ?? 'Sensitive note'}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: sens.color + '22' }]}>
          <Text style={[styles.badgeText, { color: sens.color }]}>{sens.label}</Text>
        </View>
      </View>

      {/* Minimal summary always visible */}
      {memory.memory_summary_minimal && (
        <Text style={[styles.summary, { color: colors.textSecondary }]}>
          {memory.memory_summary_minimal}
        </Text>
      )}

      {/* Reason codes */}
      {memory.sensitivity_reason_codes.length > 0 && (
        <View style={styles.reasonRow}>
          {memory.sensitivity_reason_codes.map(code => (
            <View key={code} style={[styles.reasonChip, { backgroundColor: colors.background }]}>
              <Text style={[styles.reasonText, { color: colors.textSecondary }]}>{reasonLabel(code)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Reveal / Hide detail */}
      {memory.memory_detail && (
        <>
          {revealed ? (
            <View style={[styles.detailBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.detailText, { color: colors.text }]}>{memory.memory_detail}</Text>
              <TouchableOpacity onPress={() => setRevealed(false)} style={styles.hideBtn}>
                <Text style={[styles.hideBtnText, { color: colors.textSecondary }]}>Hide</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.revealBtn, { borderColor: sens.color + '44' }]}
              onPress={() => setRevealed(true)}
            >
              <Text style={[styles.revealBtnText, { color: sens.color }]}>Tap to reveal full detail</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Consent status */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          {memory.storage_consent_status === 'granted' ? 'Consent granted' : memory.storage_consent_status}
          {' · '}
          {new Date(memory.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
        {onRevoke && memory.storage_consent_status === 'granted' && (
          <TouchableOpacity onPress={() => onRevoke(memory.id)}>
            <Text style={[styles.revokeText, { color: brand.danger }]}>Revoke</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  lockIcon: { fontSize: 14 },
  title: { fontSize: 14, fontWeight: '600', flex: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  summary: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  reasonChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  reasonText: { fontSize: 10, fontWeight: '600' },
  detailBox: { padding: 12, borderRadius: 8, marginBottom: 8 },
  detailText: { fontSize: 13, lineHeight: 20 },
  hideBtn: { marginTop: 8, alignSelf: 'flex-end' },
  hideBtnText: { fontSize: 12, fontWeight: '600' },
  revealBtn: { paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center', marginBottom: 8 },
  revealBtnText: { fontSize: 12, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 11 },
  revokeText: { fontSize: 11, fontWeight: '700' },
});
