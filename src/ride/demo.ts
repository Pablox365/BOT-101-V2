import { destination, leanForTurn, wrap360, type LatLon } from '../logic/geo';
import type { Detection } from '../logic/tracker';
import { TurnDetector } from '../logic/turnDetector';
import { INITIAL_RIDE, type RideState } from './types';

/** Puerta del Sol, Madrid — used when there is no GPS fix yet. */
export const DEMO_START: LatLon = { latitude: 40.41689, longitude: -3.70354 };

type Segment = { until: number; speed: number; yaw: number; reverse?: boolean };

// A scripted 60 s loop: ride, turn left, turn right, stop, roll back, ride on.
const SCRIPT: Segment[] = [
  { until: 8, speed: 6, yaw: 0 },
  { until: 12, speed: 5, yaw: 30 },
  { until: 20, speed: 7, yaw: 0 },
  { until: 24, speed: 5, yaw: -32 },
  { until: 30, speed: 0, yaw: 0 },
  { until: 34, speed: 0, yaw: 0 },
  { until: 39, speed: 1, yaw: 0, reverse: true },
  { until: 42, speed: 0, yaw: 0 },
  { until: 60, speed: 6, yaw: 0 },
];
const LOOP_S = SCRIPT[SCRIPT.length - 1].until;

type DemoActor = Detection & { vz: number };

function spawnActors(): DemoActor[] {
  return [
    { kind: 'person', x: 3.2, z: 18, score: 1, vz: 0 },
    { kind: 'person', x: 3.6, z: 32, score: 1, vz: 0 },
    { kind: 'car', x: -2.6, z: 26, score: 1, vz: 4 },
    { kind: 'bicycle', x: 1.1, z: 12, score: 1, vz: 4.5 },
    { kind: 'car', x: -6, z: 45, score: 1, vz: -6 },
  ];
}

/** Simulated ride so the dashboard can be tried without leaving the sofa. */
export class DemoRide {
  private t = 0;
  private clock = 0;
  private stoppedFor = 0;
  private turns = new TurnDetector();
  private actors = spawnActors();
  private lastTrailPoint: LatLon;
  state: RideState;

  constructor(start: LatLon | null, heading: number | null) {
    const position = start ?? DEMO_START;
    this.lastTrailPoint = position;
    this.state = { ...INITIAL_RIDE, position, heading: heading ?? 0, trail: [position], gps: 'demo', accuracy: 5 };
  }

  /** Advances the simulation by `dt` seconds. */
  step(dt: number): RideState {
    this.t = (this.t + dt) % LOOP_S;
    const seg = SCRIPT.find((s) => this.t < s.until) ?? SCRIPT[0];
    const s = this.state;

    const speed = s.speed + (seg.speed - s.speed) * Math.min(1, dt * 1.2);
    const yaw = seg.yaw * Math.min(1, speed / 3);
    const heading = wrap360((s.heading ?? 0) - yaw * dt);
    const travel = speed * dt;
    const direction = seg.reverse ? wrap360(heading + 180) : heading;
    const position = s.position ? destination(s.position, direction, travel) : DEMO_START;

    this.clock += dt;
    const turn = this.turns.pushYawRate(yaw, this.clock * 1000, speed > 1);
    this.stoppedFor = speed < 0.3 ? this.stoppedFor + dt : 0;
    const gear = seg.reverse ? 'R' : this.stoppedFor > 3 ? 'P' : speed < 0.3 ? s.gear : 'D';

    let trail = s.trail;
    if (Math.hypot(position.latitude - this.lastTrailPoint.latitude, position.longitude - this.lastTrailPoint.longitude) > 2e-5) {
      trail = [...trail.slice(-400), position];
      this.lastTrailPoint = position;
    }

    this.state = {
      ...s,
      speed,
      gear,
      turn,
      yawRate: this.turns.yawRate,
      lean: leanForTurn(speed, this.turns.yawRate),
      heading,
      position,
      trail,
      distance: s.distance + travel,
    };
    return this.state;
  }

  /** Simulated camera detections around the bike. */
  detections(dt: number): Detection[] {
    const v = this.state.gear === 'R' ? -this.state.speed : this.state.speed;
    for (const a of this.actors) {
      a.z += (a.vz - v) * dt;
      if (a.z < -4 || a.z > 60) {
        a.z = a.z < -4 ? 40 + Math.random() * 15 : 2;
        if (a.kind === 'person') a.x = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random());
      }
    }
    return this.actors.filter((a) => a.z > 1.5).map(({ vz: _vz, ...d }) => d);
  }
}
