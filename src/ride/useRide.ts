import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { GearDetector } from '../logic/gearDetector';
import { distance, leanForTurn, type LatLon } from '../logic/geo';
import { ActorTracker, type Actor, type Detection } from '../logic/tracker';
import { TurnDetector } from '../logic/turnDetector';
import { DemoRide } from './demo';
import { INITIAL_RIDE, type RideState } from './types';

/** Minimum speed (m/s) for the indicators to react, so wiggling the bars while stopped does nothing. */
const TURN_MIN_SPEED = 1.2;
const UI_REFRESH_MS = 100;

export type Ride = {
  /** Throttled copy of the ride state, for React-rendered UI. */
  state: RideState;
  /** Always up-to-date state, for the 60 fps 3D scene. */
  live: RefObject<RideState>;
  /** Objects around the bike (camera detections, or simulated in demo mode). */
  actors: RefObject<Actor[]>;
  /** Feeds detections coming from the camera. */
  onDetections: (items: Detection[]) => void;
};

export function useRide(demo: boolean): Ride {
  const live = useRef<RideState>({ ...INITIAL_RIDE });
  const actors = useRef<Actor[]>([]);
  const tracker = useRef(new ActorTracker());
  const demoRef = useRef(demo);
  const [state, setState] = useState<RideState>(INITIAL_RIDE);

  // Push the live state to React a few times per second.
  useEffect(() => {
    const id = setInterval(() => setState(live.current), UI_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    demoRef.current = demo;
    tracker.current.clear();
    actors.current = [];
    return demo ? runDemo(live, actors, tracker.current) : runSensors(live);
  }, [demo]);

  const onDetections = useCallback((items: Detection[]) => {
    if (demoRef.current) return;
    actors.current = [...tracker.current.update(items, Date.now())];
  }, []);

  return { state, live, actors, onDetections };
}

function runDemo(live: RefObject<RideState>, actors: RefObject<Actor[]>, tracker: ActorTracker) {
  const sim = new DemoRide(live.current.position, live.current.heading);
  let last = Date.now();
  const id = setInterval(() => {
    const now = Date.now();
    const dt = Math.min((now - last) / 1000, 0.2);
    last = now;
    live.current = sim.step(dt);
    actors.current = [...tracker.update(sim.detections(dt), now)];
  }, 33);
  return () => {
    clearInterval(id);
    live.current = { ...live.current, speed: 0, turn: null, yawRate: 0, lean: 0, gps: 'waiting' };
  };
}

function runSensors(live: RefObject<RideState>) {
  const gears = new GearDetector();
  const turns = new TurnDetector();
  let compass: number | null = null;
  let course: number | null = null;
  let lastFix: LatLon | null = null;
  let cancelled = false;
  const subs: { remove(): void }[] = [];

  const update = (patch: Partial<RideState>) => {
    live.current = { ...live.current, ...patch };
  };

  const pickHeading = () => {
    const s = live.current;
    if (s.gear === 'D' && course !== null && course >= 0 && s.speed > 1.5) return course;
    return gears.forwardHeading(compass) ?? s.heading;
  };

  (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (cancelled) return;
    if (status !== 'granted') {
      update({ gps: 'denied' });
      return;
    }

    subs.push(
      await Location.watchHeadingAsync((h) => {
        compass = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        update({ heading: pickHeading() });
      }),
    );

    subs.push(
      await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 500, distanceInterval: 0 },
        (loc) => {
          const { latitude, longitude, speed, heading, accuracy } = loc.coords;
          const position = { latitude, longitude };
          const v = speed !== null && speed > 0 ? speed : 0;
          course = heading;
          const gear = gears.update({ speed: v, course: heading, compass, t: loc.timestamp });

          const s = live.current;
          let { trail, distance: trip } = s;
          if (lastFix && v > 0.5 && (accuracy ?? 99) < 25) trip += distance(lastFix, position);
          if (!lastFix || distance(lastFix, position) > 3) {
            trail = [...trail.slice(-400), position];
            lastFix = position;
          }
          update({ speed: v, gear, position, accuracy, trail, distance: trip, gps: 'ok' });
          update({ heading: pickHeading() });
        },
      ),
    );
    if (cancelled) subs.forEach((s) => s.remove());
  })().catch(() => update({ gps: 'denied' }));

  (async () => {
    const { granted } = await DeviceMotion.requestPermissionsAsync();
    if (!granted || cancelled) return;
    DeviceMotion.setUpdateInterval(20);
    subs.push(
      DeviceMotion.addListener((m) => {
        if (!m.rotationRate || !m.accelerationIncludingGravity) return;
        const g = m.accelerationIncludingGravity;
        // On iOS expo-sensors reports rotationRate.alpha/beta/gamma as the rotation around Z/Y/X.
        const turn = turns.pushMotion(
          { rx: m.rotationRate.gamma, ry: m.rotationRate.beta, rz: m.rotationRate.alpha, ax: g.x, ay: g.y, az: g.z, t: Date.now() },
          live.current.speed >= TURN_MIN_SPEED,
        );
        update({ turn, yawRate: turns.yawRate, lean: leanForTurn(live.current.speed, turns.yawRate) });
      }),
    );
    if (cancelled) subs.forEach((s) => s.remove());
  })().catch(() => {});

  return () => {
    cancelled = true;
    subs.forEach((s) => s.remove());
  };
}
