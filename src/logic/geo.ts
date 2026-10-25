export const DEG = Math.PI / 180;
export const G = 9.80665;

/** Wraps an angle in degrees to the range (-180, 180]. */
export function wrap180(deg: number): number {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

/** Wraps an angle in degrees to the range [0, 360). */
export function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export type LatLon = { latitude: number; longitude: number };

const EARTH_RADIUS = 6371000;

/** Point reached after travelling `distance` metres from `from` towards `bearingDeg`. */
export function destination(from: LatLon, bearingDeg: number, distance: number): LatLon {
  const d = distance / EARTH_RADIUS;
  const b = bearingDeg * DEG;
  const lat1 = from.latitude * DEG;
  const lon1 = from.longitude * DEG;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lon2 =
    lon1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: lat2 / DEG, longitude: lon2 / DEG };
}

/** Great-circle distance in metres. */
export function distance(a: LatLon, b: LatLon): number {
  const dLat = (b.latitude - a.latitude) * DEG;
  const dLon = (b.longitude - a.longitude) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * DEG) * Math.cos(b.latitude * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

/**
 * Lean angle (radians, positive = leaning left) a bike needs to hold a turn
 * at `speed` m/s with a yaw rate of `yawRateDps` deg/s (positive = left).
 */
export function leanForTurn(speed: number, yawRateDps: number): number {
  const lean = Math.atan((speed * yawRateDps * DEG) / G);
  const max = 40 * DEG;
  return Math.max(-max, Math.min(max, lean));
}
