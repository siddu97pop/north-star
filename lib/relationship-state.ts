import type { RelationshipSignal, RelationshipState } from './types';

export type RelationshipStateDraft = Pick<RelationshipState,
  'health_state' | 'momentum_state' | 'dormancy_state' | 'attention_overlay' | 'reason_codes' | 'confidence_level'>;

export function computeLocalRelationshipState(params: {
  signals: RelationshipSignal[];
  lastInteractionAt: string | null;
  hasCommitment: boolean;
  hasMilestone: boolean;
}): RelationshipStateDraft {
  const days = params.lastInteractionAt
    ? Math.max(0, Math.floor((Date.now() - new Date(params.lastInteractionAt).getTime()) / 86_400_000))
    : null;
  const dormancy = days === null || days > 45 ? (days !== null && days > 120 ? 'dormant' : 'quiet') : 'active';
  const conflict = params.signals.some(s => s.signal_family === 'conflict' && ['negative', 'mixed'].includes(s.signal_direction) && s.signal_strength !== 'weak');
  const followThrough = params.signals.some(s => s.signal_family === 'follow_through' && s.signal_direction === 'negative' && s.signal_strength !== 'weak');
  const care = params.signals.some(s => ['support', 'sensitivity'].includes(s.signal_family) && ['negative', 'mixed', 'neutral'].includes(s.signal_direction));
  const positive = params.signals.some(s => s.signal_direction === 'positive');
  const momentumSignals = params.signals.filter(s => s.signal_family === 'momentum');

  const health = conflict ? 'repair_tension'
    : care ? 'care_followup'
      : followThrough ? 'needs_attention'
        : positive ? 'positive'
          : days !== null && days > 45 ? 'quiet_but_ok'
            : days !== null ? 'stable' : 'unknown';
  const momentum = momentumSignals.some(s => s.signal_direction === 'positive') ? 'growing'
    : momentumSignals.some(s => ['negative', 'mixed'].includes(s.signal_direction)) ? 'slowing'
      : days === null ? 'unknown' : dormancy === 'dormant' ? 'stalled' : 'steady';
  const attention = conflict || followThrough ? 'needs_attention'
    : care ? 'care_needed'
      : params.hasCommitment ? 'commitment_pending'
        : params.hasMilestone ? 'milestone_upcoming' : null;
  const reasons = conflict ? ['CONFIRMED_CONFLICT_SIGNAL']
    : care ? ['CONFIRMED_CARE_SIGNAL']
      : followThrough ? ['CONFIRMED_FOLLOW_THROUGH_CONCERN']
        : positive ? ['CONFIRMED_POSITIVE_SIGNAL']
          : days !== null && days > 45 ? ['QUIET_WITHOUT_NEGATIVE_EVIDENCE'] : days !== null ? ['RECENT_CONTACT_NO_CONCERN'] : ['LIMITED_DATA'];

  return {
    health_state: health,
    momentum_state: momentum,
    dormancy_state: dormancy,
    attention_overlay: attention,
    reason_codes: reasons,
    confidence_level: params.signals.length === 0 ? 'low' : params.signals.some(s => s.confidence_level === 'high') ? 'high' : 'medium',
  };
}
