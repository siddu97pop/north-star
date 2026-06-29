import type { Session } from '@supabase/supabase-js';

export interface InviteSendResponse {
  ok: boolean;
  inviteUrl: string;
  icsUrl: string;
  delivery: 'sent' | 'preview';
}

export interface BriefingResponse {
  ok: boolean;
  briefing: import('./types').Briefing;
  source: 'anthropic' | 'fallback';
}

export interface AppUser {
  id: string;
  display_name: string;
  email: string | null;
  role: 'admin' | 'family' | 'friend' | 'member' | 'pending';
  created_at: string;
}

export interface UserDirectoryResponse {
  ok: boolean;
  users: AppUser[];
}

export interface RecommendationGenerateResponse {
  ok: boolean;
  cards: import('./types').Recommendation[];
  source?: 'anthropic' | 'fallback';
  reason?: string;
}

export interface RelationshipStateResponse {
  ok: boolean;
  state: import('./types').RelationshipState | null;
  source: 'computed' | 'user_override' | 'private_do_not_analyze';
  evidence_signal_ids?: string[];
}

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  session?: Session | null
): Promise<T> {
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured');
  }

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function sendEventInvite(
  params: { eventId: string; attendeeId: string },
  session?: Session | null
) {
  return apiFetch<InviteSendResponse>(
    '/api/invite/send',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    session
  );
}

export async function fetchPersonBriefing(personId: string, session?: Session | null) {
  return apiFetch<BriefingResponse>(`/api/briefing/${personId}`, {}, session);
}

export async function fetchUserDirectory(session?: Session | null) {
  return apiFetch<UserDirectoryResponse>('/api/auth/users', {}, session);
}

export async function generatePersonRecommendations(personId: string, session?: Session | null) {
  return apiFetch<RecommendationGenerateResponse>(
    '/api/recommendations/generate',
    { method: 'POST', body: JSON.stringify({ personId }) },
    session
  );
}

export async function fetchPersonRelationshipState(personId: string, session?: Session | null) {
  return apiFetch<RelationshipStateResponse>(`/api/people/${personId}/state`, {}, session);
}

export interface PendingConfirmationsResponse {
  ok: boolean;
  total: number;
  counts: {
    extractions: number;
    actions: number;
    signals: number;
    milestones: number;
    recommendations: number;
  };
}

export interface ExportResponse {
  ok: boolean;
  jobId: string;
  export: {
    exportedAt: string;
    exportScope: string;
    includeSensitive: boolean;
    data: Record<string, unknown[]>;
  };
}

export interface DeletionResponse {
  ok: boolean;
  deletionRequestId: string;
  deletionMode: string;
  cascades: string[];
}

export async function fetchPendingConfirmations(session?: Session | null) {
  return apiFetch<PendingConfirmationsResponse>('/api/dashboard/pending-confirmations', {}, session);
}

export async function requestDataExport(
  params: { scope?: string; includeSensitive?: boolean },
  session?: Session | null
) {
  return apiFetch<ExportResponse>(
    '/api/export',
    { method: 'POST', body: JSON.stringify(params) },
    session
  );
}

export async function requestDeletion(
  params: { objectType: string; objectId: string; deletionMode?: string },
  session?: Session | null
) {
  return apiFetch<DeletionResponse>(
    '/api/deletion',
    { method: 'POST', body: JSON.stringify(params) },
    session
  );
}
