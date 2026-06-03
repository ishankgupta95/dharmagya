import { Redirect, Tabs } from 'expo-router';
import { View, StyleSheet, type ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const hasOnboarded = useStore((s) => s.hasOnboarded);
  const walkthroughStep = useStore((s) => s.walkthroughStep);
  const walkthroughActive = walkthroughStep > 0;

  // Declarative redirect short-circuits the (tabs) layout before its children
  // mount on cold start. The effect-based redirect in app/_layout.tsx fires
  // AFTER (tabs)/index has already started mounting and after the splash has
  // dismissed — leaving the user staring at a half-mounted Home until the
  // queued navigation commits (often only after a touch event drains the
  // layout queue on Android).
  if (!hasOnboarded) return <Redirect href="/onboarding/step1" />;

  const activeColor = isDark ? ACTIVE_DARK : ACTIVE_LIGHT;
  const inactiveColor = isDark ? INACTIVE_DARK : INACTIVE_LIGHT;
  const barBg = isDark ? palette.nightPlinth : palette.parchmentBright;
  const barBorder = isDark ? 'rgba(201,155,58,0.22)' : 'rgba(156,118,35,0.22)';
  const sceneBg = isDark ? darkColors.base : lightColors.base;

  // Edge-to-edge tab bar — no horizontal margin, no border-radius, no floating
  // shadow. Anchored to the bottom edge with safe-area inset padding so the
  // labels clear the gesture pill on Android / the home indicator on iOS.
  // Height + insets sized so 6 tabs (Home / Panchang / Gods / Pujas /
  // Astrology / Settings) fit without wrapping the longer labels.
  const TAB_BAR_INNER_HEIGHT = 56;
  const tabBarHeight = TAB_BAR_INNER_HEIGHT + Math.max(insets.bottom, 6);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        sceneStyle: { backgroundColor: sceneBg },
        tabBarStyle: walkthroughActive
          ? { display: 'none' }
          : {
              backgroundColor: barBg,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: barBorder,
              height: tabBarHeight,
              paddingTop: 6,
              paddingBottom: Math.max(insets.bottom, 6),
            },
        tabBarItemStyle: {
          paddingTop: 0,
          paddingHorizontal: 0,
        },
        tabBarLabel: ({ color, focused, children }) => (
          <AppText
            variant="mono-caps"
            numberOfLines={1}
            allowFontScaling={false}
            style={[
              styles.label,
              { color, opacity: focused ? 1 : 0.78 },
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
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} emberColor={activeColor} name="flower" />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          // Label resolves from `tabs.devotion` (was `tabs.pujas`, and
          // `tabs.practice` before that). File stays `practice.tsx` since the
          // URL `/practice` is already referenced from other screens /
          // notifications; renaming the file would invalidate those without
          // payoff. The tab is a broad devotional hub (texts, tirtha,
          // festivals, pujas), so the label is "Devotion", not "Pujas".
          title: t('tabs.devotion'),
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} emberColor={activeColor} name="flame" />,
        }}
      />
      <Tabs.Screen
        name="astrology"
        options={{
          title: t('tabs.astrology'),
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} emberColor={activeColor} name="diamond" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: (props) => <TabIcon focused={props.focused} color={props.color} emberColor={activeColor} name="gear" />,
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
  color: ColorValue;
  emberColor: ColorValue;
  name: IconName;
}) {
  // tab system types color as ColorValue (string | OpaqueColorValue) but we
  // only ever feed it palette literals, so the string cast is safe here.
  return (
    <View style={styles.iconSlot}>
      {focused && <View style={[styles.ember, { backgroundColor: emberColor, shadowColor: emberColor }]} />}
      <Icon name={name} size={20} color={color as string} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 6 tabs on a 360-dp screen → each cell ~60 dp. Label fits 5–7 chars at
  // fontSize 8 with letterSpacing 1.2 in one line; longer labels truncate
  // with an ellipsis instead of wrapping.
  label: {
    fontSize: 8,
    marginTop: 2,
    letterSpacing: 1.2,
    textAlign: 'center',
    includeFontPadding: false,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 24,
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
