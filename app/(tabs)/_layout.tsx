import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { AppText } from '@/components/common/AppText';
import { Icon, type IconName } from '@/components/common/Icon';
import { palette } from '@/config/theme';

const ACTIVE_COLOR = palette.goldLeaf;
const INACTIVE_COLOR = 'rgba(243,229,200,0.55)';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          // Floating dark pill. Solid dark at 94% opacity — RN can't do
          // backdrop-filter, so the bg is just near-opaque.
          backgroundColor: 'rgba(43,26,15,0.94)',
          borderTopWidth: 0,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(201,155,58,0.22)',
          borderRadius: 22,
          height: 60,
          marginHorizontal: 18,
          marginBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          paddingBottom: 8,
          // Soft shadow — iOS reads this; Android uses elevation.
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.28,
          shadowRadius: 14,
          elevation: 10,
          // Intentionally not absolute — keeps screens' bottom insets correct
          // during the transition. Floating pill look still comes through via
          // the horizontal margin + border radius + shadow.
        },
        tabBarItemStyle: {
          paddingTop: 0,
        },
        tabBarLabel: ({ focused, color, children }) => (
          <AppText
            variant="mono-caps"
            style={[
              styles.label,
              { color, opacity: focused ? 1 : 0.85 },
            ]}>
            {children}
          </AppText>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} name="home" />,
        }}
      />
      <Tabs.Screen
        name="panchang"
        options={{
          title: t('tabs.panchang'),
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} name="calendar" />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.gods'),
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} name="people" />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  focused,
  color,
  name,
}: {
  focused: boolean;
  color: string;
  name: IconName;
}) {
  return (
    <View style={styles.iconSlot}>
      {focused && <View style={styles.ember} />}
      <Icon name={name} size={22} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 8.5,
    marginTop: 2,
    letterSpacing: 1.6,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 28,
  },
  ember: {
    position: 'absolute',
    top: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.goldLeaf,
    shadowColor: palette.goldLeaf,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
});
