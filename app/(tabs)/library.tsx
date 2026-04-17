import { useState, useCallback, useRef, memo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { getDeityImage } from '@/config/deityImages';
import { AdBanner } from '@/components/common/AdBanner';
import { WalkthroughSpotlight, type SpotlightRect } from '@/components/common/WalkthroughOverlay';
import { ALL_DEITIES, type DeityMeta } from '@/config/deities';

type DeityCardData = DeityMeta;

export default function LibraryScreen() {
  const isDarkMode = useStore(s => s.isDarkMode);
  const walkthroughStep = useStore(s => s.walkthroughStep);
  const setWalkthroughStep = useStore(s => s.setWalkthroughStep);
  const colors = isDarkMode ? darkColors : lightColors;
  const { t } = useTranslation();

  const deityGridRef = useRef<View>(null);
  const [deityGridRect, setDeityGridRect] = useState<SpotlightRect | null>(null);

  const measureDeityGrid = useCallback(() => {
    deityGridRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) {
        setDeityGridRect({ x, y, width, height: Math.min(height, 210) });
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (walkthroughStep === 3) {
        const timer = setTimeout(measureDeityGrid, 300);
        return () => clearTimeout(timer);
      }
    }, [walkthroughStep, measureDeityGrid])
  );

  const renderDeity = useCallback(
    ({ item }: ListRenderItemInfo<DeityCardData>) => (
      <DeityCard deity={item} colors={colors} />
    ),
    [colors]
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
            {t('library.godsTitle')}
          </Text>
          <Text style={[styles.screenTitleEn, { color: colors.textMuted }]}>
            {t('library.godsTitleEn')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/search')}
          style={[styles.searchBtn, { backgroundColor: colors.surfaceRecessed }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View ref={deityGridRef} style={{ flex: 1 }}>
        <FlatList
          data={ALL_DEITIES}
          keyExtractor={(item) => item.id}
          renderItem={renderDeity}
          getItemLayout={(_, index) => ({ length: 98, offset: 98 * index, index })}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<AdBanner colors={colors} placement="libraryGodsInline" inline />}
        />
      </View>

      {walkthroughStep === 3 && deityGridRect && (
        <WalkthroughSpotlight
          spotlight={deityGridRect}
          title={t('walkthrough.step3Title')}
          description={t('walkthrough.step3Desc')}
          tooltipPosition="below"
          stepIndex={2}
          totalSteps={4}
          onNext={() => {
            setWalkthroughStep(4);
            router.push('/(tabs)');
          }}
          onSkip={() => setWalkthroughStep(0)}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

interface DeityCardProps {
  deity: DeityCardData;
  colors: ColorPalette;
}

const DeityCard = memo(function DeityCard({ deity, colors }: DeityCardProps) {
  const { t } = useTranslation();
  const image = getDeityImage(deity.id);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/god/${deity.id}`)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: deity.color + '25' }]}>

      <View style={[styles.imageBox, { backgroundColor: deity.color + '15' }]}>
        {image ? (
          <Image source={image} style={styles.image} resizeMode="cover" />
        ) : (
          <DeityAvatar deity={deity.id} size={72} />
        )}
      </View>

      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
          {t(`deities.${deity.id}.displayName`)}
        </Text>
        <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={1}>
          {t(`deities.${deity.id}.description`)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginRight: 4 }} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
  },
  screenTitle: { fontSize: 22, fontFamily: 'Mukta_700Bold', lineHeight: 28 },
  screenTitleEn: { fontSize: 12, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5, marginTop: 1 },
  searchBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingTop: 4, paddingBottom: 32, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageBox: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 88,
    height: 88,
  },
  cardInfo: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  cardName: { fontSize: 16, fontFamily: 'Mukta_600SemiBold', lineHeight: 22 },
  cardDesc: { fontSize: 12, fontFamily: 'Mukta_400Regular', lineHeight: 16 },
});
