import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';

import Colors, { brand } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { fetchUserDirectory, type AppUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

export default function UsersScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { profile, session } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [managingUser, setManagingUser] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadUsers = useCallback(async () => {
    if (profile?.role !== 'admin' || !session) return;
    try {
      const result = await fetchUserDirectory(session);
      setUsers(result.users);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [profile?.role, session]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const pendingUsers = useMemo(
    () => users.filter((user) => user.role === 'pending'),
    [users]
  );

  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => {
      if (a.role === 'pending' && b.role !== 'pending') return -1;
      if (a.role !== 'pending' && b.role === 'pending') return 1;
      return a.display_name.localeCompare(b.display_name);
    });

    if (!normalized) return sorted;

    return sorted.filter((user) => {
      const haystack = `${user.display_name} ${user.email ?? ''} ${user.role}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, users]);

  if (profile?.role !== 'admin') {
    return <Redirect href="/(tabs)/settings" />;
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  }

  async function handleApprove(user: AppUser) {
    Alert.alert(
      `Approve ${user.display_name}`,
      'Choose a role for this user:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Family', onPress: () => submitManage(user.id, 'approve', 'family') },
        { text: 'Friend', onPress: () => submitManage(user.id, 'approve', 'friend') },
        { text: 'Member', onPress: () => submitManage(user.id, 'approve', 'member') },
      ]
    );
  }

  async function handleReject(user: AppUser) {
    Alert.alert(
      'Reject user',
      `Remove ${user.display_name}'s account permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => submitManage(user.id, 'reject'),
        },
      ]
    );
  }

  async function submitManage(userId: string, action: 'approve' | 'reject', role?: string) {
    if (!session) return;
    setManagingUser(userId);
    try {
      const response = await fetch(`${API_URL}/api/auth/manage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, userId, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Request failed');
      await loadUsers();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setManagingUser(null);
    }
  }

  function renderUser({ item }: { item: AppUser }) {
    const isPending = item.role === 'pending';

    return (
      <View style={[styles.userRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={[styles.avatar, { backgroundColor: roleColor(item.role) + '22' }]}>
          <Text style={[styles.avatarText, { color: roleColor(item.role) }]}>
            {item.display_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userHeader}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {item.display_name}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: roleColor(item.role) + '1F' }]}>
              <Text style={[styles.roleText, { color: roleColor(item.role) }]}>{item.role}</Text>
            </View>
          </View>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.email ?? 'No email found'}
          </Text>
          <Text style={[styles.joinedText, { color: colors.textSecondary }]}>
            Joined {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          {isPending && (
            <View style={styles.actions}>
              {managingUser === item.id ? (
                <ActivityIndicator size="small" color={colors.tint} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.approveBtn, { backgroundColor: brand.success + '22' }]}
                    onPress={() => handleApprove(item)}
                  >
                    <Text style={[styles.approveText, { color: brand.success }]}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectBtn, { borderColor: brand.danger + '44' }]}
                    onPress={() => handleReject(item)}
                  >
                    <Text style={[styles.rejectText, { color: brand.danger }]}>Reject</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.summaryNum, { color: brand.warning }]}>{pendingUsers.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Pending</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.summaryNum, { color: brand.primary }]}>{users.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Users</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, email, or role"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          style={[
            styles.searchInput,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, color: colors.text },
          ]}
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={visibleUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {query.trim() ? 'SEARCH RESULTS' : 'USERS'}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No users found</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Try a different name, email, or role.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function roleColor(role: AppUser['role']) {
  switch (role) {
    case 'admin': return brand.primary;
    case 'family': return '#FF6B6B';
    case 'friend': return brand.accent;
    case 'member': return brand.success;
    default: return brand.warning;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  summaryCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  summaryNum: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  summaryLabel: { fontSize: 12 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 14 },
  searchInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0, marginBottom: 8, marginLeft: 4 },
  userRow: { flexDirection: 'row', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 17, fontWeight: '700' },
  userInfo: { flex: 1 },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { flex: 1, fontSize: 15, fontWeight: '700' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  roleText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  userEmail: { fontSize: 13, marginTop: 4 },
  joinedText: { fontSize: 12, marginTop: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  approveBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  approveText: { fontSize: 12, fontWeight: '800' },
  rejectBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  rejectText: { fontSize: 12, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
