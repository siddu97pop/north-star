export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  role: 'admin' | 'family' | 'friend' | 'member';
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
  created_at: string;
  updated_at: string;
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
