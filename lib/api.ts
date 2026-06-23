import type { Session } from '@supabase/supabase-js';

export interface InviteSendResponse {
  ok: boolean;
  inviteUrl: string;
  icsUrl: string;
  delivery: 'sent' | 'preview';
}

export interface BriefingResponse {
  ok: boolean;
  briefing: string;
  source: 'anthropic' | 'fallback';
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
