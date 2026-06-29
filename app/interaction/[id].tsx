import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { Interaction, Person } from '@/lib/types';

export default function InteractionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, loading: authLoading } = useAuth();
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('lifeos_interactions').select('*').eq('id', id).single();
    if (data) {
      setInteraction(data);
      const personRes = await supabase.from('lifeos_people').select('*').eq('id', data.person_id).single();
      if (personRes.data) setPerson(personRes.data);
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  if (authLoading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.tint} /></View>;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.tint} /></View>;
  if (!interaction) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.textSecondary }}>Source interaction not found</Text></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: brand.primaryLight }]}>Recommendation evidence</Text>
      <Text style={[styles.title, { color: colors.text }]}>{person?.name ?? 'Interaction'}</Text>
      <Text style={[styles.date, { color: colors.textSecondary }]}>{new Date(interaction.interaction_date).toLocaleString()}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Confirmed context</Text>
        <Text style={[styles.body, { color: colors.text }]}>{interaction.ai_summary_confirmed && interaction.ai_summary ? interaction.ai_summary : interaction.context || interaction.raw_user_note || 'No additional detail is available.'}</Text>
      </View>
      {interaction.topics.length > 0 ? (
        <View style={styles.chips}>{interaction.topics.map(topic => <View key={topic} style={[styles.chip, { borderColor: colors.surfaceBorder }]}><Text style={[styles.chipText, { color: colors.textSecondary }]}>{topic}</Text></View>)}</View>
      ) : null}
      <Text style={[styles.provenance, { color: colors.textSecondary }]}>Source: {interaction.source.replace(/_/g, ' ')} · Sensitivity: {interaction.overall_sensitivity_level.replace(/_/g, ' ')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 5 },
  date: { fontSize: 13, marginBottom: 18 },
  card: { borderWidth: 1, borderRadius: 15, padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 7 },
  body: { fontSize: 15, lineHeight: 23 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 11, fontWeight: '600' },
  provenance: { fontSize: 11, lineHeight: 17, marginTop: 18 },
});
