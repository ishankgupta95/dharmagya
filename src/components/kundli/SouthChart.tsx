import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Rect, G, Text as SvgText, Line } from 'react-native-svg';

import type { ChartCell } from './chartCells';
import { palette } from '@/config/theme';
import { useStore } from '@/store/useStore';

/**
 * South Indian (square) kundli — rashis are FIXED in the perimeter cells of a
 * 4×4 grid (top-left = Meena, advancing clockwise). The lagna's cell is
 * marked; houses are derived by counting clockwise from the lagna.
 *
 * Layout:
 * ```
 *   Meena   Mesha    Vrishabha  Mithuna
 *   Kumbha   ┌──────────────┐   Karka
 *   Makara   │   (center)   │   Simha
 *   Dhanu    └──────────────┘   Kanya
 *   Vrischika  Tula   ...      Tula -> wait
 * ```
 * (Bottom row right-to-left: Kanya, Tula, Vrischika, Dhanu.)
 */
interface SouthChartProps {
  cells: ChartCell[];
  size: number;
  /** Optional center caption (e.g. user name + lagna rashi). */
  centerCaption?: string;
}

const RASHI_TO_GRID: { rashi: number; col: number; row: number }[] = [
  { rashi: 0, col: 1, row: 0 },  // Mesha
  { rashi: 1, col: 2, row: 0 },  // Vrishabha
  { rashi: 2, col: 3, row: 0 },  // Mithuna
  { rashi: 3, col: 3, row: 1 },  // Karka
  { rashi: 4, col: 3, row: 2 },  // Simha
  { rashi: 5, col: 3, row: 3 },  // Kanya
  { rashi: 6, col: 2, row: 3 },  // Tula
  { rashi: 7, col: 1, row: 3 },  // Vrischika
  { rashi: 8, col: 0, row: 3 },  // Dhanu
  { rashi: 9, col: 0, row: 2 },  // Makara
  { rashi: 10, col: 0, row: 1 }, // Kumbha
  { rashi: 11, col: 0, row: 0 }, // Meena
];

export const SouthChart = memo(function SouthChart({ cells, size, centerCaption }: SouthChartProps) {
  const isDark = useStore((s) => s.isDarkMode);
  const stroke = isDark ? 'rgba(243,229,200,0.55)' : palette.ink;
  const accent = isDark ? palette.goldLeaf : palette.sindoor;
  const muted = isDark ? 'rgba(243,229,200,0.55)' : palette.inkQuiet;
  const text = isDark ? palette.boneWhite : palette.ink;
  const accentSoft = isDark ? 'rgba(201,155,58,0.10)' : 'rgba(165,48,28,0.06)';

  const cellSize = size / 4;
  const planetFontSize = cellSize * 0.18;
  const rashiFontSize = cellSize * 0.16;

  const byRashi = new Map<number, ChartCell>();
  for (const c of cells) byRashi.set(c.rashi, c);

  return (
    <View>
      <Svg width={size} height={size}>
        {/* Outer square + grid lines */}
        <Rect x={0} y={0} width={size} height={size} fill="transparent" stroke={stroke} strokeWidth={1.5} />
        {[1, 2, 3].map((i) => (
          <G key={`h${i}`}>
            <Line x1={0} y1={i * cellSize} x2={size} y2={i * cellSize} stroke={stroke} strokeWidth={0.5} />
            <Line x1={i * cellSize} y1={0} x2={i * cellSize} y2={size} stroke={stroke} strokeWidth={0.5} />
          </G>
        ))}
        {/* Hide the inner 2x2 grid lines — center is one big hollow */}
        <Rect
          x={cellSize}
          y={cellSize}
          width={cellSize * 2}
          height={cellSize * 2}
          fill={isDark ? palette.nightPlinthDeep : palette.parchment}
          stroke={stroke}
          strokeWidth={1}
        />

        {/* Cells */}
        {RASHI_TO_GRID.map(({ rashi, col, row }) => {
          const cell = byRashi.get(rashi);
          if (!cell) return null;
          const x = col * cellSize;
          const y = row * cellSize;
          const cx = x + cellSize / 2;
          const cy = y + cellSize / 2;

          const planets = cell.planets;
          const lineH = planetFontSize * 1.15;
          const startY = cy - ((planets.length - 1) * lineH) / 2;

          return (
            <G key={rashi}>
              {/* Lagna highlight — soft tint, no stroke change */}
              {cell.isLagna && (
                <Rect x={x} y={y} width={cellSize} height={cellSize} fill={accentSoft} />
              )}

              {/* Rashi short name in top-left of the cell */}
              <SvgText
                x={x + 6}
                y={y + rashiFontSize + 2}
                fontSize={rashiFontSize}
                fill={cell.isLagna ? accent : muted}
                fontStyle="italic">
                {cell.isLagna ? `Asc · ${cell.rashiName}` : cell.rashiName}
              </SvgText>

              {/* Planets stacked at the cell center */}
              {planets.map((p, i) => (
                <SvgText
                  key={i}
                  x={cx}
                  y={startY + i * lineH + planetFontSize * 0.35}
                  fontSize={planetFontSize}
                  fontWeight="500"
                  fill={text}
                  textAnchor="middle">
                  {p}
                </SvgText>
              ))}
            </G>
          );
        })}

        {/* Center caption */}
        {centerCaption && (
          <SvgText
            x={size / 2}
            y={size / 2 + planetFontSize * 0.35}
            fontSize={cellSize * 0.16}
            fill={muted}
            textAnchor="middle"
            fontStyle="italic">
            {centerCaption}
          </SvgText>
        )}
      </Svg>
    </View>
  );
});
