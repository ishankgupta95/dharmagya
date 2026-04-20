import { memo } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Polyline, Rect, type SvgProps } from 'react-native-svg';

/**
 * Sacred Editorial icon set. Replaces Ionicons across the app. Paths ported
 * one-for-one from the design study's SVG symbol sheet in
 * [design/redesign-preview.html](design/redesign-preview.html), extended with
 * thin-stroke outline glyphs drawn in-house for the specialized cases that
 * weren't in the study (sparkles, ribbon, warning, etc.).
 *
 * Stroke icons use `currentColor` via the `color` prop. Filled icons (play,
 * heart-filled, dots, diamond, star, ellipse) honour the same `color` prop
 * for fill. Each glyph lives in a 24×24 viewBox unless noted in
 * `GLYPH_VIEWBOX`. All outline strokes use linecap/linejoin=round to match
 * the editorial weight.
 */
export type IconName =
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevron-down'
  | 'home'
  | 'calendar'
  | 'people'
  | 'gear'
  | 'heart'
  | 'heart-outline'
  | 'search'
  | 'close'
  | 'check'
  | 'play'
  | 'pause'
  | 'sun'
  | 'moon'
  | 'flame'
  | 'bookmark'
  | 'dots'
  | 'location'
  | 'text'
  | 'diamond'
  | 'lotus'
  // New in P6.9.2 — specialised outline glyphs that replace the
  // remaining Ionicons call sites across panchang / muhurat / settings.
  | 'alarm'
  | 'alert-circle'
  | 'apps'
  | 'arrow-right'
  | 'bell'
  | 'car'
  | 'caret-down'
  | 'check-circle'
  | 'circle-outline'
  | 'clock'
  | 'close-circle'
  | 'compass'
  | 'contrast'
  | 'cut'
  | 'ellipse'
  | 'flower'
  | 'gift'
  | 'globe'
  | 'hand'
  | 'info-circle'
  | 'map'
  | 'navigate'
  | 'person'
  | 'play-circle'
  | 'refresh'
  | 'restaurant'
  | 'return-back'
  | 'ribbon'
  | 'school'
  | 'sparkles'
  | 'star'
  | 'star-half'
  | 'stop-circle'
  | 'swap-horizontal'
  | 'walk'
  | 'warning'
  | 'chat'
  | 'shield';

interface IconProps extends Omit<SvgProps, 'color'> {
  name: IconName;
  size?: number;
  color?: string;
}

export const Icon = memo(function Icon({
  name,
  size = 18,
  color = 'currentColor',
  ...rest
}: IconProps) {
  const viewBox = GLYPH_VIEWBOX[name] ?? '0 0 24 24';
  return (
    <Svg width={size} height={size} viewBox={viewBox} {...rest}>
      <Glyph name={name} color={color} />
    </Svg>
  );
});

const GLYPH_VIEWBOX: Partial<Record<IconName, string>> = {
  diamond: '0 0 20 20',
  lotus: '0 0 48 20',
};

interface GlyphProps {
  name: IconName;
  color: string;
}

