import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { Person, Interaction } from '@/lib/types';

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const [person, setPerson] = useState<Person | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('lifeos_people').select('*').eq('id', id).single(),
      supabase
        .from('lifeos_interactions')
        .select('*')
        .eq('person_id', id)
        .order('interaction_date', { ascending: false })
        .limit(50),
    ]).then(([personRes, intRes]) => {
      if (personRes.data) setPerson(personRes.data);
      if (intRes.data) setInteractions(intRes.data);
      setLoading(false);
    });
  }, [id]);

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

  function relColor(rel: string | null) {
    switch (rel) {
      case 'family': return '#FF6B6B';
      case 'friend': return brand.primary;
      case 'colleague': return brand.accent;
      default: return brand.warning;
    }
  }

  function sourceIcon(source: string) {
    switch (source) {
      case 'voice_note': return '🎙';
      case 'calendar_event': return '📅';
      default: return '✏️';
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={[styles.avatar, { backgroundColor: relColor(person.relationship) + '22' }]}>
          <Text style={[styles.avatarText, { color: relColor(person.relationship) }]}>
            {person.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{person.name}</Text>
        {person.relationship && (
          <View style={[styles.relBadge, { backgroundColor: relColor(person.relationship) + '22' }]}>
            <Text style={[styles.relBadgeText, { color: relColor(person.relationship) }]}>
              {person.relationship}
            </Text>
          </View>
        )}
        {person.company && (
          <Text style={[styles.company, { color: colors.textSecondary }]}>{person.company}</Text>
        )}
      </View>

      {/* Stats row */}
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

      {/* Notes */}
      {person.notes && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text>
          <Text style={[styles.bodyText, { color: colors.text }]}>{person.notes}</Text>
        </View>
      )}

      {/* Interaction history */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 12 }]}>
        Interaction History
      </Text>
      {interactions.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>No interactions recorded yet</Text>
      ) : (
        interactions.map(item => (
          <View
            key={item.id}
            style={[styles.interactionRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
          >
            <Text style={styles.sourceIcon}>{sourceIcon(item.source)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.interactionCtx, { color: colors.text }]}>
                {item.context || item.source.replace('_', ' ')}
              </Text>
              <Text style={[styles.interactionDate, { color: colors.textSecondary }]}>
                {new Date(item.interaction_date).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
                {item.topics.length > 0 ? ` · ${item.topics.join(', ')}` : ''}
              </Text>
            </View>
            {item.sentiment && (
              <Text style={styles.sentiment}>
                {item.sentiment === 'positive' ? '😊' : item.sentiment === 'negative' ? '😔' : item.sentiment === 'mixed' ? '😐' : ''}
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  relBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 4 },
  relBadgeText: { fontSize: 13, fontWeight: '600' },
  company: { fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: 12 },
  section: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  bodyText: { fontSize: 14, lineHeight: 22 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 12 },
  interactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  sourceIcon: { fontSize: 18, marginRight: 10 },
  interactionCtx: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  interactionDate: { fontSize: 12 },
  sentiment: { fontSize: 16 },
});
