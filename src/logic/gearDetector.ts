import { DEG, wrap180, wrap360 } from './geo';

export type Gear = 'P' | 'R' | 'N' | 'D';

export type GearInput = {
  /** GPS speed in m/s (negative or null when unknown). */
  speed: number | null;
  /** GPS direction of travel in degrees (negative or null when unknown). */
  course: number | null;
  /** Compass heading of the phone in degrees (negative or null when unknown). */
  compass: number | null;
  /** Timestamp in milliseconds. */
  t: number;
};

const STOP_SPEED = 0.4;
const MOVE_SPEED = 0.6;
const CALIBRATION_SPEED = 2;
const PARK_AFTER_MS = 3000;
const CALIBRATED_WEIGHT = 8;

/**
 * Works out whether the bike rolls forwards or backwards by comparing the
 * GPS direction of travel with the direction the phone points (compass).
 *
 * The phone can be mounted at any angle, so the offset between the two is
 * learned while riding forwards at a decent speed (the usual case). Once
 * learned, moving roughly opposite to the phone's forward direction means
 * reverse.
 */
export class GearDetector {
  private offX = 0;
  private offY = 0;
  private weight = 0;
  private stoppedSince: number | null = null;
  private reverseVotes = 0;
  gear: Gear = 'P';

  get calibrated(): boolean {
    return this.weight >= CALIBRATED_WEIGHT;
  }

  /** Learned angle between where the phone points and where the bike goes, in degrees. */
  get offset(): number {
    return wrap360(Math.atan2(this.offY, this.offX) / DEG);
  }

  /** Direction the bike's nose points, in degrees, or null when unknown. */
  forwardHeading(compass: number | null): number | null {
    if (compass === null || compass < 0) return null;
    return this.calibrated ? wrap360(compass + this.offset) : compass;
  }

  update({ speed, course, compass, t }: GearInput): Gear {
    const v = speed !== null && speed >= 0 ? speed : 0;

    if (v < STOP_SPEED) {
      if (this.stoppedSince === null) this.stoppedSince = t;
      if (t - this.stoppedSince >= PARK_AFTER_MS) {
        this.gear = 'P';
        this.reverseVotes = 0;
      }
      return this.gear;
    }
    this.stoppedSince = null;
    if (v < MOVE_SPEED) return this.gear;

    const hasCourse = course !== null && course >= 0;
    const hasCompass = compass !== null && compass >= 0;
    if (!hasCourse || !hasCompass) {
      if (this.gear === 'P') this.gear = 'D';
      return this.gear;
    }

    const diff = wrap180(course - compass);
    if (!this.calibrated) {
      if (v >= CALIBRATION_SPEED) this.learn(diff);
      this.gear = 'D';
      return this.gear;
    }

    const rel = Math.abs(wrap180(diff - this.offset));
    if (rel > 120) {
      this.reverseVotes = Math.min(this.reverseVotes + 1, 3);
    } else if (rel < 60) {
      this.reverseVotes = 0;
      if (v >= CALIBRATION_SPEED) this.learn(diff);
    }
    this.gear = this.reverseVotes >= 2 ? 'R' : 'D';
    return this.gear;
  }

  private learn(diffDeg: number) {
    // Exponentially weighted circular mean, so a remounted phone re-learns.
    const decay = 0.97;
    this.offX = this.offX * decay + Math.cos(diffDeg * DEG);
    this.offY = this.offY * decay + Math.sin(diffDeg * DEG);
    this.weight = Math.min(this.weight * decay + 1, 1 / (1 - decay));
  }
}
