import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { VoiceNote } from '@/lib/types';

export default function RecordScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recentNotes, setRecentNotes] = useState<VoiceNote[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user) loadRecentNotes();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('voice-notes-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lifeos_voice_notes', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setRecentNotes(prev =>
            prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n)
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function loadRecentNotes() {
    const { data } = await supabase
      .from('lifeos_voice_notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setRecentNotes(data);
  }

  async function startRecording() {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    setRecording(recording);
    setIsRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }

  async function stopRecording() {
    if (!recording || !user) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (!uri) return;
    setUploading(true);

    const noteId = Crypto.randomUUID();
    const storagePath = `${user.id}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${noteId}.m4a`;
    const file = new File(uri);
    const audioData = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('lifeos-audio')
      .upload(storagePath, audioData, { contentType: 'audio/mp4' });

    if (uploadError) {
      console.error('Upload failed:', uploadError);
      setUploading(false);
      return;
    }

    await supabase.from('lifeos_voice_notes').insert({
      id: noteId,
      user_id: user.id,
      storage_path: storagePath,
      duration_secs: elapsed,
      status: 'uploaded',
    });

    setUploading(false);
    setElapsed(0);
    loadRecentNotes();
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function statusLabel(status: VoiceNote['status']) {
    switch (status) {
      case 'uploading': return 'Uploading...';
      case 'uploaded': return 'Queued';
      case 'transcribing': return 'Transcribing...';
      case 'extracting': return 'Analyzing...';
      case 'complete': return 'Done';
      case 'failed': return 'Failed';
    }
  }

  function statusColor(status: VoiceNote['status']) {
    switch (status) {
      case 'complete': return brand.success;
      case 'failed': return brand.danger;
      case 'uploading': case 'uploaded': return brand.warning;
      default: return brand.accent;
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Recording area */}
      <View style={styles.recordArea}>
        <Text style={[styles.timer, { color: colors.text }]}>
          {formatDuration(elapsed)}
        </Text>
        {isRecording && (
          <Text style={[styles.recordingHint, { color: brand.danger }]}>Recording...</Text>
        )}

        <TouchableOpacity
          style={[
            styles.recordBtn,
            { backgroundColor: isRecording ? brand.danger : brand.primary },
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <View style={[styles.recordBtnInner, isRecording && styles.stopIcon]} />
          )}
        </TouchableOpacity>

        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {uploading ? 'Uploading...' : isRecording ? 'Tap to stop' : 'Tap to record'}
        </Text>
      </View>

      {/* Recent notes */}
      <View style={styles.listSection}>
        <Text style={[styles.listTitle, { color: colors.text }]}>Recent Recordings</Text>
        <FlatList
          data={recentNotes}
          keyExtractor={n => n.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.noteRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
              onPress={() => router.push(`/voice/${item.id}`)}
            >
              <View style={[styles.dot, { backgroundColor: statusColor(item.status) }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.noteTime, { color: colors.text }]}>
                  {new Date(item.created_at).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                  {item.duration_secs ? ` · ${formatDuration(item.duration_secs)}` : ''}
                </Text>
                <Text style={[styles.noteStatus, { color: statusColor(item.status) }]}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No recordings yet</Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  recordArea: { alignItems: 'center', paddingTop: 40, paddingBottom: 24 },
  timer: { fontSize: 48, fontWeight: '300', fontVariant: ['tabular-nums'], marginBottom: 8 },
  recordingHint: { fontSize: 14, fontWeight: '600', marginBottom: 16 },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordBtnInner: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff' },
  stopIcon: { borderRadius: 4, width: 24, height: 24 },
  hint: { fontSize: 14 },
  listSection: { flex: 1, paddingHorizontal: 20 },
  listTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  noteTime: { fontSize: 14, fontWeight: '500' },
  noteStatus: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 20, fontSize: 14 },
});
