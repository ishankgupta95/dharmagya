import { Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { deityColors } from '@/config/theme';

interface DeityAvatarProps {
  deity: string;
  size?: number;
}

const DEITY_INFO: Record<string, { initial: string; color: string }> = {
  Ganesh:  { initial: 'ग',   color: deityColors.Ganesh },
  Shiva:   { initial: 'श',   color: deityColors.Shiva },
  Lakshmi: { initial: 'ल',   color: deityColors.Lakshmi },
  Vishnu:  { initial: 'वि',  color: deityColors.Vishnu },
  Hanuman: { initial: 'ह',   color: deityColors.Hanuman },
};

const FALLBACK = { initial: 'ॐ', color: deityColors.Ganesh };

export function DeityAvatar({ deity, size = 48 }: DeityAvatarProps) {
  const info = DEITY_INFO[deity] ?? FALLBACK;
  const radius = size * 0.25;
  const fontSize = size * 0.42;

  return (
    <LinearGradient
      colors={[info.color + '50', info.color + '20']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.avatar, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.initial, { fontSize, color: info.color }]}>
        {info.initial}
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
});
