import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';

import { AppText as Text } from '@/components/common/AppText';
import { useStore } from '@/store/useStore';
import { darkColors, lightColors, typeScale } from '@/config/theme';
import { refreshTodayWidget } from '@/services/widgets/widgetRefresh';

/**
 * Refresh-and-return target for the widget's Refresh tap zone. Forces a
 * recompute of today's panchang into the widget store, briefly confirms it
 * to the user, then bounces them into the Panchang tab so a back-gesture
 * exits cleanly instead of looping back to this transient screen.
 */
export default function RefreshWidgetScreen() {
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshTodayWidget({ force: true });
      if (cancelled) return;
      setDone(true);
      setTimeout(() => {
        if (cancelled) return;
        router.replace('/panchang');
      }, 900);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'fade',
        }}
      />
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.borderAccent },
        ]}
      >
        <Text style={[typeScale.monoCaps, styles.kicker, { color: colors.accent }]}>
          {done ? 'REFRESHED' : 'REFRESHING'}
        </Text>
        <Text style={[typeScale.bodySerif, styles.line, { color: colors.textPrimary }]}>
          Today’s Panchang
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 220,
    alignItems: 'center',
  },
  kicker: {
    fontSize: 10,
    marginBottom: 8,
  },
  line: {
    fontSize: 16,
  },
});
