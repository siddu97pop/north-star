import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchPersonBriefing, fetchPersonRelationshipState, generatePersonRecommendations } from '@/lib/api';
import { buildLocalBriefing } from '@/lib/briefing';
import { loadRecommendations } from '@/lib/recommendations';
import { computeLocalRelationshipState } from '@/lib/relationship-state';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import CategoryPicker from '@/components/CategoryPicker';
import FunctionPicker from '@/components/FunctionPicker';
import SensitiveMemoryCard from '@/components/SensitiveMemoryCard';
import ActionItemCard from '@/components/ActionItemCard';
import RecommendationCard from '@/components/RecommendationCard';
import RelationshipStateCard from '@/components/RelationshipStateCard';
import type {
  ActionItem,
  ActionStatus,
  CalendarEvent,
  CategoryAssignment,
  CategoryDomain,
  AttentionTier,
  FunctionType,
  Interaction,
  Milestone,
  Person,
  PersonPreferences,
  Recommendation,
  RecommendationEvidence,
  RelationshipFunction,
  RelationshipDormancyState,
  RelationshipHealthState,
  RelationshipMomentumState,
  RelationshipState,
  RelationshipSignal,
  SensitiveMemory,
} from '@/lib/types';

const RELATIONSHIPS = ['family', 'friend', 'colleague', 'acquaintance', 'other'] as const;

