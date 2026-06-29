import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { CategoryAssignment, CategoryDomain } from '@/lib/types';

const DOMAINS: { key: CategoryDomain; label: string; color: string }[] = [
  { key: 'work', label: 'Work', color: brand.accent },
  { key: 'personal', label: 'Personal', color: brand.danger },
  { key: 'other_strategic', label: 'Strategic', color: brand.warning },
];

const SUBCATEGORIES: Record<CategoryDomain, string[]> = {
  work: ['client_stakeholder', 'project_team', 'firm_leadership', 'mentor_sponsor', 'alumni', 'sme'],
  personal: ['family', 'close_friend', 'friend', 'personal_network', 'community', 'advisor'],
  other_strategic: ['potential_collaborator', 'learning_source', 'weak_tie', 'interesting_person'],
};

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface Props {
  assignments: CategoryAssignment[];
  onAdd: (domain: CategoryDomain, subcategory: string, isPrimary: boolean) => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}

export default function CategoryPicker({ assignments, onAdd, onRemove, readOnly }: Props) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [expandedDomain, setExpandedDomain] = useState<CategoryDomain | null>(null);

  const assignedDomains = new Set(assignments.filter(a => !a.deleted_at).map(a => a.category_domain));

  function domainColor(domain: CategoryDomain): string {
    return DOMAINS.find(d => d.key === domain)?.color ?? colors.textSecondary;
  }

  return (
    <View>
      {/* Existing assignments */}
      <View style={styles.chipRow}>
        {assignments.filter(a => !a.deleted_at).map(a => (
          <View key={a.id} style={[styles.chip, { backgroundColor: domainColor(a.category_domain) + '22', borderColor: domainColor(a.category_domain) + '44' }]}>
            <Text style={[styles.chipText, { color: domainColor(a.category_domain) }]}>
              {formatLabel(a.category_domain)}{a.subcategory ? ` / ${formatLabel(a.subcategory)}` : ''}
              {a.is_primary ? ' *' : ''}
            </Text>
            {!readOnly && (
              <TouchableOpacity onPress={() => onRemove(a.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.removeBtn, { color: domainColor(a.category_domain) }]}>x</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Add new category */}
      {!readOnly && (
        <View style={styles.addSection}>
          <View style={styles.chipRow}>
            {DOMAINS.map(d => (
              <TouchableOpacity
                key={d.key}
                style={[
                  styles.domainBtn,
                  { borderColor: colors.surfaceBorder },
                  expandedDomain === d.key && { backgroundColor: d.color + '22', borderColor: d.color },
                ]}
                onPress={() => setExpandedDomain(expandedDomain === d.key ? null : d.key)}
              >
                <Text style={[
                  styles.domainBtnText,
                  { color: colors.textSecondary },
                  expandedDomain === d.key && { color: d.color },
                ]}>
                  + {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {expandedDomain && (
            <View style={styles.subcategoryList}>
              {SUBCATEGORIES[expandedDomain].map(sub => {
                const alreadyAssigned = assignments.some(
                  a => !a.deleted_at && a.category_domain === expandedDomain && a.subcategory === sub
                );
                if (alreadyAssigned) return null;
                return (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subBtn, { borderColor: colors.surfaceBorder }]}
                    onPress={() => {
                      onAdd(expandedDomain, sub, !assignedDomains.has(expandedDomain));
                      setExpandedDomain(null);
                    }}
                  >
                    <Text style={[styles.subBtnText, { color: colors.text }]}>{formatLabel(sub)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
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
  addSection: { marginTop: 10 },
  domainBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  domainBtnText: { fontSize: 12, fontWeight: '600' },
  subcategoryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  subBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  subBtnText: { fontSize: 12 },
});
