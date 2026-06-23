import type { CalendarEvent, Interaction, Person } from './types';

export function buildLocalBriefing(params: {
  person: Person;
  interactions: Interaction[];
  upcomingEvents: CalendarEvent[];
}): string {
  const { person, interactions, upcomingEvents } = params;

  const latest = interactions[0];
  const recentTopics = Array.from(
    new Set(interactions.flatMap((item) => item.topics).filter(Boolean))
  ).slice(0, 5);

  const lines: string[] = [];

  lines.push(`${person.name} is in your ${person.relationship ?? 'contact'} circle.`);

  if (person.company) {
    lines.push(`Company: ${person.company}.`);
  }

  if (person.total_interactions > 0) {
    lines.push(
      `You have ${person.total_interactions} logged interaction${person.total_interactions === 1 ? '' : 's'} with ${person.name}.`
    );
  }

  if (latest) {
    lines.push(
      `Last interaction: ${new Date(latest.interaction_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })}${latest.context ? ` · ${latest.context}` : ''}.`
    );
  }

  if (recentTopics.length > 0) {
    lines.push(`Recurring topics: ${recentTopics.join(', ')}.`);
  }

  if (upcomingEvents.length > 0) {
    const nextEvent = upcomingEvents[0];
    lines.push(
      `Next shared event: ${nextEvent.title} on ${new Date(nextEvent.start_at).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}${nextEvent.location ? ` at ${nextEvent.location}` : ''}.`
    );
  } else {
    lines.push(`No upcoming shared events are logged yet.`);
  }

  if (person.notes) {
    lines.push(`Personal note: ${person.notes}.`);
  }

  lines.push(`Good opening move: reference the last topic you discussed and confirm the next concrete step.`);

  return lines.join(' ');
}
