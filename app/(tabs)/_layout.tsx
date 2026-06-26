import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth';
import { ActivityIndicator, View } from 'react-native';

function TabIcon({ icon, color }: { icon: string; color: string }) {
  return <Text style={{ fontSize: 22, color }}>{icon}</Text>;
}

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'dark';
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors[colorScheme].background }}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme].surface,
          borderTopColor: Colors[colorScheme].surfaceBorder,
        },
        headerStyle: {
          backgroundColor: Colors[colorScheme].surface,
        },
        headerTintColor: Colors[colorScheme].text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <TabIcon icon="☀️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <TabIcon icon="📅" color={color} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarIcon: ({ color }) => <TabIcon icon="🎙" color={color} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color }) => <TabIcon icon="👥" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon icon="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}
