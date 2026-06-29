import type { ActionItem, BriefingItem, Interaction, Milestone, Person, PersonPreferences, Recommendation, RelationshipState, SensitiveMemory } from './types';

export type LocalBriefingItem = Omit<BriefingItem, 'id' | 'briefing_id' | 'owner_id' | 'created_at'>;

function terms(value: string | null) {
  return (value ?? '').split(/[\n,;]/).map(term => term.trim().toLowerCase()).filter(term => term.length >= 2);
}

function blocked(text: string, avoided: string[]) {
  const normalized = text.toLowerCase();
  return avoided.some(term => normalized.includes(term));
}

export function buildLocalStructuredBriefing(params: {
  person: Person;
  interactions: Interaction[];
  actions: ActionItem[];
  milestones: Milestone[];
  sensitiveMemories: SensitiveMemory[];
  relationshipState: RelationshipState | null;
  recommendations: Recommendation[];
  preferences: PersonPreferences | null;
}) {
  const { person } = params;
  const items: LocalBriefingItem[] = [];
  const avoided = terms(params.preferences?.topics_to_avoid ?? null);
  const allowSensitive = params.preferences?.allow_sensitive_in_briefings === true;
  const permitted = <T extends { sensitivity_level?: string; overall_sensitivity_level?: string }>(item: T) => {
    const level = item.sensitivity_level ?? item.overall_sensitivity_level ?? 'none_low';
    return level !== 'restricted' && (!['sensitive_lite', 'sensitive'].includes(level) || allowSensitive);
  };
  const eligibleInteractions = params.interactions.filter(item => (item.source === 'manual' || item.ai_summary_confirmed) && permitted(item));
  const latest = eligibleInteractions[0];

  items.push({ item_type: 'context', item_title: 'Conversation context',
    item_text: [person.primary_role_title, person.company, person.relationship].filter(Boolean).join(' · ') || `${person.name} is saved in your people list.`,
    source_object_type: 'person', source_object_id: person.id, source_label: 'Your profile', source_date: null,
    confidence_level: 'high', sensitivity_level: 'none_low', visibility_mode: 'visible', user_can_hide: true });

  if (latest) {
    const context = latest.context ?? '';
    items.push({
      item_type: 'last_interaction', item_title: 'Last confirmed interaction',
      item_text: `${new Date(latest.interaction_date).toLocaleDateString()} · ${blocked(context, avoided) ? 'Some context was omitted because of your topic preferences.' : context || 'No additional context was saved.'}`,
      source_object_type: 'interaction', source_object_id: latest.id, source_label: latest.source === 'manual' ? 'Manual interaction' : 'Confirmed interaction summary', source_date: latest.interaction_date, confidence_level: 'high',
      sensitivity_level: latest.overall_sensitivity_level, visibility_mode: 'visible', user_can_hide: true,
    });
  }
  for (const action of params.actions.filter(action => action.confirmation_status === 'confirmed' && permitted(action)).slice(0, 3)) {
    if (blocked(action.title, avoided)) continue;
    items.push({ item_type: 'pending_action', item_title: 'Pending commitment',
      item_text: `${action.title}${action.due_at ? ` · due ${new Date(action.due_at).toLocaleDateString()}` : ''}`,
      source_object_type: 'action_item', source_object_id: action.id,
      source_label: 'Confirmed action', source_date: action.due_at,
      confidence_level: ['c5_explicit', 'c4_agreed'].includes(action.commitment_certainty ?? '') ? 'high' : 'medium',
      sensitivity_level: action.sensitivity_level, visibility_mode: 'visible', user_can_hide: true });
  }
  if (params.relationshipState) {
    const state = params.relationshipState;
    items.push({ item_type: 'relationship_state', item_title: 'Relationship context',
      item_text: `Health: ${state.health_state.replace(/_/g, ' ')} · Momentum: ${state.momentum_state.replace(/_/g, ' ')} · Rhythm: ${state.dormancy_state.replace(/_/g, ' ')}`,
      source_object_type: 'relationship_state', source_object_id: state.id, source_label: state.created_by === 'user' ? 'Your state override' : 'Confirmed-evidence state', source_date: null, confidence_level: state.confidence_level,
      sensitivity_level: 'none_low', visibility_mode: 'visible', user_can_hide: true });
  }
  for (const milestone of params.milestones.filter(permitted).slice(0, 3)) {
    if (blocked(milestone.milestone_title, avoided)) continue;
    items.push({ item_type: 'milestones', item_title: 'Relevant milestone',
      item_text: `${milestone.milestone_title}${milestone.milestone_date ? ` · ${new Date(`${milestone.milestone_date}T00:00:00`).toLocaleDateString()}` : ''}`,
      source_object_type: 'milestone', source_object_id: milestone.id, source_label: 'Confirmed milestone', source_date: milestone.milestone_date, confidence_level: 'high', sensitivity_level: milestone.sensitivity_level,
      visibility_mode: 'visible', user_can_hide: true });
  }
  const safeTopics = Array.from(new Set(eligibleInteractions.flatMap(item => item.topics))).filter(topic => !blocked(topic, avoided)).slice(0, 5);
  if (safeTopics.length > 0 && latest) items.push({ item_type: 'topics_to_remember', item_title: 'Topics to remember', item_text: safeTopics.join(' · '), source_object_type: 'interaction', source_object_id: latest.id, source_label: 'Confirmed interaction topics', source_date: latest.interaction_date, confidence_level: 'high', sensitivity_level: 'none_low', visibility_mode: 'visible', user_can_hide: true });
  if (avoided.length > 0) items.push({ item_type: 'topics_to_avoid', item_title: 'Conversation preference', item_text: 'You have saved topics to avoid. Their details are intentionally omitted from this briefing.', source_object_type: 'preference', source_object_id: null, source_label: 'Your saved preference', source_date: null, confidence_level: 'high', sensitivity_level: 'personal', visibility_mode: 'visible', user_can_hide: false });

  if (params.preferences?.allow_sensitive_in_briefings) {
    for (const memory of params.sensitiveMemories.filter(memory => memory.sensitivity_level !== 'restricted' && memory.allowed_uses.includes('briefing_generation') && !['hidden', 'never'].includes(memory.briefing_visibility)).slice(0, 2)) {
      const text = memory.memory_summary_minimal ?? memory.memory_title ?? 'Approved sensitive context is available.';
      if (blocked(text, avoided)) continue;
      items.push({ item_type: 'sensitive_context', item_title: memory.memory_title ?? 'Sensitive context', item_text: text,
        source_object_type: 'sensitive_memory', source_object_id: memory.id, source_label: 'Approved sensitive summary', source_date: null, confidence_level: 'high', sensitivity_level: memory.sensitivity_level,
        visibility_mode: memory.briefing_visibility === 'full_if_unlocked' ? 'full_if_unlocked' : 'summary_only', user_can_hide: true });
    }
  }
  const recommendation = params.recommendations.find(item => permitted(item) && !blocked(`${item.recommendation_title} ${item.recommendation_text}`, avoided));
  if (recommendation) items.push({ item_type: 'recommendations', item_title: recommendation.recommendation_title, item_text: recommendation.recommendation_text, source_object_type: 'recommendation', source_object_id: recommendation.id, source_label: 'Evidence-based suggestion', source_date: null, confidence_level: recommendation.confidence_level, sensitivity_level: recommendation.sensitivity_level, visibility_mode: 'visible', user_can_hide: true });
  if (latest && safeTopics.length > 0) items.push({ item_type: 'suggested_opener', item_title: 'Possible opener', item_text: `You could start by returning to ${safeTopics[0]}.`, source_object_type: 'interaction', source_object_id: latest.id, source_label: 'Based on last interaction', source_date: latest.interaction_date, confidence_level: 'medium', sensitivity_level: 'none_low', visibility_mode: 'visible', user_can_hide: true });
  if (items.length === 1) items.push({ item_type: 'data_limitation', item_title: 'Limited context', item_text: 'There is not enough confirmed, permissioned context for a detailed briefing yet.', source_object_type: 'person', source_object_id: person.id, source_label: 'Profile data check', source_date: null, confidence_level: 'unavailable', sensitivity_level: 'none_low', visibility_mode: 'visible', user_can_hide: false });
  const sensitiveEligible = allowSensitive
    ? params.sensitiveMemories.filter(memory => memory.sensitivity_level !== 'restricted' && memory.allowed_uses.includes('briefing_generation') && !['hidden', 'never'].includes(memory.briefing_visibility)).length
    : 0;
  return {
    summary: `Prepared ${items.length} source-grounded briefing section${items.length === 1 ? '' : 's'} for ${person.name}.`,
    items,
    sensitiveItemsSuppressed: params.sensitiveMemories.length - sensitiveEligible
      + params.interactions.filter(item => item.source === 'manual' || item.ai_summary_confirmed).filter(item => !permitted(item)).length
      + params.actions.filter(action => action.confirmation_status === 'confirmed' && !permitted(action)).length
      + params.milestones.filter(item => !permitted(item)).length
      + params.recommendations.filter(item => !permitted(item)).length,
    sensitiveContentIncluded: sensitiveEligible > 0,
  };
}
