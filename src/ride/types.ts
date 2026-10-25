import type { Gear } from '../logic/gearDetector';
import type { LatLon } from '../logic/geo';
import type { Turn } from '../logic/turnDetector';

export type GpsStatus = 'waiting' | 'ok' | 'denied' | 'demo';

export type RideState = {
  /** Speed in m/s, always >= 0 (direction is given by `gear`). */
  speed: number;
  gear: Gear;
  turn: Turn;
  /** Yaw rate in deg/s, positive = turning left. */
  yawRate: number;
  /** Bike lean in radians, positive = leaning left. */
  lean: number;
  /** Direction the bike points, in degrees from north (null until known). */
  heading: number | null;
  position: LatLon | null;
  /** GPS accuracy radius in metres. */
  accuracy: number | null;
  trail: LatLon[];
  /** Trip distance in metres. */
  distance: number;
  gps: GpsStatus;
};

export const INITIAL_RIDE: RideState = {
  speed: 0,
  gear: 'P',
  turn: null,
  yawRate: 0,
  lean: 0,
  heading: null,
  position: null,
  accuracy: null,
  trail: [],
  distance: 0,
  gps: 'waiting',
};
