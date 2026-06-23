import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { CalendarEvent } from '@/lib/types';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('lifeos_events')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setEvent(data);
        setLoading(false);
      });
  }, [id]);

  async function handleDelete() {
    Alert.alert('Delete Event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('lifeos_events').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Event not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.colorBar, { backgroundColor: event.color ?? brand.primary }]} />

      <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>

      <View style={[styles.infoRow]}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>When</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>
          {event.all_day
            ? new Date(event.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            : `${new Date(event.start_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – ${new Date(event.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </Text>
      </View>

      {event.location && (
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Where</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{event.location}</Text>
        </View>
      )}

      {event.description && (
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Notes</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{event.description}</Text>
        </View>
      )}

      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Visibility</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>
          {event.visibility.charAt(0).toUpperCase() + event.visibility.slice(1)}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.deleteBtn, { borderColor: brand.danger }]}
        onPress={handleDelete}
      >
        <Text style={{ color: brand.danger, fontWeight: '600' }}>Delete Event</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  colorBar: { height: 4, borderRadius: 2, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  infoRow: { marginBottom: 16 },
  infoLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 16, lineHeight: 24 },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
});
