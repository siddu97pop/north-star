import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { Recommendation, RecommendationEvidence } from '@/lib/types';

export default function RecommendationCard({
  recommendation,
  onAccept,
  onEdit,
  onDismiss,
  onSnooze,
  onDisableSimilar,
  onEvidencePress,
  compact = false,
}: {
  recommendation: Recommendation;
  onAccept?: () => void;
  onEdit?: () => void;
  onDismiss?: () => void;
  onSnooze?: () => void;
  onDisableSimilar?: () => void;
  onEvidencePress?: (evidence: RecommendationEvidence) => void;
  compact?: boolean;
}) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [showEvidence, setShowEvidence] = useState(false);
  const evidence = recommendation.evidence ?? [];

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
      accessible
      accessibilityLabel={`${recommendation.recommendation_title}. ${recommendation.recommendation_text}`}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: brand.primaryLight }]}>Suggestion · {label(recommendation.recommendation_type)}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{recommendation.recommendation_title}</Text>
        </View>
        <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor(recommendation.confidence_level) + '18' }]}>
          <Text style={[styles.confidenceText, { color: confidenceColor(recommendation.confidence_level) }]}>
            {recommendation.confidence_level} confidence
          </Text>
        </View>
      </View>

      <Text style={[styles.body, { color: colors.textSecondary }]}>{recommendation.recommendation_text}</Text>
      <View style={[styles.actionBox, { backgroundColor: colors.background, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Suggested action</Text>
        <Text style={[styles.actionText, { color: colors.text }]}>{recommendation.action_requested}</Text>
      </View>

      <View style={styles.metaRow}>
        <MetaBadge label={`Evidence: ${label(recommendation.evidence_strength)}`} color={brand.accent} />
        <MetaBadge label={`Sensitivity: ${label(recommendation.sensitivity_level)}`} color={sensitivityColor(recommendation.sensitivity_level)} />
        <MetaBadge label={`Agency: ${label(recommendation.agency_level)}`} color={brand.primaryLight} />
      </View>

      {evidence.length > 0 ? (
        <>
          <TouchableOpacity
            style={styles.explainButton}
            onPress={() => setShowEvidence(value => !value)}
            accessibilityRole="button"
            accessibilityLabel={showEvidence ? 'Hide recommendation evidence' : 'Explain why this recommendation appears'}
            accessibilityState={{ expanded: showEvidence }}
          >
            <Text style={[styles.explainText, { color: brand.primaryLight }]}>{showEvidence ? 'Hide explanation' : 'Why this appears'}</Text>
          </TouchableOpacity>
          {showEvidence ? (
            <View style={styles.evidenceList}>
              {evidence.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.evidenceRow, { borderColor: colors.surfaceBorder }]}
                  onPress={() => onEvidencePress?.(item)}
                  disabled={!onEvidencePress}
                  accessibilityRole={onEvidencePress ? 'link' : 'text'}
                  accessibilityLabel={`${item.evidence_summary}. ${item.evidence_strength} evidence`}
                >
                  <View style={[styles.evidenceDot, { backgroundColor: confidenceColor(item.evidence_strength === 'explicit' ? 'high' : item.evidence_strength === 'strong_inferred' ? 'medium' : 'low') }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.evidenceText, { color: colors.text }]}>
                      {item.can_show_to_user ? item.evidence_summary : 'Private evidence — open the source to review.'}
                    </Text>
                    <Text style={[styles.evidenceMeta, { color: colors.textSecondary }]}>{label(item.evidence_object_type)} · {label(item.evidence_strength)}</Text>
                  </View>
                  {onEvidencePress ? <Text style={[styles.sourceLink, { color: brand.primaryLight }]}>View</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {onAccept || onEdit || onDismiss || onSnooze || onDisableSimilar ? (
        <View style={styles.controls}>
          {onAccept ? <Control label="Accept" onPress={onAccept} backgroundColor={brand.primary} textColor="#fff" /> : null}
          {onEdit && !compact ? <Control label="Edit" onPress={onEdit} borderColor={brand.primaryLight} textColor={brand.primaryLight} /> : null}
          {onSnooze ? <Control label="Snooze 7d" onPress={onSnooze} borderColor={brand.warning} textColor={brand.warning} /> : null}
          {onDismiss && !compact ? <Control label="Dismiss" onPress={onDismiss} borderColor={colors.surfaceBorder} textColor={colors.textSecondary} /> : null}
          {onDisableSimilar && !compact ? <Control label="Disable similar" onPress={onDisableSimilar} borderColor={brand.danger + '66'} textColor={brand.danger} /> : null}
        </View>
      ) : null}

      {recommendation.expires_at ? (
        <Text style={[styles.expiry, { color: colors.textSecondary }]}>Expires {new Date(recommendation.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
      ) : null}
    </View>
  );
}

function Control({
  label: controlLabel,
  onPress,
  backgroundColor = 'transparent',
  borderColor = 'transparent',
  textColor,
}: {
  label: string;
  onPress: () => void;
  backgroundColor?: string;
  borderColor?: string;
  textColor: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.control, { backgroundColor, borderColor }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${controlLabel} recommendation`}
    >
      <Text style={[styles.controlText, { color: textColor }]}>{controlLabel}</Text>
    </TouchableOpacity>
  );
}

function MetaBadge({ label: badgeLabel, color }: { label: string; color: string }) {
  return (
    <View style={[styles.metaBadge, { backgroundColor: color + '16', borderColor: color + '40' }]}>
      <Text style={[styles.metaText, { color }]}>{badgeLabel}</Text>
    </View>
  );
}

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function confidenceColor(value: string) {
  if (value === 'high') return brand.success;
  if (value === 'medium') return brand.warning;
  return '#94A3B8';
}

function sensitivityColor(value: string) {
  if (value === 'restricted' || value === 'sensitive') return brand.danger;
  if (value === 'sensitive_lite') return brand.warning;
  return brand.accent;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5 },
  title: { fontSize: 17, lineHeight: 23, fontWeight: '800' },
  confidenceBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  confidenceText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  body: { fontSize: 14, lineHeight: 21 },
  actionBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  actionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  actionText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  metaText: { fontSize: 10, fontWeight: '700' },
  explainButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingRight: 16 },
  explainText: { fontSize: 13, fontWeight: '700' },
  evidenceList: { gap: 8 },
  evidenceRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 8 },
  evidenceDot: { width: 8, height: 8, borderRadius: 4 },
  evidenceText: { fontSize: 12, lineHeight: 17 },
  evidenceMeta: { fontSize: 10, marginTop: 2 },
  sourceLink: { fontSize: 12, fontWeight: '700' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  control: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 13 },
  controlText: { fontSize: 12, fontWeight: '800' },
  expiry: { fontSize: 10, textAlign: 'right' },
});
