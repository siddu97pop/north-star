import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { RelationshipFunction, FunctionType } from '@/lib/types';

const FUNCTION_OPTIONS: { key: FunctionType; label: string }[] = [
  { key: 'mentor', label: 'Mentor' },
  { key: 'sponsor', label: 'Sponsor' },
  { key: 'advisor', label: 'Advisor' },
  { key: 'coach', label: 'Coach' },
  { key: 'collaborator', label: 'Collaborator' },
  { key: 'support_tie', label: 'Support Tie' },
  { key: 'bridge', label: 'Bridge' },
  { key: 'connector', label: 'Connector' },
  { key: 'expert_source', label: 'Expert Source' },
  { key: 'weak_tie', label: 'Weak Tie' },
  { key: 'dormant_tie', label: 'Dormant Tie' },
  { key: 'care_checkin_relevant', label: 'Care Check-in' },
];

interface Props {
  functions: RelationshipFunction[];
  onAdd: (functionType: FunctionType) => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}

export default function FunctionPicker({ functions, onAdd, onRemove, readOnly }: Props) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [showPicker, setShowPicker] = useState(false);

  const activeFunctions = functions.filter(f => !f.deleted_at);
  const assignedTypes = new Set(activeFunctions.map(f => f.function_type));

  return (
    <View>
      <View style={styles.chipRow}>
        {activeFunctions.map(f => (
          <View key={f.id} style={[styles.chip, { backgroundColor: brand.primaryLight + '22', borderColor: brand.primaryLight + '44' }]}>
            <Text style={[styles.chipText, { color: brand.primaryLight }]}>
              {FUNCTION_OPTIONS.find(o => o.key === f.function_type)?.label ?? f.function_type}
            </Text>
            {!readOnly && (
              <TouchableOpacity onPress={() => onRemove(f.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.removeBtn, { color: brand.primaryLight }]}>x</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {activeFunctions.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No functions assigned</Text>
        )}
      </View>

      {!readOnly && (
        <>
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: colors.surfaceBorder }]}
            onPress={() => setShowPicker(!showPicker)}
          >
            <Text style={[styles.addBtnText, { color: colors.textSecondary }]}>
              {showPicker ? '- Hide' : '+ Add Function'}
            </Text>
          </TouchableOpacity>

          {showPicker && (
            <View style={styles.optionGrid}>
              {FUNCTION_OPTIONS.filter(o => !assignedTypes.has(o.key)).map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.optionBtn, { borderColor: colors.surfaceBorder }]}
                  onPress={() => {
                    onAdd(o.key);
                    setShowPicker(false);
                  }}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  removeBtn: { fontSize: 14, fontWeight: '700' },
  emptyText: { fontSize: 12, fontStyle: 'italic' },
  addBtn: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  addBtnText: { fontSize: 12, fontWeight: '600' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  optionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  optionText: { fontSize: 12 },
});
