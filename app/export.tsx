import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { File } from 'expo-file-system/next';
import { Share } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import { requestDataExport } from '@/lib/api';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Everything', description: 'All people, interactions, actions, milestones, signals, recommendations, briefings, and audit log' },
  { value: 'people', label: 'People Only', description: 'People profiles, categories, functions, and preferences' },
  { value: 'interactions', label: 'Interactions Only', description: 'Interactions, action items, and milestones' },
] as const;

export default function ExportScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { session } = useAuth();

  const [scope, setScope] = useState('all');
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function handleExport() {
    if (!session) return;
    if (includeSensitive) {
      Alert.alert(
        'Include Sensitive Data?',
        'This export will include sensitive memories. Make sure you store the file securely.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Include & Export', style: 'destructive', onPress: runExport },
        ]
      );
    } else {
      await runExport();
    }
  }

  async function runExport() {
    setExporting(true);
    try {
      const result = await requestDataExport({ scope, includeSensitive }, session);
      const json = JSON.stringify(result.export, null, 2);
      const fileName = `lifeos-export-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File('file:///tmp/', fileName);
      file.create();
      file.write(json);

      setCompleted(true);

      const tableCount = Object.keys(result.export.data).length;
      try {
        await Share.share({ message: `Life OS export (${tableCount} tables):\n\n${json.slice(0, 500)}...`, title: fileName });
      } catch {
        Alert.alert('Export Complete', `${tableCount} tables exported. File saved to ${fileName}.`);
      }
    } catch (err) {
      Alert.alert('Export Failed', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Export Data', headerBackTitle: 'Settings' }} />

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Export Your Data</Text>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
          Download a complete JSON copy of your Life OS data. You own your data — export it anytime.
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SCOPE</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        {SCOPE_OPTIONS.map((opt, idx) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.scopeRow,
              idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
            ]}
            onPress={() => setScope(opt.value)}
          >
            <View style={[styles.radio, { borderColor: colors.surfaceBorder }, scope === opt.value && { borderColor: brand.primary }]}>
              {scope === opt.value && <View style={[styles.radioInner, { backgroundColor: brand.primary }]} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.scopeLabel, { color: colors.text }]}>{opt.label}</Text>
              <Text style={[styles.scopeDesc, { color: colors.textSecondary }]}>{opt.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>OPTIONS</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Include sensitive memories</Text>
            <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
              Exports personal, sensitive, and restricted memories. Handle with care.
            </Text>
          </View>
          <Switch value={includeSensitive} onValueChange={setIncludeSensitive} trackColor={{ true: brand.danger }} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.exportBtn, { backgroundColor: completed ? brand.success : brand.primary }, exporting && { opacity: 0.6 }]}
        onPress={handleExport}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.exportBtnText}>{completed ? 'Export Again' : 'Export Now'}</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.footnote, { color: colors.textSecondary }]}>
        Export format: JSON. All timestamps are in UTC. Soft-deleted records are excluded.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700', padding: 16, paddingBottom: 4 },
  cardDesc: { fontSize: 13, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 20, marginLeft: 4 },
  scopeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  scopeLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  scopeDesc: { fontSize: 12, lineHeight: 17 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  switchDesc: { fontSize: 12, marginTop: 2 },
  exportBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footnote: { fontSize: 11, textAlign: 'center', marginTop: 12 },
});
