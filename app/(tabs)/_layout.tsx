import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { HapticTab } from '@/components/haptic-tab';
import { useStore } from '@/store/useStore';
import { darkColors, lightColors } from '@/config/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabLayout() {
  const { isDarkMode } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.base,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          paddingTop: 10,
        },
        tabBarLabel: ({ focused, color, children }) => (
          <Text
            style={{
              fontSize: 10,
              fontFamily: focused ? 'Mukta_500Medium' : 'Mukta_400Regular',
              color,
              marginTop: 2,
            }}>
            {children}
          </Text>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={(focused ? 'home' : 'home-outline') as IoniconName}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="panchang"
        options={{
          title: 'Panchang',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={(focused ? 'calendar' : 'calendar-outline') as IoniconName}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={(focused ? 'library' : 'library-outline') as IoniconName}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
