import { Text, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DEITY_BY_NAME } from '@/config/deities';
import { getDeityImage } from '@/config/deityImages';
import { deityColors } from '@/config/theme';

interface DeityAvatarProps {
  deity: string;
  size?: number;
}

const FALLBACK = { initial: 'ॐ', color: deityColors.Ganesh };

export function DeityAvatar({ deity, size = 48 }: DeityAvatarProps) {
  const meta = DEITY_BY_NAME[deity];
  const color = meta?.color ?? FALLBACK.color;
  const radius = size * 0.25;
  const image = getDeityImage(deity);

  if (image) {
    return (
      <View style={[styles.imageContainer, { width: size, height: size, borderRadius: radius, borderColor: color + '40' }]}>
        <Image source={image} style={{ width: size, height: size, borderRadius: radius }} resizeMode="cover" />
      </View>
    );
  }

  // Fallback: Devanagari initial in gradient circle
  const initial = meta?.initial ?? FALLBACK.initial;
  const fontSize = size * 0.42;

  return (
    <LinearGradient
      colors={[color + '50', color + '20']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.avatar, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.initial, { fontSize, color }]}>
        {initial}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontFamily: 'Mukta_700Bold',
  },
  imageContainer: {
    overflow: 'hidden',
    borderWidth: 1.5,
  },
});
