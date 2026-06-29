import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type {
  ExtractedField,
  InteractionExtraction,
  ConfidenceLevel,
  SensitivityLevel,
  ConfirmationStatus,
  ActionType,
  CommitmentCertainty,
} from '@/lib/types';

function confidenceBadge(level: ConfidenceLevel): { label: string; color: string } {
  switch (level) {
    case 'high': return { label: 'HIGH', color: brand.success };
    case 'medium': return { label: 'MED', color: brand.warning };
    case 'low': return { label: 'LOW', color: brand.danger };
    default: return { label: 'N/A', color: '#6B7280' };
  }
}

function sensitivityBadge(level: SensitivityLevel): { label: string; color: string } | null {
  switch (level) {
    case 'none_low': return null;
    case 'personal': return { label: 'PERSONAL', color: brand.primaryLight };
    case 'sensitive_lite': return { label: 'SENSITIVE', color: brand.warning };
    case 'sensitive': return { label: 'SENSITIVE', color: '#F97316' };
    case 'restricted': return { label: 'RESTRICTED', color: brand.danger };
    default: return null;
  }
}

function fieldTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fieldTypeIcon(type: string): string {
  switch (type) {
    case 'person': return '👤';
    case 'topic': return '💬';
    case 'summary': return '📝';
    case 'action_item': return '✅';
    case 'category_suggestion': return '🏷';
    case 'sensitive_memory': return '🔒';
    case 'signal': return '📡';
    case 'milestone': return '🎯';
    default: return '📄';
  }
}

