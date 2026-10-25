import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { LatLon } from '../logic/geo';
import type { Palette } from '../theme';

export type MapStyle = 'standard' | 'satellite';

type Props = {
  position: LatLon | null;
  heading: number | null;
  speed: number;
  trail: LatLon[];
  mapStyle: MapStyle;
  dark: boolean;
  palette: Palette;
};

/** Apple Maps in 3D, following the bike with the map turned to the direction of travel. */
export function MapPanel({ position, heading, speed, trail, mapStyle, dark, palette }: Props) {
  const map = useRef<MapView>(null);

  useEffect(() => {
    if (!position) return;
    // Zoom out a little as speed goes up, like car navigation does.
    const altitude = 220 + Math.min(speed, 12) * 18;
    map.current?.animateCamera(
      { center: position, heading: heading ?? 0, pitch: 62, altitude, zoom: 18.5 - Math.min(speed, 12) * 0.06 },
      { duration: 650 },
    );
  }, [position, heading, speed]);

  return (
    <View style={styles.fill}>
      <MapView
        ref={map}
        style={styles.fill}
        initialCamera={{
          center: position ?? { latitude: 40.41689, longitude: -3.70354 },
          heading: heading ?? 0,
          pitch: 62,
          altitude: 260,
          zoom: 18,
        }}
        mapType={mapStyle === 'satellite' ? 'hybridFlyover' : 'standard'}
        userInterfaceStyle={dark ? 'dark' : 'light'}
        showsBuildings
        showsPointsOfInterests={false}
        showsCompass={false}
        showsScale={false}
        showsUserLocation={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        toolbarEnabled={false}
      >
        {trail.length > 1 && <Polyline coordinates={trail} strokeColor={palette.accent} strokeWidth={6} />}
        {position && (
          <Marker coordinate={position} anchor={{ x: 0.5, y: 0.5 }} flat tracksViewChanges={false}>
            <View style={[styles.puck, { borderColor: '#fff', backgroundColor: palette.accent }]}>
              <View style={styles.chevron} />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  puck: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  // The map is turned to the direction of travel, so "ahead" is always up.
  chevron: {
    width: 0,
    height: 0,
    marginTop: -3,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
  },
});
