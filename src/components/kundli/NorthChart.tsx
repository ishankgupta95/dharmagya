import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polygon, G, Text as SvgText, Line } from 'react-native-svg';

import type { ChartCell } from './chartCells';
import { palette } from '@/config/theme';
import { useStore } from '@/store/useStore';

/**
 * North Indian (diamond) kundli — houses are fixed; the lagna's rashi sits in
 * the top-center cell and rashis advance counter-clockwise. Cells contain
 * graha abbreviations + the rashi number.
 *
 * Geometry: outer square split by both diagonals + an inner diamond (sides
 * connecting the midpoints). Yields 4 inner kites (houses 1, 4, 7, 10) and
 * 8 corner triangles (the remaining 8 houses).
 */
interface NorthChartProps {
  /** 12 cells in rashi order (0..11). House numbering inside the cell. */
  cells: ChartCell[];
  /** Side length in pixels. Defaults to fill its container width. */
  size: number;
}

interface CellGeometry {
  house: number;
  /** Polygon points string for SVG <Polygon points="...">. */
  points: string;
  /** Centroid for label placement. */
  cx: number;
  cy: number;
  /** Sub-label position offset for the rashi number (small caption). */
  labelOffsetY: number;
}

/** Returns 12 polygons in *house* order (1..12) — caller maps cell rashis. */
function buildGeometry(s: number): CellGeometry[] {
  const m = s / 2;
  const q = s / 4;
  const tq = (3 * s) / 4;

  // Outer square corners + side midpoints + inner diamond corner midpoints.
  const TL = [0, 0];
  const TR = [s, 0];
  const BL = [0, s];
  const BR = [s, s];
  const T = [m, 0];
  const R = [s, m];
  const B = [m, s];
  const L = [0, m];
  const C = [m, m];
  const M_TL = [q, q];
  const M_TR = [tq, q];
  const M_BL = [q, tq];
  const M_BR = [tq, tq];

  const poly = (pts: number[][]): string => pts.map(([x, y]) => `${x},${y}`).join(' ');

  return [
    // House 1 (top kite)
    { house: 1, points: poly([T, M_TR, C, M_TL]), cx: m, cy: q, labelOffsetY: -8 },
    // House 2 (upper-left small triangle near top)
    { house: 2, points: poly([TL, T, M_TL]), cx: q, cy: s / 12, labelOffsetY: 8 },
    // House 3 (upper-left small triangle near left)
    { house: 3, points: poly([TL, M_TL, L]), cx: s / 12, cy: q, labelOffsetY: 0 },
    // House 4 (left kite)
    { house: 4, points: poly([L, M_TL, C, M_BL]), cx: q, cy: m, labelOffsetY: 0 },
    // House 5 (lower-left small triangle near left)
    { house: 5, points: poly([BL, L, M_BL]), cx: s / 12, cy: tq, labelOffsetY: 0 },
    // House 6 (lower-left small triangle near bottom)
    { house: 6, points: poly([BL, M_BL, B]), cx: q, cy: (11 * s) / 12, labelOffsetY: 0 },
    // House 7 (bottom kite)
    { house: 7, points: poly([B, M_BL, C, M_BR]), cx: m, cy: tq, labelOffsetY: 0 },
    // House 8 (lower-right small triangle near bottom)
    { house: 8, points: poly([BR, B, M_BR]), cx: tq, cy: (11 * s) / 12, labelOffsetY: 0 },
    // House 9 (lower-right small triangle near right)
    { house: 9, points: poly([BR, M_BR, R]), cx: (11 * s) / 12, cy: tq, labelOffsetY: 0 },
    // House 10 (right kite)
    { house: 10, points: poly([R, M_BR, C, M_TR]), cx: tq, cy: m, labelOffsetY: 0 },
    // House 11 (upper-right small triangle near right)
    { house: 11, points: poly([TR, R, M_TR]), cx: (11 * s) / 12, cy: q, labelOffsetY: 0 },
    // House 12 (upper-right small triangle near top)
    { house: 12, points: poly([TR, M_TR, T]), cx: tq, cy: s / 12, labelOffsetY: 8 },
  ];
}

export const NorthChart = memo(function NorthChart({ cells, size }: NorthChartProps) {
  const isDark = useStore((s) => s.isDarkMode);
  const stroke = isDark ? 'rgba(243,229,200,0.55)' : palette.ink;
  const accent = isDark ? palette.goldLeaf : palette.sindoor;
  const muted = isDark ? 'rgba(243,229,200,0.55)' : palette.inkQuiet;
  const text = isDark ? palette.boneWhite : palette.ink;
  const fill = 'transparent';

  const geom = buildGeometry(size);
  // Map house → cell.
  const byHouse = new Map<number, ChartCell>();
  for (const c of cells) byHouse.set(c.house, c);

  const planetFontSize = size * 0.05;
  const rashiFontSize = size * 0.045;

  return (
    <View>
      <Svg width={size} height={size}>
        {/* Outer square */}
        <Polygon points={`0,0 ${size},0 ${size},${size} 0,${size}`} fill={fill} stroke={stroke} strokeWidth={1.5} />

        {/* Both diagonals */}
        <Line x1={0} y1={0} x2={size} y2={size} stroke={stroke} strokeWidth={1} />
        <Line x1={size} y1={0} x2={0} y2={size} stroke={stroke} strokeWidth={1} />

        {/* Inner diamond */}
        <Polygon
          points={`${size / 2},0 ${size},${size / 2} ${size / 2},${size} 0,${size / 2}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
        />

        {/* Render each cell's content (no fill — we keep the lines as the only ornament) */}
        {geom.map((g) => {
          const cell = byHouse.get(g.house);
          if (!cell) return null;
          // Stack planet abbreviations vertically inside the cell.
          const planets = cell.planets;
          const lineH = planetFontSize * 1.15;
          const startY = g.cy - ((planets.length - 1) * lineH) / 2;
          return (
            <G key={g.house}>
              {planets.map((p, i) => (
                <SvgText
                  key={i}
                  x={g.cx}
                  y={startY + i * lineH}
                  fontSize={planetFontSize}
                  fontWeight="500"
                  fill={text}
                  textAnchor="middle">
                  {p}
                </SvgText>
              ))}
              {/* House number + rashi short label (lagna cell uses accent fill) */}
              <SvgText
                x={g.cx}
                y={g.cy + (planets.length === 0 ? rashiFontSize / 3 : (planets.length * lineH) / 2 + rashiFontSize)}
                fontSize={rashiFontSize}
                fill={cell.isLagna ? accent : muted}
                textAnchor="middle"
                fontStyle="italic">
                {`${cell.house} · ${cell.rashiName}`}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
});

export const _styles = StyleSheet.create({});