function Glyph({ name, color }: GlyphProps) {
  switch (name) {
    case 'chevron-left':
      return (
        <Polyline
          points="15,5 8,12 15,19"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'chevron-right':
      return (
        <Polyline
          points="9,5 16,12 9,19"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'chevron-up':
      return (
        <Polyline
          points="5,15 12,8 19,15"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'chevron-down':
      return (
        <Polyline
          points="5,9 12,16 19,9"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'home':
      return (
        <Path
          d="M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      );
    case 'calendar':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4}>
          <Rect x={3.5} y={5} width={17} height={15.5} rx={2} />
          <Line x1={3.5} y1={10} x2={20.5} y2={10} />
          <Line x1={8} y1={3} x2={8} y2={7} strokeLinecap="round" />
          <Line x1={16} y1={3} x2={16} y2={7} strokeLinecap="round" />
        </G>
      );
    case 'people':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4}>
          <Circle cx={9} cy={9} r={3.5} />
          <Path d="M3 20 C3 16.5 5.5 14 9 14 C12.5 14 15 16.5 15 20" />
          <Circle cx={16.5} cy={8} r={2.5} />
          <Path d="M14 14.5 C15 14.1 15.7 14 16.5 14 C19 14 21 16 21 19" />
        </G>
      );
    case 'gear':
      return (
        <G fill="none" stroke={color} strokeWidth={1.3} strokeLinejoin="round">
          <Circle cx={12} cy={12} r={3} />
          <Path d="M12 2.5 L13.2 5 L16 4 L16.2 6.8 L19 7.5 L17.8 10 L20 12 L17.8 14 L19 16.5 L16.2 17.2 L16 20 L13.2 19 L12 21.5 L10.8 19 L8 20 L7.8 17.2 L5 16.5 L6.2 14 L4 12 L6.2 10 L5 7.5 L7.8 6.8 L8 4 L10.8 5 Z" />
        </G>
      );
    case 'heart':
      return (
        <Path
          d="M12 21 C 4 15.5 4 9.5 4 9.5 C 4 6.5 6.5 4.5 9 4.5 C 10.7 4.5 12 5.5 12 7 C 12 5.5 13.3 4.5 15 4.5 C 17.5 4.5 20 6.5 20 9.5 C 20 15.5 12 21 12 21 Z"
          fill={color}
          stroke={color}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      );
    case 'heart-outline':
      return (
        <Path
          d="M12 21 C 4 15.5 4 9.5 4 9.5 C 4 6.5 6.5 4.5 9 4.5 C 10.7 4.5 12 5.5 12 7 C 12 5.5 13.3 4.5 15 4.5 C 17.5 4.5 20 6.5 20 9.5 C 20 15.5 12 21 12 21 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      );
    case 'search':
      return (
        <G stroke={color} strokeWidth={1.5} fill="none">
          <Circle cx={11} cy={11} r={6.5} />
          <Line x1={16} y1={16} x2={21} y2={21} strokeLinecap="round" />
        </G>
      );
    case 'close':
      return (
        <G stroke={color} strokeWidth={1.7} strokeLinecap="round">
          <Line x1={6} y1={6} x2={18} y2={18} />
          <Line x1={18} y1={6} x2={6} y2={18} />
        </G>
      );
    case 'check':
      return (
        <Polyline
          points="4,12 10,18 20,6"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'play':
      return <Polygon points="8,5 19,12 8,19" fill={color} />;
    case 'pause':
      return (
        <G fill={color}>
          <Rect x={7} y={5} width={3.5} height={14} />
          <Rect x={13.5} y={5} width={3.5} height={14} />
        </G>
      );
    case 'sun':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4}>
          <Circle cx={12} cy={12} r={4.5} />
          <G strokeLinecap="round">
            <Line x1={12} y1={2.5} x2={12} y2={5} />
            <Line x1={12} y1={19} x2={12} y2={21.5} />
            <Line x1={2.5} y1={12} x2={5} y2={12} />
            <Line x1={19} y1={12} x2={21.5} y2={12} />
            <Line x1={5.3} y1={5.3} x2={7} y2={7} />
            <Line x1={17} y1={17} x2={18.7} y2={18.7} />
            <Line x1={18.7} y1={5.3} x2={17} y2={7} />
            <Line x1={7} y1={17} x2={5.3} y2={18.7} />
          </G>
        </G>
      );
    case 'moon':
      return (
        <Path
          d="M20 14.5 A8 8 0 1 1 9.5 4 A6.5 6.5 0 0 0 20 14.5 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.4}
        />
      );
    case 'flame':
      return (
        <Path
          d="M12 22 C7 22 4 19 4 14.5 C4 11 6.5 9 7 7 C7.5 8 8 9 10 9 C9.5 6 10.5 3 12 2 C12 5 14 7 15 9 C15.5 8 16 7 16.5 7 C17 9 19 11 19 14.5 C19 19 16 22 12 22 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      );
    case 'bookmark':
      return (
        <Path
          d="M6 3 H18 V21 L12 16 L6 21 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      );
    case 'dots':
      return (
        <G fill={color}>
          <Circle cx={6} cy={12} r={1.6} />
          <Circle cx={12} cy={12} r={1.6} />
          <Circle cx={18} cy={12} r={1.6} />
        </G>
      );
    case 'location':
      return (
        <G fill="none" stroke={color} strokeWidth={1.3}>
          <Path d="M12 22 C 5 14.5 5 9.5 5 9.5 C 5 5.9 8.1 3 12 3 C 15.9 3 19 5.9 19 9.5 C 19 14.5 12 22 12 22 Z" />
          <Circle cx={12} cy={9.5} r={2.5} />
        </G>
      );
    case 'text':
      return (
        <G stroke={color} strokeWidth={1.5}>
          <Line x1={5} y1={6} x2={19} y2={6} />
          <Line x1={5} y1={12} x2={19} y2={12} />
          <Line x1={5} y1={18} x2={14} y2={18} />
        </G>
      );
    case 'diamond':
      return (
        <G>
          <Polygon points="10,3 17,10 10,17 3,10" fill="none" stroke={color} strokeWidth={1.2} />
          <Polygon points="10,7 13,10 10,13 7,10" fill={color} />
        </G>
      );
    case 'lotus':
      // Eight petals stacked from an 8-rhombus fan on a 48×20 strip.
      return (
        <G fill={color}>
          {[0, 6, 12, 18, 24, 30, 36, 42].map((cx) => (
            <Path key={cx} d={`M${cx + 3} 4 L${cx + 5} 10 L${cx + 3} 16 L${cx + 1} 10 Z`} />
          ))}
        </G>
      );

    // ── New glyphs (P6.9.2) ─────────────────────────────────────────────────

    case 'alarm':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={13} r={7} />
          <Polyline points="12,9 12,13 15,14.5" />
          <Line x1={4.5} y1={5.5} x2={7.5} y2={3} />
          <Line x1={19.5} y1={5.5} x2={16.5} y2={3} />
        </G>
      );
    case 'alert-circle':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round">
          <Circle cx={12} cy={12} r={8.5} />
          <Line x1={12} y1={7.5} x2={12} y2={13} />
          <Line x1={12} y1={16} x2={12} y2={16.5} />
        </G>
      );
    case 'apps':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4}>
          <Rect x={4} y={4} width={6} height={6} rx={1} />
          <Rect x={14} y={4} width={6} height={6} rx={1} />
          <Rect x={4} y={14} width={6} height={6} rx={1} />
          <Rect x={14} y={14} width={6} height={6} rx={1} />
        </G>
      );
    case 'arrow-right':
      return (
        <G stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Line x1={4} y1={12} x2={20} y2={12} />
          <Polyline points="14,6 20,12 14,18" />
        </G>
      );
    case 'bell':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 17 C6 13 7 11 7 9 A5 5 0 0 1 17 9 C17 11 18 13 18 17 Z" />
          <Path d="M10.5 20 A1.6 1.6 0 0 0 13.5 20" />
        </G>
      );
    case 'car':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
          <Path d="M4 16 V12 L6 7 H18 L20 12 V16 H17.5 V18 H14.5 V16 H9.5 V18 H6.5 V16 Z" />
          <Circle cx={8} cy={15} r={1.4} fill={color} />
          <Circle cx={16} cy={15} r={1.4} fill={color} />
        </G>
      );
    case 'caret-down':
      return <Polygon points="6,9 18,9 12,17" fill={color} />;
    case 'check-circle':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={8.5} />
          <Polyline points="8,12.5 11,15.5 16,9.5" />
        </G>
      );
    case 'circle-outline':
      return <Circle cx={12} cy={12} r={8} fill="none" stroke={color} strokeWidth={1.4} />;
    case 'clock':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={8.5} />
          <Polyline points="12,7 12,12 15.5,14" />
        </G>
      );
    case 'close-circle':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round">
          <Circle cx={12} cy={12} r={8.5} />
          <Line x1={9} y1={9} x2={15} y2={15} />
          <Line x1={15} y1={9} x2={9} y2={15} />
        </G>
      );
    case 'compass':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
          <Circle cx={12} cy={12} r={8.5} />
          <Polygon points="12,7 14.5,11.5 12,17 9.5,11.5" fill={color} />
        </G>
      );
    case 'contrast':
      return (
        <G stroke={color} strokeWidth={1.4}>
          <Circle cx={12} cy={12} r={8.5} fill="none" />
          <Path d="M12 3.5 A8.5 8.5 0 0 1 12 20.5 Z" fill={color} stroke="none" />
        </G>
      );
    case 'cut':
      // Scissors — two looped handles + open blades.
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={7} cy={17} r={2.5} />
          <Circle cx={17} cy={17} r={2.5} />
          <Line x1={8.5} y1={15.5} x2={19} y2={5} />
          <Line x1={15.5} y1={15.5} x2={5} y2={5} />
        </G>
      );
    case 'ellipse':
      return <Circle cx={12} cy={12} r={6} fill={color} />;
    case 'flower':
      return (
        <G fill="none" stroke={color} strokeWidth={1.3} strokeLinejoin="round">
          <Circle cx={12} cy={12} r={2.2} fill={color} />
          <Path d="M12 10 C 12 5 7 4 7 7 C 7 9.5 10 10 12 10 Z" />
          <Path d="M12 14 C 12 19 7 20 7 17 C 7 14.5 10 14 12 14 Z" />
          <Path d="M10 12 C 5 12 4 7 7 7 C 9.5 7 10 10 10 12 Z" />
          <Path d="M14 12 C 19 12 20 17 17 17 C 14.5 17 14 14 14 12 Z" />
        </G>
      );
    case 'gift':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
          <Rect x={4} y={10} width={16} height={10} rx={1} />
          <Rect x={3} y={7} width={18} height={3.5} rx={1} />
          <Line x1={12} y1={7} x2={12} y2={20} strokeWidth={1.3} />
          <Path d="M12 7 C 11 5 8 4 7.5 5.5 C 7 7 9.5 7 12 7 Z" />
          <Path d="M12 7 C 13 5 16 4 16.5 5.5 C 17 7 14.5 7 12 7 Z" />
        </G>
      );
    case 'globe':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4}>
          <Circle cx={12} cy={12} r={8.5} />
          <Ellipse cx={12} cy={12} rx={4} ry={8.5} />
          <Line x1={3.5} y1={12} x2={20.5} y2={12} />
        </G>
      );
    case 'hand':
      // Stylised open-palm glyph (replaces Ionicons `hand-left-outline`).
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M7 14 V9 A1.5 1.5 0 0 1 10 9 V12" />
          <Path d="M10 12 V7 A1.5 1.5 0 0 1 13 7 V12" />
          <Path d="M13 12 V8 A1.5 1.5 0 0 1 16 8 V13" />
          <Path d="M16 13 V10 A1.5 1.5 0 0 1 19 10 V16 C 19 19 16.5 21 13 21 C 9 21 7 19 7 14 Z" />
        </G>
      );
    case 'info-circle':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round">
          <Circle cx={12} cy={12} r={8.5} />
          <Line x1={12} y1={11} x2={12} y2={16.5} />
          <Line x1={12} y1={7.5} x2={12} y2={8} />
        </G>
      );
    case 'map':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
          <Polygon points="3,6 9,4 15,6 21,4 21,18 15,20 9,18 3,20" />
          <Line x1={9} y1={4} x2={9} y2={18} />
          <Line x1={15} y1={6} x2={15} y2={20} />
        </G>
      );
    case 'navigate':
      // Paper-airplane style navigate glyph.
      return (
        <Polygon
          points="4,20 21,11.5 4,3 7,11.5"
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      );
    case 'person':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
          <Circle cx={12} cy={8} r={4} />
          <Path d="M4.5 20 C4.5 15.5 7.5 13 12 13 C16.5 13 19.5 15.5 19.5 20" />
        </G>
      );
    case 'play-circle':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
          <Circle cx={12} cy={12} r={8.5} />
          <Polygon points="10,8 17,12 10,16" fill={color} stroke="none" />
        </G>
      );
    case 'refresh':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 12 A8 8 0 1 1 17.5 6.5" />
          <Polyline points="20,3 20,7 16,7" />
        </G>
      );
    case 'restaurant':
      // Fork (left, three tines) + knife (right blade).
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Line x1={7} y1={3} x2={7} y2={21} />
          <Line x1={5} y1={3} x2={5} y2={9} />
          <Line x1={9} y1={3} x2={9} y2={9} />
          <Path d="M5 9 A2 2 0 0 0 9 9" />
          <Path d="M16 3 C14 5 13.5 8 14 12 L16 12 V21" />
        </G>
      );
    case 'return-back':
      // Arrow turning down then back to the left — `return-down-back` in Ionicons.
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="5,6 5,14 18,14" />
          <Polyline points="14,10 18,14 14,18" />
        </G>
      );
    case 'ribbon':
      // Award ribbon — circle medallion with two tails below.
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
          <Circle cx={12} cy={9} r={5.5} />
          <Polyline points="8.5,13.5 6,21 10.5,18 12,21 13.5,18 18,21 15.5,13.5" />
        </G>
      );
    case 'school':
      // Graduation cap — mortarboard.
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
          <Polygon points="12,5 22,10 12,15 2,10" />
          <Path d="M6 12 V16 C6 17.5 9 18.5 12 18.5 C15 18.5 18 17.5 18 16 V12" />
          <Line x1={22} y1={10} x2={22} y2={15} strokeLinecap="round" />
        </G>
      );
    case 'sparkles':
      // Three star-bursts at 10/4/18 positions.
      return (
        <G fill="none" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 3 L13 8 L18 9 L13 10 L12 15 L11 10 L6 9 L11 8 Z" />
          <Path d="M5 15 L5.6 17 L7.5 17.5 L5.6 18 L5 20 L4.4 18 L2.5 17.5 L4.4 17 Z" />
          <Path d="M19 14 L19.6 16 L21.5 16.5 L19.6 17 L19 19 L18.4 17 L16.5 16.5 L18.4 16 Z" />
        </G>
      );
    case 'star':
      return (
        <Polygon
          points="12,2.5 14.6,9 21.5,9.5 16.2,13.8 18,20.5 12,16.8 6,20.5 7.8,13.8 2.5,9.5 9.4,9"
          fill={color}
        />
      );
    case 'star-half':
      // Half-filled star — outline all, fill left half.
      return (
        <G>
          <Polygon
            points="12,2.5 14.6,9 21.5,9.5 16.2,13.8 18,20.5 12,16.8 6,20.5 7.8,13.8 2.5,9.5 9.4,9"
            fill="none"
            stroke={color}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
          <Path
            d="M12 2.5 L9.4 9 L2.5 9.5 L7.8 13.8 L6 20.5 L12 16.8 Z"
            fill={color}
          />
        </G>
      );
    case 'stop-circle':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
          <Circle cx={12} cy={12} r={8.5} />
          <Rect x={8.5} y={8.5} width={7} height={7} rx={1} fill={color} stroke="none" />
        </G>
      );
    case 'swap-horizontal':
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="7,8 3.5,11.5 7,15" />
          <Line x1={3.5} y1={11.5} x2={20.5} y2={11.5} />
          <Polyline points="17,16 20.5,12.5 17,9" />
        </G>
      );
    case 'walk':
      // Walking figure — head + body + one arm + two legs mid-stride.
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={13} cy={4.5} r={2} fill={color} stroke="none" />
          <Polyline points="8,21 11,14 9,10 13,8 15,12 18,14" />
          <Polyline points="11,14 14,18 12,22" />
        </G>
      );
    case 'warning':
      // Triangle with exclamation mark.
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="12,3 21.5,20 2.5,20" />
          <Line x1={12} y1={10} x2={12} y2={14.5} />
          <Line x1={12} y1={17} x2={12} y2={17.5} />
        </G>
      );
    case 'chat':
      // Speech bubble with a tail at the bottom-left.
      return (
        <G fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round">
          <Path d="M4 5 H20 V16 H10 L5.5 20 V16 H4 Z" />
        </G>
      );
    case 'shield':
      return (
        <Path
          d="M12 3 L20 6 V12 C20 16.5 16.5 19.5 12 21 C7.5 19.5 4 16.5 4 12 V6 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      );
    default:
      return null;
  }
}
