export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  role: 'admin' | 'family' | 'friend' | 'member' | 'pending';
  invited_by: string | null;
  expo_push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  rrule: string | null;
  visibility: 'private' | 'family' | 'public';
  source: 'manual' | 'voice_note' | 'invite';
  source_ref_id: string | null;
  color: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  rsvp_status: 'pending' | 'accepted' | 'declined' | 'tentative';
  invite_token: string | null;
  invited_at: string;
  responded_at: string | null;
}

export interface VoiceNote {
  id: string;
  user_id: string;
  storage_path: string;
  duration_secs: number | null;
  status: 'uploading' | 'uploaded' | 'transcribing' | 'extracting' | 'complete' | 'failed';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transcription {
  id: string;
  voice_note_id: string;
  raw_text: string;
  cleaned_text: string | null;
  whisper_model: string;
  confidence: number | null;
  processing_ms: number | null;
  created_at: string;
}

export interface Extraction {
  id: string;
  voice_note_id: string;
  people: Array<{ name: string; context: string; relationship_hint: string }>;
  topics: string[];
  action_items: Array<{ task: string; due_hint: string }>;
  calendar_events: Array<{ title: string; date_hint: string; location_hint: string }>;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
  summary: string | null;
  raw_llm_output: unknown;
  model_used: string;
  created_at: string;
}

export type CategoryDomain = 'work' | 'personal' | 'other_strategic';
export type AttentionTier = 'high_attention' | 'active_maintenance' | 'light_touch' | 'needs_attention' | 'private_do_not_analyze';
export type ConfirmationStatus = 'confirmed' | 'suggested' | 'rejected' | 'corrected';
export type FunctionType =
  | 'mentor' | 'sponsor' | 'advisor' | 'coach' | 'collaborator'
  | 'support_tie' | 'bridge' | 'connector' | 'expert_source'
  | 'weak_tie' | 'dormant_tie' | 'care_checkin_relevant';

export interface CategoryAssignment {
  id: string;
  person_id: string;
  owner_id: string;
  category_domain: CategoryDomain;
  subcategory: string | null;
  is_primary: boolean;
  assignment_source: 'manual' | 'ai_suggested';
  confirmation_status: ConfirmationStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RelationshipFunction {
  id: string;
  person_id: string;
  owner_id: string;
  function_type: FunctionType;
  function_context: string | null;
  assignment_source: string;
  confirmation_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Person {
  id: string;
  owner_id: string;
  name: string;
  normalized_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  relationship: 'family' | 'friend' | 'colleague' | 'acquaintance' | 'other' | null;
  avatar_url: string | null;
  notes: string | null;
  linked_user_id: string | null;
  total_interactions: number;
  last_interaction_at: string | null;
  attention_tier: AttentionTier;
  lifecycle_state: string;
  scoring_mode: string;
  linkedin_url: string | null;
  primary_role_title: string | null;
  profile_summary_user: string | null;
  is_archived: boolean;
  is_private_do_not_analyze: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  category_assignments?: CategoryAssignment[];
  relationship_functions?: RelationshipFunction[];
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unavailable';
export type SensitivityLevel = 'none_low' | 'personal' | 'sensitive_lite' | 'sensitive' | 'restricted';
export type ReviewStatus = 'pending' | 'reviewed' | 'partially_reviewed' | 'skipped';
export type FieldType = 'person' | 'topic' | 'summary' | 'action_item' | 'category_suggestion' | 'sensitive_memory' | 'signal' | 'milestone';

export interface InteractionExtraction {
  id: string;
  interaction_id: string | null;
  voice_note_id: string | null;
  owner_id: string;
  model_name: string | null;
  prompt_version: string | null;
  raw_model_output: unknown;
  overall_confidence: ConfidenceLevel;
  contains_sensitive_candidate: boolean;
  requires_user_review: boolean;
  review_status: ReviewStatus;
  reviewed_at: string | null;
  created_at: string;
}

export interface ExtractedField {
  id: string;
  extraction_id: string;
  owner_id: string;
  field_type: FieldType;
  field_label: string | null;
  field_value_text: string | null;
  field_value_json: unknown;
  evidence_quote: string | null;
  confidence_level: ConfidenceLevel;
  sensitivity_level: SensitivityLevel;
  confirmation_status: ConfirmationStatus;
  corrected_value_json: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AuditEvent {
  id: string;
  owner_id: string;
  actor_type: 'user' | 'ai' | 'system';
  event_type: string;
  object_type: string | null;
  object_id: string | null;
  event_summary: string | null;
  before_json: unknown;
  after_json: unknown;
  created_at: string;
}

export type SensitivityReasonCode =
  | 'emotional_distress' | 'health_related' | 'family_private' | 'romantic'
  | 'financial' | 'legal' | 'client_confidential' | 'firm_confidential'
  | 'career_sensitive' | 'conflict' | 'third_party_secret';

export type StorageConsentStatus = 'pending' | 'granted' | 'denied' | 'revoked';

export interface SensitiveMemory {
  id: string;
  person_id: string;
  owner_id: string;
  source_interaction_id: string | null;
  source_extraction_id: string | null;
  memory_title: string | null;
  memory_summary_minimal: string | null;
  memory_detail: string | null;
  sensitivity_level: Exclude<SensitivityLevel, 'none_low'>;
  sensitivity_reason_codes: SensitivityReasonCode[];
  storage_consent_status: StorageConsentStatus;
  allowed_uses: string[];
  briefing_visibility: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PersonPreferences {
  id: string;
  person_id: string;
  owner_id: string;
  desired_contact_cadence_days: number | null;
  reminder_policy: string;
  scoring_mode_override: string | null;
  allow_ai_suggestions: boolean;
  allow_sensitive_in_briefings: boolean;
  briefing_depth: string;
  topics_to_avoid: string | null;
  boundary_state: string;
  created_at: string;
  updated_at: string;
}

export type ActionType =
  | 'explicit_promise' | 'received_commitment' | 'scheduled_next_step'
  | 'professional_deliverable' | 'emotional_checkin' | 'milestone_followup'
  | 'relationship_maintenance' | 'repair_followup' | 'appreciation_gratitude'
  | 'introduction_obligation' | 'learning_continuation' | 'no_action_memory';
export type CommitmentCertainty = 'c5_explicit' | 'c4_agreed' | 'c3_implied' | 'c2_weak' | 'c1_low';
export type ActionStatus =
  | 'suggested' | 'accepted' | 'active' | 'snoozed' | 'deferred'
  | 'blocked' | 'completed' | 'dismissed' | 'no_longer_relevant';

export interface ActionItem {
  id: string;
  owner_id: string;
  person_id: string | null;
  source_interaction_id: string | null;
  source_extraction_id: string | null;
  action_type: ActionType;
  title: string;
  description: string | null;
  commitment_certainty: CommitmentCertainty | null;
  owner_type: 'user' | 'other_person' | 'shared';
  due_at: string | null;
  sensitivity_level: SensitivityLevel;
  confirmation_status: ConfirmationStatus;
  status: ActionStatus;
  created_by: 'user' | 'ai' | 'system';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  person?: Pick<Person, 'id' | 'name'> | null;
}

export interface Reminder {
  id: string;
  owner_id: string;
  person_id: string | null;
  action_item_id: string | null;
  milestone_id: string | null;
  reminder_type: 'action' | 'milestone' | 'care_checkin' | 'briefing' | 'review';
  reminder_title: string;
  reminder_body_safe: string | null;
  scheduled_for: string | null;
  cadence_rule: string | null;
  state: 'suggested' | 'accepted' | 'scheduled' | 'active' | 'snoozed' | 'deferred' | 'done' | 'dismissed' | 'suppressed';
  snoozed_until: string | null;
  sensitivity_level: SensitivityLevel;
  user_confirmed_cadence: boolean;
  created_by: 'user' | 'ai' | 'system';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

export interface Milestone {
  id: string;
  person_id: string;
  owner_id: string;
  source_interaction_id: string | null;
  source_extraction_id: string | null;
  milestone_type: string;
  milestone_title: string;
  milestone_date: string | null;
  recurrence_rule: string | null;
  sensitivity_level: SensitivityLevel;
  confirmation_status: ConfirmationStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Interaction {
  id: string;
  owner_id: string;
  person_id: string;
  source: 'voice_note' | 'calendar_event' | 'manual';
  source_ref_id: string | null;
  interaction_date: string;
  context: string | null;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
  raw_user_note: string | null;
  ai_summary: string | null;
  ai_summary_confirmed: boolean;
  overall_sensitivity_level: SensitivityLevel;
  included_in_ai_context: boolean;
  created_at: string;
}

export interface InteractionStat {
  owner_id: string;
  person_id: string;
  person_name: string;
  relationship: string | null;
  today: number;
  this_week: number;
  this_month: number;
  this_year: number;
  all_time: number;
  last_seen: string | null;
}

export interface InviteRecord {
  id: string;
  invited_by: string;
  email: string;
  name: string | null;
  invite_type: 'app' | 'event';
  event_id: string | null;
  token: string;
  status: 'sent' | 'opened' | 'accepted' | 'expired';
  sent_at: string;
  accepted_at: string | null;
  expires_at: string;
}
