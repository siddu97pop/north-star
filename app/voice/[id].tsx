import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { VoiceNote, Transcription, Extraction } from '@/lib/types';

export default function VoiceNoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const [note, setNote] = useState<VoiceNote | null>(null);
  const [transcript, setTranscript] = useState<Transcription | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel(`voice-note-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lifeos_voice_notes', filter: `id=eq.${id}` },
        (payload) => {
          setNote(prev => prev ? { ...prev, ...payload.new } : null);
          if (payload.new.status === 'complete') loadData();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function loadData() {
    const [noteRes, transRes, extRes] = await Promise.all([
      supabase.from('lifeos_voice_notes').select('*').eq('id', id).single(),
      supabase.from('lifeos_transcriptions').select('*').eq('voice_note_id', id).single(),
      supabase.from('lifeos_extractions').select('*').eq('voice_note_id', id).single(),
    ]);
    if (noteRes.data) setNote(noteRes.data);
    if (transRes.data) setTranscript(transRes.data);
    if (extRes.data) setExtraction(extRes.data);
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!note) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Note not found</Text>
      </View>
    );
  }

  const isProcessing = ['uploading', 'uploaded', 'transcribing', 'extracting'].includes(note.status);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Status */}
      <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
        <Text style={[styles.statusText, {
          color: note.status === 'complete' ? brand.success : note.status === 'failed' ? brand.danger : brand.accent
        }]}>
          {note.status.charAt(0).toUpperCase() + note.status.slice(1)}
        </Text>
        {note.duration_secs && (
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Duration: {Math.floor(note.duration_secs / 60)}:{String(note.duration_secs % 60).padStart(2, '0')}
          </Text>
        )}
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          Recorded: {new Date(note.created_at).toLocaleString()}
        </Text>
      </View>

      {isProcessing && (
        <View style={styles.processingRow}>
          <ActivityIndicator size="small" color={brand.accent} />
          <Text style={[styles.processingText, { color: brand.accent }]}>Processing your voice note...</Text>
        </View>
      )}

      {note.status === 'failed' && note.error_message && (
        <View style={[styles.errorCard, { backgroundColor: '#2D1215' }]}>
          <Text style={{ color: brand.danger, fontWeight: '600' }}>Error</Text>
          <Text style={{ color: '#FDA4AF', marginTop: 4 }}>{note.error_message}</Text>
        </View>
      )}

      {/* Transcription */}
      {transcript && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Transcription</Text>
          <Text style={[styles.transcript, { color: colors.text }]}>{transcript.raw_text}</Text>
          {transcript.whisper_model && (
            <Text style={[styles.meta, { color: colors.textSecondary, marginTop: 8 }]}>
              Model: {transcript.whisper_model} · {transcript.processing_ms ? `${(transcript.processing_ms / 1000).toFixed(1)}s` : ''}
            </Text>
          )}
        </View>
      )}

      {/* Extraction */}
      {extraction && (
        <>
          {extraction.summary && (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Summary</Text>
              <Text style={[styles.bodyText, { color: colors.text }]}>{extraction.summary}</Text>
            </View>
          )}

          {extraction.people.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>People Mentioned</Text>
              {extraction.people.map((p, i) => (
                <View key={i} style={styles.tagRow}>
                  <Text style={[styles.personName, { color: brand.primaryLight }]}>{p.name}</Text>
                  <Text style={[styles.personCtx, { color: colors.textSecondary }]}>{p.context}</Text>
                </View>
              ))}
            </View>
          )}

          {extraction.topics.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Topics</Text>
              <View style={styles.tagWrap}>
                {extraction.topics.map((t, i) => (
                  <View key={i} style={[styles.tag, { backgroundColor: colors.surfaceBorder }]}>
                    <Text style={{ color: colors.text, fontSize: 13 }}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {extraction.action_items.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Action Items</Text>
              {extraction.action_items.map((a, i) => (
                <View key={i} style={styles.actionRow}>
                  <Text style={[styles.bullet, { color: brand.accent }]}>●</Text>
                  <Text style={[styles.bodyText, { color: colors.text, flex: 1 }]}>
                    {a.task}{a.due_hint ? ` (${a.due_hint})` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  statusText: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 13, marginTop: 2 },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  processingText: { fontSize: 14 },
  errorCard: { padding: 14, borderRadius: 10, marginBottom: 16 },
  section: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  transcript: { fontSize: 15, lineHeight: 24 },
  bodyText: { fontSize: 14, lineHeight: 22 },
  tagRow: { marginBottom: 8 },
  personName: { fontSize: 14, fontWeight: '600' },
  personCtx: { fontSize: 13, marginTop: 2 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bullet: { fontSize: 8, marginTop: 6 },
});