const ATTENTION_TIERS: { key: AttentionTier; label: string; desc: string; color: string }[] = [
  { key: 'high_attention', label: 'High Attention', desc: 'Active focus', color: brand.danger },
  { key: 'active_maintenance', label: 'Active Maintenance', desc: 'Regular check-ins', color: brand.success },
  { key: 'light_touch', label: 'Light Touch', desc: 'Occasional contact', color: brand.primary },
  { key: 'needs_attention', label: 'Needs Attention', desc: 'Overdue for contact', color: brand.warning },
  { key: 'private_do_not_analyze', label: 'Private', desc: 'Excluded from AI', color: '#6B7280' },
];

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { session, user } = useAuth();

  const [person, setPerson] = useState<Person | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [categories, setCategories] = useState<CategoryAssignment[]>([]);
  const [functions, setFunctions] = useState<RelationshipFunction[]>([]);
  const [sensitiveMemories, setSensitiveMemories] = useState<SensitiveMemory[]>([]);
  const [preferences, setPreferences] = useState<PersonPreferences | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [relationshipState, setRelationshipState] = useState<RelationshipState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [showStateOverride, setShowStateOverride] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingSource, setBriefingSource] = useState<'anthropic' | 'fallback' | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

  const [editName, setEditName] = useState('');
  const [editRelationship, setEditRelationship] = useState<string>('friend');
  const [editCompany, setEditCompany] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLinkedin, setEditLinkedin] = useState('');
  const [editRoleTitle, setEditRoleTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneType, setMilestoneType] = useState('custom');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [overrideHealth, setOverrideHealth] = useState<RelationshipHealthState>('unknown');
  const [overrideMomentum, setOverrideMomentum] = useState<RelationshipMomentumState>('unknown');
  const [overrideDormancy, setOverrideDormancy] = useState<RelationshipDormancyState>('active');

  const loadPerson = useCallback(async () => {
    const personRes = await supabase.from('lifeos_people').select('*').eq('id', id).single();

    if (personRes.data) {
      setPerson(personRes.data);
      setEditName(personRes.data.name);
      setEditRelationship(personRes.data.relationship ?? 'other');
      setEditCompany(personRes.data.company ?? '');
      setEditNotes(personRes.data.notes ?? '');
      setEditLinkedin(personRes.data.linkedin_url ?? '');
      setEditRoleTitle(personRes.data.primary_role_title ?? '');
      setEditSummary(personRes.data.profile_summary_user ?? '');

      const [interactionRes, attendeeRes, catRes, funcRes, sensRes, prefsRes, actionsRes, milestonesRes, signalsRes] = await Promise.all([
        supabase
          .from('lifeos_interactions')
          .select('*')
          .eq('person_id', id)
          .order('interaction_date', { ascending: false })
          .limit(50),
        supabase
          .from('lifeos_event_attendees')
          .select('event_id')
          .or(
            [
              personRes.data.email ? `email.eq.${personRes.data.email}` : null,
              `name.ilike.${personRes.data.name}`,
            ]
              .filter(Boolean)
              .join(',')
          ),
        supabase
          .from('lifeos_category_assignments')
          .select('*')
          .eq('person_id', id)
          .is('deleted_at', null),
        supabase
          .from('lifeos_relationship_functions')
          .select('*')
          .eq('person_id', id)
          .is('deleted_at', null),
        supabase
          .from('lifeos_sensitive_memories')
          .select('*')
          .eq('person_id', id)
          .eq('storage_consent_status', 'granted')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('lifeos_person_preferences')
          .select('*')
          .eq('person_id', id)
          .single(),
        supabase
          .from('lifeos_action_items')
          .select('*, person:lifeos_people(id,name)')
          .eq('person_id', id)
          .in('status', ['suggested', 'accepted', 'active', 'snoozed', 'deferred', 'blocked'])
          .is('deleted_at', null)
          .order('due_at', { ascending: true, nullsFirst: false }),
        supabase
          .from('lifeos_milestones')
          .select('*')
          .eq('person_id', id)
          .eq('confirmation_status', 'confirmed')
          .is('deleted_at', null)
          .order('milestone_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('lifeos_relationship_signals')
          .select('*')
          .eq('person_id', id)
          .eq('confirmation_status', 'confirmed')
          .eq('is_active', true)
          .is('deleted_at', null),
      ]);

      if (interactionRes.data) setInteractions(interactionRes.data);
      if (catRes.data) setCategories(catRes.data);
      if (funcRes.data) setFunctions(funcRes.data);
      if (sensRes.data) setSensitiveMemories(sensRes.data);
      if (prefsRes.data) setPreferences(prefsRes.data);
      if (actionsRes.data) setActions(actionsRes.data as ActionItem[]);
      if (milestonesRes.data) setMilestones(milestonesRes.data as Milestone[]);
      setRecommendations(await loadRecommendations(id, 3).catch(() => []));

      try {
        const result = await fetchPersonRelationshipState(id, session);
        setRelationshipState(result.state);
      } catch (_error) {
        const { data: localState } = await supabase
          .from('lifeos_relationship_state')
          .select('*')
          .eq('person_id', id)
          .eq('snapshot_type', 'current')
          .is('superseded_at', null)
          .maybeSingle();
        if (localState?.created_by === 'user') {
          setRelationshipState(localState as RelationshipState);
        } else if (!personRes.data.is_private_do_not_analyze) {
          const draft = computeLocalRelationshipState({
            signals: (signalsRes.data ?? []) as RelationshipSignal[],
            lastInteractionAt: personRes.data.last_interaction_at,
            hasCommitment: (actionsRes.data ?? []).some(action => ['c5_explicit', 'c4_agreed'].includes(action.commitment_certainty ?? '')),
            hasMilestone: (milestonesRes.data ?? []).some(milestone => {
              if (!milestone.milestone_date) return false;
              const daysAway = (new Date(`${milestone.milestone_date}T00:00:00`).getTime() - Date.now()) / 86_400_000;
              return daysAway >= 0 && daysAway <= 30;
            }),
          });
          const values = { ...draft, confirmation_status: 'suggested', created_by: 'system' };
          const { data: savedState } = localState
            ? await supabase.from('lifeos_relationship_state').update(values).eq('id', localState.id).select('*').single()
            : await supabase.from('lifeos_relationship_state').insert({
                person_id: id,
                owner_id: personRes.data.owner_id,
                ...values,
                snapshot_type: 'current',
              }).select('*').single();
          setRelationshipState((savedState as RelationshipState | null) ?? null);
        }
      }

      const eventIds = (attendeeRes.data ?? []).map((item) => item.event_id);

      if (eventIds.length > 0) {
        const eventsRes = await supabase
          .from('lifeos_events')
          .select('*')
          .in('id', eventIds)
          .gte('start_at', new Date().toISOString())
          .order('start_at')
          .limit(5);

        if (eventsRes.data) setUpcomingEvents(eventsRes.data);
      } else {
        setUpcomingEvents([]);
      }
    }

    setLoading(false);
  }, [id, session]);

  useEffect(() => {
    loadPerson();
  }, [loadPerson]);

  function domainColor(domain: CategoryDomain): string {
    switch (domain) {
      case 'work': return brand.accent;
      case 'personal': return brand.danger;
      case 'other_strategic': return brand.warning;
    }
  }

  function primaryDomainColor(): string {
    const primary = categories.find(c => c.is_primary) ?? categories[0];
    return primary ? domainColor(primary.category_domain) : colors.textSecondary;
  }

  function sourceIcon(source: string) {
    switch (source) {
      case 'voice_note': return '🎙';
      case 'calendar_event': return '📅';
      default: return '✏️';
    }
  }

  async function handleSave() {
    if (!person || !editName.trim()) return;
    setSaving(true);

    const { data, error } = await supabase
      .from('lifeos_people')
      .update({
        name: editName.trim(),
        normalized_name: editName.trim().toLowerCase(),
        relationship: editRelationship,
        company: editCompany.trim() || null,
        notes: editNotes.trim() || null,
        linkedin_url: editLinkedin.trim() || null,
        primary_role_title: editRoleTitle.trim() || null,
        profile_summary_user: editSummary.trim() || null,
      })
      .eq('id', person.id)
      .select('*')
      .single();

    setSaving(false);

    if (error) {
      console.error('Failed to update person:', error);
      return;
    }

    if (data) setPerson(data);
    setShowEdit(false);
  }

  async function handleTierChange(tier: AttentionTier) {
    if (!person) return;
    const { data } = await supabase
      .from('lifeos_people')
      .update({ attention_tier: tier })
      .eq('id', person.id)
      .select('*')
      .single();
    if (data) setPerson(data);
  }

  async function handleAddCategory(domain: CategoryDomain, subcategory: string, isPrimary: boolean) {
    if (!user || !person) return;
    const { data } = await supabase
      .from('lifeos_category_assignments')
      .insert({
        person_id: person.id,
        owner_id: user.id,
        category_domain: domain,
        subcategory,
        is_primary: isPrimary,
      })
      .select('*')
      .single();
    if (data) setCategories(prev => [...prev, data]);
  }

  async function handleRemoveCategory(catId: string) {
    await supabase
      .from('lifeos_category_assignments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', catId);
    setCategories(prev => prev.filter(c => c.id !== catId));
  }

  async function handleAddFunction(functionType: FunctionType) {
    if (!user || !person) return;
    const { data } = await supabase
      .from('lifeos_relationship_functions')
      .insert({
        person_id: person.id,
        owner_id: user.id,
        function_type: functionType,
      })
      .select('*')
      .single();
    if (data) setFunctions(prev => [...prev, data]);
  }

  async function handleRemoveFunction(funcId: string) {
    await supabase
      .from('lifeos_relationship_functions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', funcId);
    setFunctions(prev => prev.filter(f => f.id !== funcId));
  }

  async function handleRevokeSensitiveMemory(memoryId: string) {
    await supabase
      .from('lifeos_sensitive_memories')
      .update({ storage_consent_status: 'revoked', is_active: false, updated_at: new Date().toISOString() })
      .eq('id', memoryId);
    setSensitiveMemories(prev => prev.filter(m => m.id !== memoryId));
    if (user) {
      await supabase.from('lifeos_audit_events').insert({
        owner_id: user.id,
        actor_type: 'user',
        event_type: 'sensitive_memory_revoked',
        object_type: 'sensitive_memory',
        object_id: memoryId,
        event_summary: 'User revoked consent for sensitive memory',
      });
    }
  }

  async function handleBriefMe() {
    if (!person) return;
    setBriefingLoading(true);
    try {
      const result = await fetchPersonBriefing(person.id, session);
      setBriefing(result.briefing);
      setBriefingSource(result.source);
    } catch (_error) {
      setBriefing(buildLocalBriefing({ person, interactions, upcomingEvents }));
      setBriefingSource('fallback');
    } finally {
      setBriefingLoading(false);
    }
  }

  async function handleGenerateRecommendations() {
    if (!person || !session) return;
    setRecommendationsLoading(true);
    try {
      const result = await generatePersonRecommendations(person.id, session);
      const refreshed = result.cards.length > 0 ? result.cards : await loadRecommendations(person.id, 3);
      setRecommendations(refreshed);
      if (refreshed.length === 0) {
        const reason = result.reason === 'private_do_not_analyze'
          ? 'This person is marked Private / Do Not Analyse.'
          : result.reason === 'person_preferences'
            ? 'Suggestions are disabled in this person’s preferences.'
            : 'No confirmed evidence currently supports a suggestion.';
        Alert.alert('No suggestions generated', reason);
      }
    } catch (error) {
      Alert.alert('Could not generate suggestions', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRecommendationsLoading(false);
    }
  }

  function openRecommendationEvidence(evidence: RecommendationEvidence) {
    if (evidence.evidence_object_type === 'interaction') router.push(`/interaction/${evidence.evidence_object_id}`);
    else if (evidence.evidence_object_type === 'action_item') router.push('/actions');
  }

  async function handleActionStatus(item: ActionItem, status: ActionStatus) {
    const now = new Date();
    const due = new Date(now);
    if (status === 'snoozed') due.setDate(now.getDate() + 1);
    if (status === 'deferred') due.setDate(now.getDate() + 7);
    const update = {
      status,
      due_at: status === 'snoozed' || status === 'deferred' ? due.toISOString() : item.due_at,
      completed_at: status === 'completed' ? now.toISOString() : null,
      updated_at: now.toISOString(),
    };
    const { error } = await supabase.from('lifeos_action_items').update(update).eq('id', item.id);
    if (error) {
      Alert.alert('Could not update action', error.message);
      return;
    }
    const reminderState = status === 'completed' ? 'done' : status === 'dismissed' ? 'dismissed' : status;
    await supabase.from('lifeos_reminders').update({
      state: reminderState,
      snoozed_until: status === 'snoozed' || status === 'deferred' ? due.toISOString() : null,
      completed_at: status === 'completed' ? now.toISOString() : null,
      updated_at: now.toISOString(),
    }).eq('action_item_id', item.id);
    setActions(prev => prev
      .map(current => current.id === item.id ? { ...current, ...update } as ActionItem : current)
      .filter(current => !['completed', 'dismissed', 'no_longer_relevant'].includes(current.status)));
  }

  async function handleAddMilestone() {
    if (!user || !person || !milestoneTitle.trim()) return;
    if (milestoneDate && !/^\d{4}-\d{2}-\d{2}$/.test(milestoneDate)) {
      Alert.alert('Check the date', 'Use YYYY-MM-DD, or leave it blank.');
      return;
    }
    const { data, error } = await supabase.from('lifeos_milestones').insert({
      owner_id: user.id,
      person_id: person.id,
      milestone_type: milestoneType.trim() || 'custom',
      milestone_title: milestoneTitle.trim(),
      milestone_date: milestoneDate || null,
      sensitivity_level: 'none_low',
      confirmation_status: 'confirmed',
    }).select('*').single();
    if (error) {
      Alert.alert('Could not save milestone', error.message);
      return;
    }
    if (data) setMilestones(prev => [...prev, data as Milestone].sort((a, b) =>
      (a.milestone_date ?? '9999').localeCompare(b.milestone_date ?? '9999')));
    await supabase.from('lifeos_audit_events').insert({
      owner_id: user.id,
      actor_type: 'user',
      event_type: 'milestone_created',
      object_type: 'milestone',
      object_id: data?.id,
      event_summary: 'User created a milestone',
    });
    setMilestoneTitle('');
    setMilestoneType('custom');
    setMilestoneDate('');
    setShowMilestone(false);
  }

  function openStateOverride() {
    setOverrideHealth(relationshipState?.health_state ?? 'unknown');
    setOverrideMomentum(relationshipState?.momentum_state ?? 'unknown');
    setOverrideDormancy(relationshipState?.dormancy_state ?? 'active');
    setShowStateOverride(true);
  }

  async function handleStateOverride() {
    if (!user || !person) return;
    const now = new Date().toISOString();
    const { error: historyError } = await supabase.from('lifeos_relationship_state').update({
      snapshot_type: 'historical',
      superseded_at: now,
    }).eq('person_id', person.id).eq('snapshot_type', 'current').is('superseded_at', null);
    if (historyError) {
      Alert.alert('Could not save your override', historyError.message);
      return;
    }

    const { data, error } = await supabase.from('lifeos_relationship_state').insert({
      person_id: person.id,
      owner_id: user.id,
      snapshot_type: 'current',
      health_state: overrideHealth,
      momentum_state: overrideMomentum,
      dormancy_state: overrideDormancy,
      attention_overlay: null,
      reason_codes: ['USER_OVERRIDE'],
      confidence_level: 'high',
      confirmation_status: 'confirmed',
      created_by: 'user',
    }).select('*').single();
    if (error || !data) {
      Alert.alert('Could not save your override', error?.message ?? 'Please try again.');
      return;
    }

    await supabase.from('lifeos_audit_events').insert({
      owner_id: user.id,
      actor_type: 'user',
      event_type: 'relationship_state_overridden',
      object_type: 'relationship_state',
      object_id: data.id,
      event_summary: 'User overrode qualitative relationship state labels',
    });
    setRelationshipState(data as RelationshipState);
    setShowStateOverride(false);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!person) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Person not found</Text>
      </View>
    );
  }

  const activeTier = ATTENTION_TIERS.find(t => t.key === person.attention_tier) ?? ATTENTION_TIERS[2];

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={styles.headerSection}>
          <View style={[styles.avatar, { backgroundColor: primaryDomainColor() + '22' }]}>
            <Text style={[styles.avatarText, { color: primaryDomainColor() }]}>
              {person.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{person.name}</Text>
          {person.primary_role_title ? (
            <Text style={[styles.roleTitle, { color: colors.textSecondary }]}>{person.primary_role_title}</Text>
          ) : null}
          {person.company ? <Text style={[styles.company, { color: colors.textSecondary }]}>{person.company}</Text> : null}
          <View style={styles.headerButtons}>
            <TouchableOpacity style={[styles.editBtn, { backgroundColor: brand.primary }]} onPress={() => setShowEdit(true)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editBtn, styles.briefBtn, { borderColor: colors.surfaceBorder }]} onPress={handleBriefMe}>
              <Text style={[styles.briefBtnText, { color: colors.text }]}>Brief Me</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Attention Tier */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Attention Tier</Text>
          <View style={styles.tierRow}>
            {ATTENTION_TIERS.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tierChip,
                  { borderColor: colors.surfaceBorder },
                  person.attention_tier === t.key && { backgroundColor: t.color + '22', borderColor: t.color },
                ]}
                onPress={() => handleTierChange(t.key)}
              >
                <Text style={[
                  styles.tierChipText,
                  { color: colors.textSecondary },
                  person.attention_tier === t.key && { color: t.color },
                ]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <RelationshipStateCard state={relationshipState} onEdit={openStateOverride} />

        {/* Categories */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Categories</Text>
          <CategoryPicker
            assignments={categories}
            onAdd={handleAddCategory}
            onRemove={handleRemoveCategory}
          />
        </View>

        {/* Relationship Functions */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Functions</Text>
          <FunctionPicker
            functions={functions}
            onAdd={handleAddFunction}
            onRemove={handleRemoveFunction}
          />
        </View>

        {/* Briefing */}
        {briefingLoading ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <ActivityIndicator color={brand.accent} />
            <Text style={[styles.briefingMeta, { color: colors.textSecondary, marginTop: 10 }]}>
              Building a meeting brief...
            </Text>
          </View>
        ) : briefing ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <View style={styles.briefingHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Briefing</Text>
              <Text style={[styles.briefingMeta, { color: colors.textSecondary }]}>
                {briefingSource === 'anthropic' ? 'AI summary' : 'Local fallback'}
              </Text>
            </View>
            <Text style={[styles.bodyText, { color: colors.text }]}>{briefing}</Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>{person.total_interactions}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Interactions</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>
              {person.last_interaction_at
                ? new Date(person.last_interaction_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Last Seen</Text>
          </View>
        </View>

        {/* User Summary */}
        {person.profile_summary_user ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
            <Text style={[styles.bodyText, { color: colors.text }]}>{person.profile_summary_user}</Text>
          </View>
        ) : null}

        {/* Sensitive Notes */}
        {sensitiveMemories.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Sensitive Notes</Text>
            {sensitiveMemories.map(m => (
              <SensitiveMemoryCard key={m.id} memory={m} onRevoke={handleRevokeSensitiveMemory} />
            ))}
          </View>
        )}

        {/* Preferences */}
        <TouchableOpacity
          style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
          onPress={() => router.push(`/person/preferences/${id}`)}
        >
          <View style={styles.prefsRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 2 }]}>Preferences</Text>
              <Text style={[styles.prefsMeta, { color: colors.textSecondary }]}>
                {preferences
                  ? `Cadence: ${preferences.desired_contact_cadence_days ? `${preferences.desired_contact_cadence_days}d` : 'none'} · Reminders: ${preferences.reminder_policy} · AI: ${preferences.allow_ai_suggestions ? 'on' : 'off'}`
                  : 'Tap to set contact cadence, AI controls, and more'}
              </Text>
            </View>
            <Text style={[styles.prefsArrow, { color: colors.textSecondary }]}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Recommendations */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Recommendations</Text>
            <TouchableOpacity onPress={() => router.push('/recommendations')} accessibilityRole="button">
              <Text style={[styles.sectionLink, { color: brand.primaryLight }]}>Review all</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.generateButton, { borderColor: brand.primaryLight + '66' }, recommendationsLoading && { opacity: 0.5 }]}
            onPress={handleGenerateRecommendations}
            disabled={recommendationsLoading || person.is_private_do_not_analyze || preferences?.allow_ai_suggestions === false}
            accessibilityRole="button"
            accessibilityLabel="Generate evidence-based recommendations"
          >
            {recommendationsLoading ? <ActivityIndicator size="small" color={brand.primaryLight} /> : (
              <Text style={[styles.generateButtonText, { color: brand.primaryLight }]}>Generate from confirmed evidence</Text>
            )}
          </TouchableOpacity>
          <View style={styles.embeddedList}>
            {recommendations.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>No active suggestions for this person</Text>
            ) : recommendations.map(item => (
              <RecommendationCard key={item.id} recommendation={item} compact onEvidencePress={openRecommendationEvidence} />
            ))}
          </View>
        </View>

        {/* Open Actions */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Open Actions</Text>
            <TouchableOpacity onPress={() => router.push('/actions')}><Text style={[styles.sectionLink, { color: brand.primaryLight }]}>View all</Text></TouchableOpacity>
          </View>
          <View style={styles.embeddedList}>
            {actions.length === 0 ? <Text style={[styles.empty, { color: colors.textSecondary }]}>No open commitments</Text> : actions.slice(0, 3).map(action => (
              <ActionItemCard key={action.id} item={action} onStatusChange={handleActionStatus} compact />
            ))}
          </View>
        </View>

        {/* Milestones */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Milestones</Text>
            <TouchableOpacity onPress={() => setShowMilestone(true)}><Text style={[styles.sectionLink, { color: brand.primaryLight }]}>+ Add</Text></TouchableOpacity>
          </View>
          {milestones.length === 0 ? <Text style={[styles.empty, { color: colors.textSecondary }]}>No milestones saved</Text> : milestones.map(milestone => (
            <View key={milestone.id} style={styles.milestoneRow}>
              <Text style={styles.milestoneIcon}>🎯</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inlineTitle, { color: colors.text }]}>{milestone.milestone_title}</Text>
                <Text style={[styles.inlineMeta, { color: colors.textSecondary }]}>
                  {milestone.milestone_type.replace(/_/g, ' ')}{milestone.milestone_date ? ` · ${new Date(`${milestone.milestone_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {upcomingEvents.length > 0 ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Shared Events</Text>
            {upcomingEvents.map((event) => (
              <View key={event.id} style={styles.inlineRow}>
                <Text style={[styles.inlineTitle, { color: colors.text }]}>{event.title}</Text>
                <Text style={[styles.inlineMeta, { color: colors.textSecondary }]}>
                  {new Date(event.start_at).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {person.notes ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text>
            <Text style={[styles.bodyText, { color: colors.text }]}>{person.notes}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 12 }]}>Interaction History</Text>
        {interactions.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>No interactions recorded yet</Text>
        ) : (
          interactions.map((item) => (
            <View key={item.id} style={[styles.interactionRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <Text style={styles.sourceIcon}>{sourceIcon(item.source)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.interactionCtx, { color: colors.text }]}>{item.context || item.source.replace('_', ' ')}</Text>
                <Text style={[styles.interactionDate, { color: colors.textSecondary }]}>
                  {new Date(item.interaction_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {item.topics.length > 0 ? ` · ${item.topics.join(', ')}` : ''}
                </Text>
              </View>
              {item.sentiment ? (
                <Text style={styles.sentiment}>
                  {item.sentiment === 'positive' ? '😊' : item.sentiment === 'negative' ? '😔' : item.sentiment === 'mixed' ? '😐' : ''}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Person</Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Name"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Role / Title</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editRoleTitle}
              onChangeText={setEditRoleTitle}
              placeholder="e.g. VP Engineering at Google"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Relationship</Text>
            <View style={styles.relRow}>
              {RELATIONSHIPS.map((relationship) => (
                <TouchableOpacity
                  key={relationship}
                  style={[
                    styles.relChip,
                    { borderColor: colors.surfaceBorder },
                    editRelationship === relationship && { backgroundColor: brand.primary, borderColor: brand.primary },
                  ]}
                  onPress={() => setEditRelationship(relationship)}
                >
                  <Text
                    style={[
                      styles.relChipText,
                      { color: colors.textSecondary },
                      editRelationship === relationship && { color: '#fff' },
                    ]}
                  >
                    {relationship}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Company</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editCompany}
              onChangeText={setEditCompany}
              placeholder="Optional"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>LinkedIn URL</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editLinkedin}
              onChangeText={setEditLinkedin}
              placeholder="https://linkedin.com/in/..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>About This Person</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editSummary}
              onChangeText={setEditSummary}
              placeholder="Brief summary — who they are and why they matter to you"
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Optional notes..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.surfaceBorder, borderWidth: 1 }]}
                onPress={() => setShowEdit(false)}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: brand.primary }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showMilestone} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.milestoneModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Milestone</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]} value={milestoneTitle} onChangeText={setMilestoneTitle} placeholder="e.g. Promotion anniversary" placeholderTextColor={colors.textSecondary} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]} value={milestoneType} onChangeText={setMilestoneType} placeholder="birthday, promotion, move..." placeholderTextColor={colors.textSecondary} autoCapitalize="none" />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Date (optional)</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]} value={milestoneDate} onChangeText={setMilestoneDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} keyboardType="numbers-and-punctuation" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.surfaceBorder, borderWidth: 1 }]} onPress={() => setShowMilestone(false)}><Text style={{ color: colors.text }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: brand.primary }]} onPress={handleAddMilestone}><Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showStateOverride} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Adjust Relationship State</Text>
            <Text style={[styles.overrideIntro, { color: colors.textSecondary }]}>Your labels supersede AI suggestions until you change them.</Text>
            <StateChoice
              label="Health"
              value={overrideHealth}
              options={['stable', 'positive', 'quiet_but_ok', 'needs_attention', 'care_followup', 'repair_tension', 'unknown']}
              onChange={value => setOverrideHealth(value as RelationshipHealthState)}
              colors={colors}
            />
            <StateChoice
              label="Momentum"
              value={overrideMomentum}
              options={['growing', 'steady', 'slowing', 'stalled', 'unknown']}
              onChange={value => setOverrideMomentum(value as RelationshipMomentumState)}
              colors={colors}
            />
            <StateChoice
              label="Contact rhythm"
              value={overrideDormancy}
              options={['active', 'quiet', 'dormant', 'reactivation_candidate']}
              onChange={value => setOverrideDormancy(value as RelationshipDormancyState)}
              colors={colors}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.surfaceBorder, borderWidth: 1 }]} onPress={() => setShowStateOverride(false)}><Text style={{ color: colors.text }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: brand.primary }]} onPress={handleStateOverride}><Text style={{ color: '#fff', fontWeight: '700' }}>Save override</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function StateChoice({ label, value, options, onChange, colors }: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  colors: { text: string; textSecondary: string; surfaceBorder: string };
}) {
  return (
    <View style={styles.stateChoiceGroup}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.stateChoiceRow}>
        {options.map(option => (
          <TouchableOpacity
            key={option}
            style={[styles.stateChoiceChip, { borderColor: colors.surfaceBorder }, value === option && { borderColor: brand.primaryLight, backgroundColor: brand.primary + '22' }]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.stateChoiceText, { color: value === option ? brand.primaryLight : colors.text }]}>{option.replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerSection: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 78, height: 78, borderRadius: 39, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 34, fontWeight: '700' },
  name: { fontSize: 28, fontWeight: '700' },
  roleTitle: { fontSize: 14, marginTop: 4 },
  company: { fontSize: 14, marginTop: 4 },
  headerButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editBtn: { minWidth: 92, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  editBtnText: { color: '#fff', fontWeight: '700' },
  briefBtn: { backgroundColor: 'transparent', borderWidth: 1 },
  briefBtnText: { fontWeight: '700' },
  section: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  briefingHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  briefingMeta: { fontSize: 12 },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tierChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  tierChipText: { fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12 },
  bodyText: { fontSize: 14, lineHeight: 22 },
  inlineRow: { marginTop: 8 },
  inlineTitle: { fontSize: 14, fontWeight: '600' },
  inlineMeta: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14 },
  interactionRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8, gap: 10 },
  sourceIcon: { fontSize: 18 },
  interactionCtx: { fontSize: 14, fontWeight: '600' },
  interactionDate: { fontSize: 12, marginTop: 3 },
  sentiment: { fontSize: 18 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  relRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  relChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  relChipText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 40 },
  modalBtn: { flex: 1, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  prefsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefsMeta: { fontSize: 12, marginTop: 2 },
  prefsArrow: { fontSize: 22, fontWeight: '300' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLink: { fontSize: 12, fontWeight: '700' },
  generateButton: { minHeight: 46, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginBottom: 10 },
  generateButtonText: { fontSize: 12, fontWeight: '800' },
  embeddedList: { gap: 8 },
  milestoneRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8 },
  milestoneIcon: { fontSize: 17 },
  milestoneModal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  overrideIntro: { fontSize: 13, lineHeight: 20, marginTop: -10, marginBottom: 20 },
  stateChoiceGroup: { marginBottom: 18 },
  stateChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stateChoiceChip: { minHeight: 44, borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  stateChoiceText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
});
