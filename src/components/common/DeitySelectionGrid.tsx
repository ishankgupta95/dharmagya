import { memo } from 'react';
import { View, FlatList, StyleSheet, Dimensions, ListRenderItemInfo } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText as Text } from '@/components/common/AppText';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/common/Icon';

import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { ALL_DEITIES, type DeityMeta } from '@/config/deities';
import { getDeityImageSmall } from '@/config/deityImages';
import { useStore } from '@/store/useStore';
import { MotionPressable } from '@/components/common/MotionPressable';

const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_COLUMNS = 3;
const CARD_GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.screenH * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface DeitySelectionGridProps {
  value: string[];
  onChange: (next: string[]) => void;
  colors?: ColorPalette;
  contentContainerStyle?: object;
  scrollEnabled?: boolean;
}

/**
 * Ishta-devata portrait grid (frame 32) — three columns of portrait tiles,
 * the name over a bottom scrim, unpicked forms held at 62% opacity so the
 * chosen ones read at a glance.
 */
export const DeitySelectionGrid = memo(function DeitySelectionGrid({
  value,
  onChange,
  colors,
  contentContainerStyle,
  scrollEnabled = true,
}: DeitySelectionGridProps) {
  const isDarkMode = useStore(s => s.isDarkMode);
  const theme = colors ?? (isDarkMode ? darkColors : lightColors);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((d) => d !== id) : [...value, id]);
  }

  const renderDeity = ({ item }: ListRenderItemInfo<DeityMeta>) => {
    const isSelected = value.includes(item.id);
    return (
      <DeityTile
        deity={item}
        isSelected={isSelected}
        colors={theme}
        onPress={() => toggle(item.id)}
      />
    );
  };

  return (
    <FlatList
      data={ALL_DEITIES}
      keyExtractor={(item) => item.id}
      renderItem={renderDeity}
      numColumns={NUM_COLUMNS}
      contentContainerStyle={[styles.gridContent, contentContainerStyle]}
      columnWrapperStyle={styles.gridRow}
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
    />
  );
});

interface DeityTileProps {
  deity: DeityMeta;
  isSelected: boolean;
  colors: ColorPalette;
  onPress: () => void;
}

const DeityTile = memo(function DeityTile({ deity, isSelected, colors, onPress }: DeityTileProps) {
  const { t } = useTranslation();
  const image = getDeityImageSmall(deity.id);
  return (
    <MotionPressable
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: isSelected ? colors.accent : colors.border,
          borderWidth: isSelected ? 1.5 : 1,
          width: CARD_WIDTH,
          opacity: isSelected ? 1 : 0.62,
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityLabel={t(`deities.${deity.id}.displayName`)}
      accessibilityState={{ checked: isSelected }}>
      {image ? (
        <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.initialWrap, { backgroundColor: `${deity.color}2E` }]}>
          <Text variant="deva-bold" style={[styles.initial, { color: colors.textPrimary }]}>
            {deity.initial}
          </Text>
        </View>
      )}
      <LinearGradient
        colors={['rgba(11,8,16,0)', 'rgba(11,8,16,0.72)']}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Text variant="deva" style={styles.tileName} numberOfLines={1}>
        {t(`deities.${deity.id}.displayName`)}
      </Text>
      {isSelected && (
        <View style={[styles.checkCircle, { backgroundColor: colors.accent }]}>
          <Icon name="check" size={10} color={palette.night} />
        </View>
      )}
    </MotionPressable>
  );
});

const styles = StyleSheet.create({
  gridContent: { paddingBottom: 8 },
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },
  tile: {
    aspectRatio: 0.88,
    borderRadius: borderRadius.tile,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  initialWrap: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 30, lineHeight: 42 },
  tileName: {
    fontSize: 12.5,
    lineHeight: 18,
    color: palette.bone,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  checkCircle: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 19,
    height: 19,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
