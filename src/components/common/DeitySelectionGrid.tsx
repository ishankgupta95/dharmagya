import { memo } from 'react';
import { View, TouchableOpacity, FlatList, StyleSheet, Dimensions, ListRenderItemInfo } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/common/Icon';

import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { ALL_DEITIES, type DeityMeta } from '@/config/deities';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { useStore } from '@/store/useStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_COLUMNS = 2;
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.screenH * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface DeitySelectionGridProps {
  value: string[];
  onChange: (next: string[]) => void;
  colors?: ColorPalette;
  contentContainerStyle?: object;
  scrollEnabled?: boolean;
}

export const DeitySelectionGrid = memo(function DeitySelectionGrid({
  value,
  onChange,
  colors,
  contentContainerStyle,
  scrollEnabled = true,
}: DeitySelectionGridProps) {
  const isDarkMode = useStore(s => s.isDarkMode);
  const palette = colors ?? (isDarkMode ? darkColors : lightColors);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((d) => d !== id) : [...value, id]);
  }

  const renderDeity = ({ item }: ListRenderItemInfo<DeityMeta>) => {
    const isSelected = value.includes(item.id);
    return (
      <DeityCard
        deity={item}
        isSelected={isSelected}
        colors={palette}
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

interface DeityCardProps {
  deity: DeityMeta;
  isSelected: boolean;
  colors: ColorPalette;
  onPress: () => void;
}

const DeityCard = memo(function DeityCard({ deity, isSelected, colors, onPress }: DeityCardProps) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isSelected ? deity.color : colors.border,
          width: CARD_WIDTH,
        },
        isSelected && { backgroundColor: deity.color + '12' },
      ]}
      accessibilityRole="checkbox"
      accessibilityLabel={t(`deities.${deity.id}.displayName`)}
      accessibilityState={{ checked: isSelected }}>
      <DeityAvatar deity={deity.id} size={64} />
      <Text style={[styles.cardNameHindi, { color: colors.textPrimary }]} numberOfLines={1}>
        {t(`deities.${deity.id}.displayName`)}
      </Text>
      {isSelected && (
        <View style={[styles.checkCircle, { backgroundColor: deity.color }]}>
          <Icon name="check" size={10} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  gridContent: { paddingBottom: 8 },
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1.5,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 4,
    position: 'relative',
  },
  cardNameHindi: { fontSize: 13, fontFamily: 'NotoSerifDevanagari_500Medium' },
  checkCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
