import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { brand } from '@/constants/Colors';
import type { CalendarEvent } from '@/lib/types';

type Visibility = CalendarEvent['visibility'];

const VISIBILITIES: Visibility[] = ['private', 'family', 'public'];
const RECURRENCE_OPTIONS = [
  { label: 'Once', value: null },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
];

export default function CalendarScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startHour, setStartHour] = useState('19');
  const [startMin, setStartMin] = useState('00');
  const [endHour, setEndHour] = useState('20');
  const [endMin, setEndMin] = useState('00');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [recurrence, setRecurrence] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!user) return;
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const { data } = await supabase
      .from('lifeos_events')
      .select('*')
      .gte('start_at', start.toISOString())
      .lt('start_at', end.toISOString())
      .order('start_at');

    if (data) setEvents(data);
  }, [selectedDate, user]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  async function handleCreate() {
    if (!user || !title.trim()) return;

    const startAt = new Date(selectedDate);
    startAt.setHours(parseInt(startHour || '0', 10), parseInt(startMin || '0', 10), 0, 0);
    const endAt = new Date(selectedDate);
    endAt.setHours(parseInt(endHour || '0', 10), parseInt(endMin || '0', 10), 0, 0);

    await supabase.from('lifeos_events').insert({
      owner_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      visibility,
      rrule: recurrence,
      metadata: recurrence ? { recurrence_label: RECURRENCE_OPTIONS.find((option) => option.value === recurrence)?.label } : {},
    });

    setTitle('');
    setDescription('');
    setLocation('');
    setVisibility('private');
    setRecurrence(null);
    setShowCreate(false);
    loadEvents();
  }

  function getDaysInMonth(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  }

  function navigateMonth(delta: number) {
    const next = new Date(selectedDate);
    next.setMonth(next.getMonth() + delta);
    next.setDate(1);
    setSelectedDate(next);
  }

  function formatRecurrence(event: CalendarEvent) {
    if (!event.rrule) return null;
    if (event.metadata && typeof event.metadata.recurrence_label === 'string') {
      return event.metadata.recurrence_label;
    }
    if (event.rrule.includes('DAILY')) return 'Daily';
    if (event.rrule.includes('WEEKLY')) return 'Weekly';
    if (event.rrule.includes('MONTHLY')) return 'Monthly';
    return 'Repeats';
  }

  const { firstDay, daysInMonth } = getDaysInMonth(selectedDate);
  const today = new Date();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={() => navigateMonth(-1)}>
          <Text style={[styles.navArrow, { color: colors.tint }]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.text }]}>
          {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => navigateMonth(1)}>
          <Text style={[styles.navArrow, { color: colors.tint }]}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <Text key={i} style={[styles.dayName, { color: colors.textSecondary }]}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {Array.from({ length: firstDay }).map((_, index) => (
          <View key={`empty-${index}`} style={styles.dayCell} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const isSelected = day === selectedDate.getDate();
          const isToday =
            day === today.getDate() &&
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear();

          return (
            <TouchableOpacity
              key={day}
              style={styles.dayCell}
              onPress={() => {
                const next = new Date(selectedDate);
                next.setDate(day);
                setSelectedDate(next);
              }}
            >
              <View
                style={[
                  styles.dayCircle,
                  isSelected && styles.dayCircleSelected,
                  isToday && !isSelected && { backgroundColor: colors.surfaceBorder },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: isSelected ? '#fff' : isToday ? brand.accent : colors.text },
                    isToday && !isSelected && { fontWeight: '700' },
                  ]}
                >
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.eventsSection}>
        <View style={styles.eventHeader}>
          <View>
            <Text style={[styles.eventsTitle, { color: colors.text }]}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={[styles.eventsSubtitle, { color: colors.textSecondary }]}>
              Phase 3 adds recurrence, visibility, and attendee invites.
            </Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: brand.primary }]} onPress={() => setShowCreate(true)}>
            <Text style={styles.addBtnText}>+ Event</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={events}
          keyExtractor={(event) => event.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.eventRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
              onPress={() => router.push(`/event/${item.id}`)}
            >
              <View style={[styles.eventDot, { backgroundColor: item.color ?? brand.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.eventTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
                  {item.all_day
                    ? 'All day'
                    : `${new Date(item.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(item.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  {item.location ? ` · ${item.location}` : ''}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaChip, { color: colors.textSecondary, borderColor: colors.surfaceBorder }]}>
                    {item.visibility}
                  </Text>
                  {formatRecurrence(item) ? (
                    <Text style={[styles.metaChip, { color: colors.textSecondary, borderColor: colors.surfaceBorder }]}>
                      {formatRecurrence(item)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>No events</Text>}
        />
      </View>

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Event</Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Dinner with Ahmed"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={location}
              onChangeText={setLocation}
              placeholder="Dubai Mall"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.surfaceBorder }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Notes..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            <View style={styles.timeRow}>
              <View style={styles.timeGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Start</Text>
                <View style={styles.timeInputs}>
                  <TextInput
                    style={[styles.timeInput, { color: colors.text, borderColor: colors.surfaceBorder }]}
                    value={startHour}
                    onChangeText={setStartHour}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={{ color: colors.text, fontSize: 18 }}>:</Text>
                  <TextInput
                    style={[styles.timeInput, { color: colors.text, borderColor: colors.surfaceBorder }]}
                    value={startMin}
                    onChangeText={setStartMin}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>
              <View style={styles.timeGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>End</Text>
                <View style={styles.timeInputs}>
                  <TextInput
                    style={[styles.timeInput, { color: colors.text, borderColor: colors.surfaceBorder }]}
                    value={endHour}
                    onChangeText={setEndHour}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={{ color: colors.text, fontSize: 18 }}>:</Text>
                  <TextInput
                    style={[styles.timeInput, { color: colors.text, borderColor: colors.surfaceBorder }]}
                    value={endMin}
                    onChangeText={setEndMin}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>
            </View>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>Visibility</Text>
            <View style={styles.optionRow}>
              {VISIBILITIES.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionChip,
                    { borderColor: colors.surfaceBorder },
                    visibility === option && { backgroundColor: brand.primary, borderColor: brand.primary },
                  ]}
                  onPress={() => setVisibility(option)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: colors.textSecondary },
                      visibility === option && { color: '#fff' },
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>Recurrence</Text>
            <View style={styles.optionRow}>
              {RECURRENCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.optionChip,
                    { borderColor: colors.surfaceBorder },
                    recurrence === option.value && { backgroundColor: brand.primary, borderColor: brand.primary },
                  ]}
                  onPress={() => setRecurrence(option.value)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: colors.textSecondary },
                      recurrence === option.value && { color: '#fff' },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.surfaceBorder, borderWidth: 1 }]}
                onPress={() => setShowCreate(false)}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: brand.primary }]} onPress={handleCreate}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  navArrow: { fontSize: 22, fontWeight: '600', padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: '600' },
  weekRow: { flexDirection: 'row', paddingHorizontal: 10, marginTop: 12, marginBottom: 2 },
  dayName: { width: '14.28%', textAlign: 'center', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, marginTop: 8 },
  dayCell: { width: '14.28%', height: 44, justifyContent: 'center', alignItems: 'center' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  dayCircleSelected: { backgroundColor: brand.primary },
  dayText: { fontSize: 14, textAlign: 'center' },
  eventsSection: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 },
  eventsTitle: { fontSize: 16, fontWeight: '600' },
  eventsSubtitle: { fontSize: 12, marginTop: 4 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  eventRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  eventTitle: { fontSize: 15, fontWeight: '500' },
  eventTime: { fontSize: 13, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, overflow: 'hidden' },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 20 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 20 },
  timeGroup: { flex: 1 },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeInput: { borderWidth: 1, borderRadius: 8, width: 48, height: 44, textAlign: 'center', fontSize: 16 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  optionChipText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 40 },
  modalBtn: { flex: 1, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
