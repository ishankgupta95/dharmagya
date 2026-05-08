import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBar } from '@react-navigation/bottom-tabs';

import { HapticTab } from '@/components/haptic-tab';
import { AppText } from '@/components/common/AppText';
import { Icon, type IconName } from '@/components/common/Icon';
import { darkColors, lightColors, palette } from '@/config/theme';
import { useStore } from '@/store/useStore';
import { pmark } from '@/utils/perfProfile';

const ACTIVE_DARK = palette.goldLeaf;
const INACTIVE_DARK = 'rgba(243,229,200,0.55)';
const ACTIVE_LIGHT = palette.sindoor;
const INACTIVE_LIGHT = palette.inkQuiet;

export default function TabLayout() {
  pmark('tabs:_layout:render');
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isDark = useStore((s) => s.isDarkMode);
  const walkthroughStep = useStore((s) => s.walkthroughStep);
  const walkthroughActive = walkthroughStep > 0;

  const activeColor = isDark ? ACTIVE_DARK : ACTIVE_LIGHT;
  const inactiveColor = isDark ? INACTIVE_DARK : INACTIVE_LIGHT;
  const barBg = isDark ? 'rgba(43,26,15,0.94)' : 'rgba(251,243,222,0.96)';
  const barBorder = isDark ? 'rgba(201,155,58,0.22)' : 'rgba(156,118,35,0.22)';
  const sceneBg = isDark ? darkColors.base : lightColors.base;

  return (
    <Tabs
      tabBar={(props) => (
        <View style={{ backgroundColor: sceneBg }}>
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        sceneStyle: { backgroundColor: sceneBg },
        tabBarStyle: walkthroughActive
          ? { display: 'none' }
          : {
              // Floating pill. Solid at 94–96% opacity — RN can't do
              // backdrop-filter, so the bg is just near-opaque.
              backgroundColor: barBg,
              borderTopWidth: 0,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: barBorder,
              borderRadius: 22,
              height: 60,
              marginHorizontal: 18,
              marginBottom: Math.max(insets.bottom, 10),
              paddingTop: 8,
              paddingBottom: 8,
              // Soft shadow — iOS reads this; Android uses elevation.
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.28 : 0.16,
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
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} emberColor={activeColor} name="home" />,
        }}
      />
      <Tabs.Screen
        name="panchang"
        options={{
          title: t('tabs.panchang'),
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} emberColor={activeColor} name="calendar" />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.gods'),
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} emberColor={activeColor} name="people" />,
        }}
      />
      <Tabs.Screen
        name="astrology"
        options={{
          title: t('tabs.astrology'),
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} emberColor={activeColor} name="diamond" />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  focused,
  color,
  emberColor,
  name,
}: {
  focused: boolean;
  color: string;
  emberColor: string;
  name: IconName;
}) {
  return (
    <View style={styles.iconSlot}>
      {focused && <View style={[styles.ember, { backgroundColor: emberColor, shadowColor: emberColor }]} />}
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
});
