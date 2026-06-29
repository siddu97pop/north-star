import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { BriefingItem } from '@/lib/types';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  context: 'person-outline', last_interaction: 'chatbubble-outline', pending_action: 'checkmark-circle-outline', sensitive_context: 'lock-closed-outline',
  topics_to_remember: 'bookmark-outline', topics_to_avoid: 'shield-checkmark-outline', milestones: 'flag-outline',
  recommendations: 'sparkles-outline', relationship_state: 'pulse-outline', suggested_opener: 'chatbox-ellipses-outline',
  data_limitation: 'information-circle-outline',
};

export default function BriefingItemCard({ item, onSourcePress, onHide }: {
  item: BriefingItem;
  onSourcePress?: (item: BriefingItem) => void;
  onHide?: (item: BriefingItem) => void;
}) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const sensitive = item.item_type === 'sensitive_context' || ['sensitive_lite', 'sensitive', 'restricted'].includes(item.sensitivity_level);
  const [revealed, setRevealed] = useState(!sensitive);
  const stale = item.source_date && Date.now() - new Date(item.source_date).getTime() > 180 * 86_400_000;

  return (
    <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.surfaceBorder }]}>
      <View style={styles.heading}>
        <View style={[styles.iconWrap, { backgroundColor: brand.primary + '18' }]}><Ionicons name={ICONS[item.item_type] ?? 'document-text-outline'} size={18} color={brand.primaryLight} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{item.item_title}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.confidence_level} confidence{stale ? ' · older source' : ''}</Text>
        </View>
        {item.user_can_hide && onHide ? (
          <TouchableOpacity style={styles.iconButton} onPress={() => onHide(item)} accessibilityRole="button" accessibilityLabel={`Hide ${item.item_title}`}>
            <Ionicons name="eye-off-outline" size={19} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {revealed ? <Text style={[styles.body, { color: colors.text }]}>{item.item_text}</Text> : (
        <TouchableOpacity style={[styles.reveal, { borderColor: brand.warning + '66' }]} onPress={() => setRevealed(true)} accessibilityRole="button" accessibilityLabel={`Reveal ${item.item_title}`}>
          <Ionicons name="lock-closed-outline" size={16} color={brand.warning} />
          <Text style={[styles.revealText, { color: colors.text }]}>Tap to reveal approved sensitive summary</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.sourceButton} onPress={() => onSourcePress?.(item)} disabled={!onSourcePress || !item.source_object_id} accessibilityRole="button" accessibilityLabel={`View source ${item.source_label}`}>
        <Ionicons name="link-outline" size={14} color={brand.primaryLight} />
        <Text style={[styles.sourceText, { color: brand.primaryLight }]}>Source: {item.source_label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700' }, meta: { fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 14, lineHeight: 21 },
  reveal: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  revealText: { fontSize: 12, fontWeight: '600', flex: 1 },
  sourceButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingRight: 10 },
  sourceText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
