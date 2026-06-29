import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { PersonPreferences } from '@/lib/types';

const CADENCE_OPTIONS = [
  { days: 7, label: 'Weekly' },
  { days: 14, label: 'Bi-weekly' },
  { days: 30, label: 'Monthly' },
  { days: 90, label: 'Quarterly' },
  { days: null as number | null, label: 'No target' },
];

const REMINDER_POLICIES = [
  { key: 'normal', label: 'Normal', desc: 'Standard reminders' },
  { key: 'gentle', label: 'Gentle', desc: 'Less frequent, softer tone' },
  { key: 'minimal', label: 'Minimal', desc: 'Only urgent items' },
  { key: 'none', label: 'None', desc: 'No reminders' },
];

const BRIEFING_DEPTHS = [
  { key: 'minimal', label: 'Minimal' },
  { key: 'standard', label: 'Standard' },
  { key: 'detailed', label: 'Detailed' },
];

export default function PersonPreferencesScreen() {
  const { id: personId } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<PersonPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [cadenceDays, setCadenceDays] = useState<number | null>(null);
  const [reminderPolicy, setReminderPolicy] = useState('normal');
  const [allowAI, setAllowAI] = useState(true);
  const [allowSensitiveBriefing, setAllowSensitiveBriefing] = useState(false);
  const [briefingDepth, setBriefingDepth] = useState('standard');
  const [topicsToAvoid, setTopicsToAvoid] = useState('');
  const [boundaryState, setBoundaryState] = useState('none');

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('lifeos_person_preferences')
      .select('*')
      .eq('person_id', personId)
      .eq('owner_id', user.id)
      .single();

    if (data) {
      setPrefs(data);
      setCadenceDays(data.desired_contact_cadence_days);
      setReminderPolicy(data.reminder_policy);
      setAllowAI(data.allow_ai_suggestions);
      setAllowSensitiveBriefing(data.allow_sensitive_in_briefings);
      setBriefingDepth(data.briefing_depth);
      setTopicsToAvoid(data.topics_to_avoid ?? '');
      setBoundaryState(data.boundary_state);
    }
    setLoading(false);
  }, [personId, user]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const payload = {
      person_id: personId,
      owner_id: user.id,
      desired_contact_cadence_days: cadenceDays,
      reminder_policy: reminderPolicy,
      allow_ai_suggestions: allowAI,
      allow_sensitive_in_briefings: allowSensitiveBriefing,
      briefing_depth: briefingDepth,
      topics_to_avoid: topicsToAvoid.trim() || null,
      boundary_state: boundaryState,
    };

    if (prefs) {
      await supabase
        .from('lifeos_person_preferences')
        .update(payload)
        .eq('id', prefs.id);
    } else {
      await supabase
        .from('lifeos_person_preferences')
        .insert(payload);
    }

    await supabase.from('lifeos_audit_events').insert({
      owner_id: user.id,
      actor_type: 'user',
      event_type: 'person_preferences_updated',
      object_type: 'person_preferences',
      object_id: personId,
      event_summary: 'Person preferences saved',
    });

    setSaving(false);
    router.back();
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Preferences</Text>

      {/* Contact Cadence */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Cadence</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          How often would you like to stay in touch?
        </Text>
        <View style={styles.chipRow}>
          {CADENCE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.label}
              style={[
                styles.chip,
                { borderColor: colors.surfaceBorder },
                cadenceDays === opt.days && { backgroundColor: brand.primary + '22', borderColor: brand.primary },
              ]}
              onPress={() => setCadenceDays(opt.days)}
            >
              <Text style={[
                styles.chipText,
                { color: colors.textSecondary },
                cadenceDays === opt.days && { color: brand.primary },
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Reminder Policy */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Reminder Policy</Text>
        <View style={styles.chipRow}>
          {REMINDER_POLICIES.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.chip,
                { borderColor: colors.surfaceBorder },
                reminderPolicy === p.key && { backgroundColor: brand.primary + '22', borderColor: brand.primary },
              ]}
              onPress={() => setReminderPolicy(p.key)}
            >
              <Text style={[
                styles.chipText,
                { color: colors.textSecondary },
                reminderPolicy === p.key && { color: brand.primary },
              ]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* AI Controls */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Controls</Text>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Allow AI suggestions</Text>
            <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
              AI can suggest actions and recommendations
            </Text>
          </View>
          <Switch value={allowAI} onValueChange={setAllowAI} trackColor={{ true: brand.primary }} />
        </View>

        <View style={[styles.switchRow, { marginTop: 14 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Include sensitive in briefings</Text>
            <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
              Show sensitive notes in pre-conversation briefings
            </Text>
          </View>
          <Switch value={allowSensitiveBriefing} onValueChange={setAllowSensitiveBriefing} trackColor={{ true: brand.primary }} />
        </View>
      </View>

      {/* Briefing Depth */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Briefing Depth</Text>
        <View style={styles.chipRow}>
          {BRIEFING_DEPTHS.map(d => (
            <TouchableOpacity
              key={d.key}
              style={[
                styles.chip,
                { borderColor: colors.surfaceBorder },
                briefingDepth === d.key && { backgroundColor: brand.primary + '22', borderColor: brand.primary },
              ]}
              onPress={() => setBriefingDepth(d.key)}
            >
              <Text style={[
                styles.chipText,
                { color: colors.textSecondary },
                briefingDepth === d.key && { color: brand.primary },
              ]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Topics to Avoid */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Topics to Avoid</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Comma-separated topics that should be excluded from briefings and recommendations
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
          value={topicsToAvoid}
          onChangeText={setTopicsToAvoid}
          placeholder="e.g. politics, religion, salary"
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      {/* Boundary */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Boundary State</Text>
        <View style={styles.chipRow}>
          {['none', 'cooling_off', 'limited', 'no_contact'].map(b => (
            <TouchableOpacity
              key={b}
              style={[
                styles.chip,
                { borderColor: colors.surfaceBorder },
                boundaryState === b && { backgroundColor: brand.warning + '22', borderColor: brand.warning },
              ]}
              onPress={() => setBoundaryState(b)}
            >
              <Text style={[
                styles.chipText,
                { color: colors.textSecondary },
                boundaryState === b && { color: brand.warning },
              ]}>
                {b.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: brand.primary }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Preferences'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  section: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sectionDesc: { fontSize: 12, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  switchDesc: { fontSize: 12, marginTop: 2 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginTop: 8, minHeight: 60, textAlignVertical: 'top' },
  saveBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
