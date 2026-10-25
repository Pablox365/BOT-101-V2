import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Hud } from './src/components/Hud';
import { MapPanel, type MapStyle } from './src/components/MapPanel';
import { Scene3D } from './src/components/Scene3D';
import { VisionCamera, type VisionStatus } from './src/components/VisionCamera';
import { useRide } from './src/ride/useRide';
import { DARK, LIGHT, type Palette } from './src/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <Dashboard />
    </SafeAreaProvider>
  );
}

function Dashboard() {
  useKeepAwake();
  const dark = useColorScheme() === 'dark';
  const palette = dark ? DARK : LIGHT;
  const [demo, setDemo] = useState(false);
  const [camera, setCamera] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('standard');
  const [vision, setVision] = useState<VisionStatus>({ state: 'off' });
  const ride = useRide(demo);
  const { state } = ride;

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, []);

  // A light tap on the hand when an indicator comes on.
  const lastTurn = useRef(state.turn);
  useEffect(() => {
    if (state.turn && state.turn !== lastTurn.current) Haptics.selectionAsync().catch(() => {});
    lastTurn.current = state.turn;
  }, [state.turn]);

  const toggleCamera = () => {
    const next = !camera;
    setCamera(next);
    setVision({ state: next ? 'loading' : 'off' });
    if (!next) ride.actors.current = [];
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['left', 'right', 'bottom']}>
      <StatusBar hidden />
      <View style={[styles.panel, styles.scenePanel, { backgroundColor: palette.sky }]}>
        <Scene3D live={ride.live} actors={ride.actors} palette={palette} />
        <Hud speedKmh={state.speed * 3.6} gear={state.gear} turn={state.turn} palette={palette} />
        <View style={styles.bottomBar}>
          <Chip palette={palette} label={gpsLabel(state.gps, state.accuracy)} />
          <Chip palette={palette} label={`${(state.distance / 1000).toFixed(2)} km`} />
          <View style={styles.spacer} />
          <Chip palette={palette} label="Demo" active={demo} onPress={() => setDemo((d) => !d)} />
          <Chip palette={palette} label={cameraLabel(camera, vision)} active={camera} onPress={toggleCamera} />
        </View>
      </View>

      <View style={[styles.panel, styles.mapPanel, { backgroundColor: palette.panel }]}>
        <MapPanel
          position={state.position}
          heading={state.heading}
          speed={state.speed}
          trail={state.trail}
          mapStyle={mapStyle}
          dark={dark}
          palette={palette}
        />
        <View style={styles.mapControls}>
          <Chip
            palette={palette}
            solid
            label={mapStyle === 'standard' ? '3D' : 'Satélite'}
            onPress={() => setMapStyle((s) => (s === 'standard' ? 'satellite' : 'standard'))}
          />
        </View>
        {camera && (
          <View style={[styles.pip, { borderColor: palette.panel }]}>
            <VisionCamera onDetections={ride.onDetections} onStatus={setVision} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function gpsLabel(gps: string, accuracy: number | null) {
  if (gps === 'demo') return 'GPS simulado';
  if (gps === 'denied') return 'Sin permiso de ubicación';
  if (gps === 'waiting') return 'Buscando GPS…';
  return `GPS ±${Math.round(accuracy ?? 0)} m`;
}

function cameraLabel(on: boolean, vision: VisionStatus) {
  if (!on) return 'Cámara';
  if (vision.state === 'loading') return 'Cargando IA…';
  if (vision.state === 'error') return 'Error cámara';
  return vision.fps ? `Cámara · ${vision.fps} fps` : 'Cámara';
}

type ChipProps = { label: string; palette: Palette; active?: boolean; solid?: boolean; onPress?: () => void };

function Chip({ label, palette, active, solid, onPress }: ChipProps) {
  const background = active ? palette.accent : solid ? palette.panel : palette.chip;
  return (
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={8}>
      <View style={[styles.chip, { backgroundColor: background }, solid && styles.chipShadow]}>
        <Text style={[styles.chipText, { color: active ? '#fff' : palette.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', padding: 8, gap: 8 },
  panel: { borderRadius: 18, overflow: 'hidden' },
  scenePanel: { flex: 1.15 },
  mapPanel: { flex: 1 },
  bottomBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spacer: { flex: 1 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  chipShadow: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  chipText: { fontSize: 12, fontWeight: '600' },
  mapControls: { position: 'absolute', top: 10, right: 10 },
  pip: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    width: 168,
    height: 95,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
});
