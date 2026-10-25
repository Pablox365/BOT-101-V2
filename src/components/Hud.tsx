import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Gear } from '../logic/gearDetector';
import type { Turn } from '../logic/turnDetector';
import type { Palette } from '../theme';

const GEARS: Gear[] = ['P', 'R', 'N', 'D'];

function useBlink(active: boolean, periodMs = 340) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), periodMs);
    return () => clearInterval(id);
  }, [active, periodMs]);
  return active && tick % 2 === 0;
}

function Blinker({ side, active, palette }: { side: 'left' | 'right'; active: boolean; palette: Palette }) {
  const on = useBlink(active);
  return (
    <Text
      style={[
        styles.blinker,
        { color: on ? palette.blinker : palette.chip, textShadowColor: on ? palette.blinker : 'transparent' },
      ]}
    >
      {side === 'left' ? '◀' : '▶'}
    </Text>
  );
}

type Props = { speedKmh: number; gear: Gear; turn: Turn; palette: Palette };

/** Top of the screen, like a Tesla: indicators, gear selector and big speed. */
export function Hud({ speedKmh, gear, turn, palette }: Props) {
  return (
    <View style={styles.row} pointerEvents="none">
      <Blinker side="left" active={turn === 'left'} palette={palette} />
      <View style={styles.center}>
        <View style={styles.gears}>
          {GEARS.map((g) => (
            <Text
              key={g}
              style={[
                styles.gear,
                { color: g === gear ? (g === 'R' ? palette.danger : palette.text) : palette.textDim },
                g === gear && styles.gearActive,
              ]}
            >
              {g}
            </Text>
          ))}
        </View>
        <Text style={[styles.speed, { color: palette.text }]}>{Math.round(speedKmh)}</Text>
        <Text style={[styles.unit, { color: palette.textDim }]}>KM/H</Text>
      </View>
      <Blinker side="right" active={turn === 'right'} palette={palette} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  center: { alignItems: 'center', minWidth: 120 },
  gears: { flexDirection: 'row', gap: 12 },
  gear: { fontSize: 15, fontWeight: '500' },
  gearActive: { fontWeight: '800' },
  speed: { fontSize: 64, fontWeight: '600', lineHeight: 68, fontVariant: ['tabular-nums'], letterSpacing: -2 },
  unit: { fontSize: 12, fontWeight: '600', letterSpacing: 1.5, marginTop: -4 },
  blinker: { fontSize: 34, textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
});
