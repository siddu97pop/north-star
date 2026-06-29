import { supabase } from '@/lib/supabase';
import type {
  ActionType,
  Recommendation,
  RecommendationDecisionType,
  RecommendationState,
  RecommendationType,
} from '@/lib/types';

export async function loadRecommendations(personId?: string, limit = 50): Promise<Recommendation[]> {
  let query = supabase
    .from('lifeos_recommendations')
    .select('*, person:lifeos_people(id,name), evidence:lifeos_recommendation_evidence(*)')
    .in('state', ['active', 'edited', 'snoozed'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (personId) query = query.eq('person_id', personId);
  const { data, error } = await query;
  if (error) throw error;
  const now = Date.now();
  return (data as Recommendation[]).filter(item =>
    item.state !== 'snoozed' || !item.snoozed_until || new Date(item.snoozed_until).getTime() <= now
  );
}

function actionTypeForRecommendation(type: RecommendationType): ActionType {
  switch (type) {
    case 'care_checkin': return 'emotional_checkin';
    case 'repair': return 'repair_followup';
    case 'appreciation': return 'appreciation_gratitude';
    case 'maintenance':
    case 'reactivation': return 'relationship_maintenance';
    default: return 'scheduled_next_step';
  }
}

async function recordDecision(
  recommendation: Recommendation,
  ownerId: string,
  decisionType: RecommendationDecisionType,
  payload: Record<string, unknown> | null,
  result?: { type: string; id: string } | null,
) {
  await supabase.from('lifeos_recommendation_decisions').insert({
    recommendation_id: recommendation.id,
    owner_id: ownerId,
    decision_type: decisionType,
    decision_payload: payload,
    created_result_object_type: result?.type ?? null,
    created_result_object_id: result?.id ?? null,
  });
  await supabase.from('lifeos_audit_events').insert({
    owner_id: ownerId,
    actor_type: 'user',
    event_type: `recommendation_${decisionType}`,
    object_type: 'recommendation',
    object_id: recommendation.id,
    event_summary: `User marked recommendation ${decisionType.replace(/_/g, ' ')}`,
  });
}

export async function acceptRecommendation(recommendation: Recommendation, ownerId: string) {
  let result: { type: string; id: string } | null = null;

  if (recommendation.recommendation_type === 'milestone_reminder') {
    const milestoneEvidence = recommendation.evidence?.find(item => item.evidence_object_type === 'milestone');
    const { data, error } = await supabase.from('lifeos_reminders').insert({
      owner_id: ownerId,
      person_id: recommendation.person_id,
      milestone_id: milestoneEvidence?.evidence_object_id ?? null,
      reminder_type: 'milestone',
      reminder_title: recommendation.sensitivity_level === 'none_low'
        ? recommendation.recommendation_title
        : 'You have a private milestone to review',
      reminder_body_safe: 'Open North Star to review a suggestion you accepted.',
      scheduled_for: recommendation.expires_at,
      cadence_rule: 'one_time',
      state: 'scheduled',
      sensitivity_level: recommendation.sensitivity_level,
      user_confirmed_cadence: true,
      created_by: 'ai',
    }).select('id').single();
    if (error) throw error;
    result = data ? { type: 'reminder', id: data.id } : null;
  } else if (!['category_review', 'tier_review', 'briefing_note'].includes(recommendation.recommendation_type)) {
    const { data, error } = await supabase.from('lifeos_action_items').insert({
      owner_id: ownerId,
      person_id: recommendation.person_id,
      source_interaction_id: recommendation.related_interaction_id,
      action_type: actionTypeForRecommendation(recommendation.recommendation_type),
      title: recommendation.action_requested,
      description: recommendation.recommendation_text,
      commitment_certainty: recommendation.evidence_strength === 'explicit' ? 'c4_agreed' : 'c3_implied',
      owner_type: 'user',
      sensitivity_level: recommendation.sensitivity_level,
      confirmation_status: 'confirmed',
      status: 'active',
      created_by: 'ai',
    }).select('id').single();
    if (error) throw error;
    result = data ? { type: 'action_item', id: data.id } : null;
  }

  const state: RecommendationState = result ? 'converted' : 'accepted';
  const { error } = await supabase.from('lifeos_recommendations').update({ state, updated_at: new Date().toISOString() }).eq('id', recommendation.id);
  if (error) throw error;
  await recordDecision(recommendation, ownerId, 'accepted', null, result);
  return state;
}

export async function editRecommendation(
  recommendation: Recommendation,
  ownerId: string,
  recommendationText: string,
  actionRequested: string,
) {
  const update = {
    recommendation_text: recommendationText.trim(),
    action_requested: actionRequested.trim(),
    state: 'edited' as RecommendationState,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('lifeos_recommendations').update(update).eq('id', recommendation.id);
  if (error) throw error;
  await recordDecision(recommendation, ownerId, 'edited', update);
  return update;
}

export async function decideRecommendation(
  recommendation: Recommendation,
  ownerId: string,
  decision: 'dismissed' | 'snoozed' | 'disabled_similar',
) {
  const now = new Date();
  let state: RecommendationState = decision === 'dismissed' ? 'dismissed' : decision === 'snoozed' ? 'snoozed' : 'suppressed';
  const snoozedUntil = decision === 'snoozed'
    ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  if (decision === 'disabled_similar') {
    const { data: existing } = await supabase
      .from('lifeos_recommendation_suppressions')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('person_id', recommendation.person_id)
      .eq('recommendation_type', recommendation.recommendation_type)
      .eq('suppression_scope', 'person_type')
      .eq('is_active', true)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('lifeos_recommendation_suppressions').insert({
        owner_id: ownerId,
        person_id: recommendation.person_id,
        recommendation_type: recommendation.recommendation_type,
        suppression_scope: 'person_type',
        reason: 'User disabled similar suggestions from a recommendation card',
      });
      if (error) throw error;
    }
  }

  const { error } = await supabase.from('lifeos_recommendations').update({
    state,
    snoozed_until: snoozedUntil,
    updated_at: now.toISOString(),
  }).eq('id', recommendation.id);
  if (error) throw error;
  await recordDecision(recommendation, ownerId, decision, snoozedUntil ? { snoozed_until: snoozedUntil } : null);
  return { state, snoozed_until: snoozedUntil };
}