export default function ExtractionReviewScreen() {
  const { extractionId } = useLocalSearchParams<{ extractionId: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const [extraction, setExtraction] = useState<InteractionExtraction | null>(null);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [extRes, fieldsRes] = await Promise.all([
      supabase
        .from('lifeos_interaction_extractions')
        .select('*')
        .eq('id', extractionId)
        .single(),
      supabase
        .from('lifeos_extracted_fields')
        .select('*')
        .eq('extraction_id', extractionId)
        .is('deleted_at', null)
        .order('created_at'),
    ]);

    if (extRes.data) setExtraction(extRes.data);
    if (fieldsRes.data) setFields(fieldsRes.data);
    setLoading(false);
  }, [extractionId]);

  useEffect(() => { loadData(); }, [loadData]);

  const isSensitiveField = (field: ExtractedField) =>
    field.sensitivity_level === 'sensitive_lite' ||
    field.sensitivity_level === 'sensitive' ||
    field.sensitivity_level === 'restricted';

  async function updateFieldStatus(fieldId: string, status: ConfirmationStatus) {
    await supabase
      .from('lifeos_extracted_fields')
      .update({ confirmation_status: status, updated_at: new Date().toISOString() })
      .eq('id', fieldId);

    if (user) {
      await supabase.from('lifeos_audit_events').insert({
        owner_id: user.id,
        actor_type: 'user',
        event_type: `field_${status}`,
        object_type: 'extracted_field',
        object_id: fieldId,
        event_summary: `User ${status} extracted field`,
      });
    }

    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, confirmation_status: status } : f));

  }

  async function resolvePersonId(value: Record<string, unknown> | null): Promise<string | null> {
    if (!user) return null;
    if (typeof value?.person_id === 'string') return value.person_id;

    let personName = typeof value?.person_name === 'string' ? value.person_name : null;
    if (!personName) {
      const mentionedPeople = fields
        .filter(field => field.field_type === 'person' && field.field_value_json)
        .map(field => field.field_value_json as { name?: string })
        .filter(person => person.name);
      if (mentionedPeople.length === 1) personName = mentionedPeople[0].name ?? null;
    }
    if (!personName) return null;

    const { data } = await supabase
      .from('lifeos_people')
      .select('id')
      .eq('owner_id', user.id)
      .eq('normalized_name', personName.trim().toLowerCase())
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }

  function validDate(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  async function createAdaptiveReminder(
    actionId: string,
    personId: string | null,
    title: string,
    certainty: CommitmentCertainty,
    dueAt: string | null,
    sensitivityLevel: SensitivityLevel,
  ) {
    if (!user || !['c5_explicit', 'c4_agreed'].includes(certainty)) return;

    const { data: existing } = await supabase
      .from('lifeos_reminders')
      .select('id')
      .eq('action_item_id', actionId)
      .is('deleted_at', null)
      .maybeSingle();
    if (existing) return;

    let reminderPolicy = 'normal';
    let boundaryState = 'none';
    if (personId) {
      const { data: preferences } = await supabase
        .from('lifeos_person_preferences')
        .select('reminder_policy,boundary_state')
        .eq('person_id', personId)
        .maybeSingle();
      reminderPolicy = preferences?.reminder_policy ?? 'normal';
      boundaryState = preferences?.boundary_state ?? 'none';
    }

    const suppressed = reminderPolicy === 'none' || boundaryState === 'no_contact';
    const now = new Date();
    let scheduledFor = dueAt ? new Date(dueAt) : new Date(now);
    if (dueAt) scheduledFor.setDate(scheduledFor.getDate() - 1);
    else scheduledFor.setDate(now.getDate() + (reminderPolicy === 'gentle' ? 3 : reminderPolicy === 'minimal' ? 7 : 1));
    if (scheduledFor < now) scheduledFor = now;

    const sensitive = ['sensitive_lite', 'sensitive', 'restricted'].includes(sensitivityLevel);
    await supabase.from('lifeos_reminders').insert({
      owner_id: user.id,
      person_id: personId,
      action_item_id: actionId,
      reminder_type: 'action',
      reminder_title: sensitive ? 'You have a private follow-up' : title,
      reminder_body_safe: sensitive ? 'Open Life OS to review the details.' : 'A commitment you confirmed is coming up.',
      scheduled_for: scheduledFor.toISOString(),
      cadence_rule: reminderPolicy === 'minimal' ? 'weekly_review' : 'one_time',
      state: suppressed ? 'suppressed' : 'suggested',
      sensitivity_level: sensitivityLevel,
      user_confirmed_cadence: false,
      created_by: 'ai',
    });
  }

  async function persistConfirmedField(field: ExtractedField, redacted = false): Promise<boolean> {
    if (!user || !extraction) return false;
    const value = (field.field_value_json ?? {}) as Record<string, unknown>;

    if (field.field_type === 'category_suggestion') {
      const personId = await resolvePersonId(value);
      if (typeof value.domain === 'string' && personId) {
        const { data: existing } = await supabase
          .from('lifeos_category_assignments')
          .select('id')
          .eq('person_id', personId)
          .eq('category_domain', value.domain)
          .is('deleted_at', null)
          .maybeSingle();
        if (!existing) await supabase.from('lifeos_category_assignments').insert({
          person_id: personId,
          owner_id: user.id,
          category_domain: value.domain,
          subcategory: typeof value.subcategory === 'string' ? value.subcategory : null,
          is_primary: false,
          assignment_source: 'ai_suggested',
          confirmation_status: 'confirmed',
        });
      }
    }

    if (field.field_type === 'action_item') {
      const personId = await resolvePersonId(value);
      const title = redacted
        ? (field.field_label ?? 'Private follow-up')
        : (typeof value.task === 'string' ? value.task : field.field_value_text ?? field.field_label ?? 'Follow up');
      const certainty = (typeof value.commitment_certainty === 'string'
        ? value.commitment_certainty
        : field.confidence_level === 'high' ? 'c4_agreed' : field.confidence_level === 'medium' ? 'c3_implied' : 'c2_weak') as CommitmentCertainty;
      const actionType = (typeof value.action_type === 'string' ? value.action_type : 'scheduled_next_step') as ActionType;
      const ownerType = ['user', 'other_person', 'shared'].includes(String(value.owner)) ? value.owner : 'user';

      const { data: duplicate } = await supabase
        .from('lifeos_action_items')
        .select('id')
        .eq('source_extraction_id', extraction.id)
        .eq('title', title)
        .is('deleted_at', null)
        .maybeSingle();
      if (!duplicate) {
        const { data: action, error } = await supabase.from('lifeos_action_items').insert({
          owner_id: user.id,
          person_id: personId,
          source_interaction_id: extraction.interaction_id,
          source_extraction_id: extraction.id,
          action_type: actionType,
          title,
          description: redacted ? null : (typeof value.due_hint === 'string' ? value.due_hint : null),
          commitment_certainty: certainty,
          owner_type: ownerType,
          due_at: validDate(value.due_at),
          sensitivity_level: field.sensitivity_level,
          confirmation_status: 'confirmed',
          status: ['c5_explicit', 'c4_agreed'].includes(certainty) ? 'active' : certainty === 'c3_implied' ? 'accepted' : 'suggested',
          created_by: 'ai',
        }).select('id').single();
        if (error || !action) {
          Alert.alert('Could not create action', error?.message ?? 'Please try again.');
          return false;
        }
        await createAdaptiveReminder(action.id, personId, title, certainty, validDate(value.due_at), field.sensitivity_level);
      }
    }

    if (field.field_type === 'milestone') {
      const personId = await resolvePersonId(value);
      if (!personId) {
        Alert.alert('Choose a person first', 'This milestone could not be linked because the person was unclear.');
        return false;
      }
      const title = redacted
        ? (field.field_label ?? 'Private milestone')
        : (typeof value.title === 'string' ? value.title : field.field_value_text ?? field.field_label ?? 'Milestone');
      const milestoneDate = typeof value.milestone_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.milestone_date)
        ? value.milestone_date
        : null;
      const { data: duplicate } = await supabase
        .from('lifeos_milestones')
        .select('id')
        .eq('source_extraction_id', extraction.id)
        .eq('milestone_title', title)
        .is('deleted_at', null)
        .maybeSingle();
      if (!duplicate) await supabase.from('lifeos_milestones').insert({
        person_id: personId,
        owner_id: user.id,
        source_interaction_id: extraction.interaction_id,
        source_extraction_id: extraction.id,
        milestone_type: typeof value.milestone_type === 'string' ? value.milestone_type : 'custom',
        milestone_title: title,
        milestone_date: milestoneDate,
        sensitivity_level: field.sensitivity_level,
        confirmation_status: 'confirmed',
      });
    }

    return true;
  }

  async function saveSensitiveMemory(
    field: ExtractedField,
    mode: 'redacted' | 'full' | 'deny',
  ) {
    if (!user || !extraction) return;

    if (mode === 'deny') {
      await updateFieldStatus(field.id, 'rejected');
      await supabase.from('lifeos_audit_events').insert({
        owner_id: user.id,
        actor_type: 'user',
        event_type: 'sensitive_memory_denied',
        object_type: 'extracted_field',
        object_id: field.id,
        event_summary: 'User denied storage of sensitive content',
      });
      return;
    }

    const personValue = field.field_value_json as { person_name?: string; person_id?: string } | null;
    let personId: string | undefined;

    if (personValue?.person_id) {
      personId = personValue.person_id;
    } else if (personValue?.person_name) {
      const res = await supabase
        .from('lifeos_people')
        .select('id')
        .eq('owner_id', user.id)
        .ilike('normalized_name', personValue.person_name.toLowerCase())
        .limit(1)
        .single();
      if (res.data) personId = res.data.id;
    }

    if (!personId) {
      await updateFieldStatus(field.id, 'confirmed');
      return;
    }

    await supabase.from('lifeos_sensitive_memories').insert({
      person_id: personId,
      owner_id: user.id,
      source_extraction_id: extraction.id,
      memory_title: field.field_label ?? 'Sensitive note',
      memory_summary_minimal: mode === 'redacted'
        ? (field.field_label ?? 'Sensitive content noted')
        : (field.field_value_text ?? field.field_label ?? 'Sensitive note'),
      memory_detail: mode === 'full' ? (field.field_value_text ?? JSON.stringify(field.field_value_json)) : null,
      sensitivity_level: field.sensitivity_level === 'none_low' ? 'personal' : field.sensitivity_level,
      sensitivity_reason_codes: [],
      storage_consent_status: 'granted',
      allowed_uses: mode === 'redacted' ? ['audit_only'] : ['profile_display', 'briefing_generation'],
      briefing_visibility: mode === 'redacted' ? 'hidden' : 'collapsed',
    });

    const persisted = await persistConfirmedField(field, mode === 'redacted');
    if (!persisted) return;
    await updateFieldStatus(field.id, 'confirmed');

    await supabase.from('lifeos_audit_events').insert({
      owner_id: user.id,
      actor_type: 'user',
      event_type: `sensitive_memory_saved_${mode}`,
      object_type: 'sensitive_memory',
      object_id: field.id,
      event_summary: `User saved sensitive memory (${mode})`,
    });
  }

  function showSensitiveDialog(field: ExtractedField) {
    Alert.alert(
      'Sensitive Content Detected',
      `This field is marked as "${field.sensitivity_level.replace(/_/g, ' ')}". How would you like to save it?`,
      [
        { text: "Don't Save", style: 'destructive', onPress: () => saveSensitiveMemory(field, 'deny') },
        { text: 'Redacted Summary', onPress: () => saveSensitiveMemory(field, 'redacted') },
        { text: 'Save Full Detail', onPress: () => saveSensitiveMemory(field, 'full') },
      ],
      { cancelable: true },
    );
  }

  async function handleFieldAccept(field: ExtractedField) {
    if (isSensitiveField(field)) {
      showSensitiveDialog(field);
    } else {
      const persisted = await persistConfirmedField(field);
      if (persisted) await updateFieldStatus(field.id, 'confirmed');
    }
  }

  async function handleAcceptAll() {
    const pending = fields.filter(f => f.confirmation_status === 'suggested');
    if (pending.length === 0) return;

    const sensitiveFields = pending.filter(isSensitiveField);
    const normalFields = pending.filter(f => !isSensitiveField(f));

    for (const f of normalFields) {
      const persisted = await persistConfirmedField(f);
      if (persisted) await updateFieldStatus(f.id, 'confirmed');
    }

    if (sensitiveFields.length > 0) {
      Alert.alert(
        'Sensitive Fields Skipped',
        `${sensitiveFields.length} sensitive field${sensitiveFields.length === 1 ? '' : 's'} require${sensitiveFields.length === 1 ? 's' : ''} individual review.`,
      );
    }
  }

  async function handleMarkReviewed() {
    if (!extraction) return;

    const allDecided = fields.every(f => f.confirmation_status !== 'suggested');
    const reviewStatus = allDecided ? 'reviewed' : 'partially_reviewed';

    await supabase
      .from('lifeos_interaction_extractions')
      .update({ review_status: reviewStatus, reviewed_at: new Date().toISOString() })
      .eq('id', extraction.id);

    if (user) {
      await supabase.from('lifeos_audit_events').insert({
        owner_id: user.id,
        actor_type: 'user',
        event_type: 'extraction_reviewed',
        object_type: 'interaction_extraction',
        object_id: extraction.id,
        event_summary: `Extraction marked as ${reviewStatus}`,
      });
    }

    router.back();
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!extraction) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Extraction not found</Text>
      </View>
    );
  }

  const pendingCount = fields.filter(f => f.confirmation_status === 'suggested').length;
  const confirmedCount = fields.filter(f => f.confirmation_status === 'confirmed').length;
  const rejectedCount = fields.filter(f => f.confirmation_status === 'rejected').length;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Review Extraction</Text>
        <Text style={[styles.headerMeta, { color: colors.textSecondary }]}>
          {extraction.model_name ?? 'AI'} · {new Date(extraction.created_at).toLocaleString()}
        </Text>
        <View style={styles.statusRow}>
          {extraction.overall_confidence && (
            <View style={[styles.badge, { backgroundColor: confidenceBadge(extraction.overall_confidence).color + '22' }]}>
              <Text style={[styles.badgeText, { color: confidenceBadge(extraction.overall_confidence).color }]}>
                {confidenceBadge(extraction.overall_confidence).label} confidence
              </Text>
            </View>
          )}
          {extraction.contains_sensitive_candidate && (
            <View style={[styles.badge, { backgroundColor: brand.warning + '22' }]}>
              <Text style={[styles.badgeText, { color: brand.warning }]}>Contains sensitive</Text>
            </View>
          )}
        </View>
        <View style={styles.countsRow}>
          <Text style={[styles.countText, { color: colors.textSecondary }]}>
            {pendingCount} pending · {confirmedCount} accepted · {rejectedCount} rejected
          </Text>
        </View>
      </View>

      {/* Bulk actions */}
      {pendingCount > 0 && (
        <View style={styles.bulkActions}>
          <TouchableOpacity
            style={[styles.bulkBtn, { backgroundColor: brand.success }]}
            onPress={handleAcceptAll}
          >
            <Text style={styles.bulkBtnText}>Accept All ({pendingCount})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Field cards */}
      {fields.map(field => {
        const conf = confidenceBadge(field.confidence_level);
        const sens = sensitivityBadge(field.sensitivity_level);
        const isDecided = field.confirmation_status !== 'suggested';

        return (
          <View
            key={field.id}
            style={[
              styles.fieldCard,
              { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
              isDecided && styles.fieldCardDecided,
              field.confirmation_status === 'rejected' && { opacity: 0.5 },
            ]}
          >
            {/* Field header */}
            <View style={styles.fieldHeader}>
              <View style={styles.fieldTypeRow}>
                <Text style={styles.fieldIcon}>{fieldTypeIcon(field.field_type)}</Text>
                <Text style={[styles.fieldType, { color: colors.textSecondary }]}>
                  {fieldTypeLabel(field.field_type)}
                </Text>
              </View>
              <View style={styles.badgeRow}>
                <View style={[styles.miniBadge, { backgroundColor: conf.color + '22' }]}>
                  <Text style={[styles.miniBadgeText, { color: conf.color }]}>{conf.label}</Text>
                </View>
                {sens && (
                  <View style={[styles.miniBadge, { backgroundColor: sens.color + '22' }]}>
                    <Text style={[styles.miniBadgeText, { color: sens.color }]}>{sens.label}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Field label */}
            {field.field_label && (
              <Text style={[styles.fieldLabel, { color: colors.text }]}>{field.field_label}</Text>
            )}

            {/* Field value */}
            <Text style={[styles.fieldValue, { color: colors.text }]}>
              {field.field_value_text ?? (field.field_value_json ? JSON.stringify(field.field_value_json) : '—')}
            </Text>

            {/* Evidence quote */}
            {field.evidence_quote && (
              <View style={[styles.evidenceBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.evidenceText, { color: colors.textSecondary }]}>
                  "{field.evidence_quote}"
                </Text>
              </View>
            )}

            {/* Status indicator for decided fields */}
            {isDecided && (
              <View style={[styles.decidedBanner, {
                backgroundColor: field.confirmation_status === 'confirmed' ? brand.success + '15' : brand.danger + '15',
              }]}>
                <Text style={{
                  color: field.confirmation_status === 'confirmed' ? brand.success : brand.danger,
                  fontSize: 12,
                  fontWeight: '700',
                }}>
                  {field.confirmation_status === 'confirmed' ? 'ACCEPTED' : 'REJECTED'}
                </Text>
              </View>
            )}

            {/* Actions */}
            {!isDecided && (
              <View style={styles.fieldActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: brand.success }]}
                  onPress={() => handleFieldAccept(field)}
                >
                  <Text style={styles.actionBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: brand.danger }]}
                  onPress={() => updateFieldStatus(field.id, 'rejected')}
                >
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {fields.length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No extracted fields to review.
          </Text>
        </View>
      )}

      {/* Done button */}
      <TouchableOpacity
        style={[styles.doneBtn, { backgroundColor: brand.primary }]}
        onPress={handleMarkReviewed}
      >
        <Text style={styles.doneBtnText}>
          {pendingCount > 0 ? `Done (${pendingCount} still pending)` : 'Mark Reviewed'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  headerMeta: { fontSize: 13, marginBottom: 10 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  countsRow: { marginTop: 4 },
  countText: { fontSize: 12 },
  bulkActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  bulkBtn: { flex: 1, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  bulkBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  fieldCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  fieldCardDecided: {},
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fieldTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldIcon: { fontSize: 16 },
  fieldType: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniBadgeText: { fontSize: 9, fontWeight: '800' },
  fieldLabel: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  fieldValue: { fontSize: 14, lineHeight: 22 },
  evidenceBox: { marginTop: 8, padding: 10, borderRadius: 8 },
  evidenceText: { fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
  decidedBanner: { marginTop: 10, padding: 8, borderRadius: 6, alignItems: 'center' },
  fieldActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyCard: { padding: 20, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  doneBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
