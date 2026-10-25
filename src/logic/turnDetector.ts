export type Turn = 'left' | 'right' | null;

export type MotionSample = {
  /** Rotation rate around the device X/Y/Z axes, in deg/s. */
  rx: number;
  ry: number;
  rz: number;
  /** Acceleration including gravity along X/Y/Z, in m/s² (gravity points down). */
  ax: number;
  ay: number;
  az: number;
  /** Timestamp in milliseconds. */
  t: number;
};

export type TurnConfig = {
  /** Yaw rate (deg/s) needed to switch the indicator on. */
  onDps: number;
  /** Yaw rate (deg/s) under which the indicator starts switching off. */
  offDps: number;
  /** How long the yaw rate must stay above `onDps` before indicating. */
  onMs: number;
  /** How long the yaw rate must stay below `offDps` before turning off. */
  offMs: number;
};

export const DEFAULT_TURN_CONFIG: TurnConfig = { onDps: 16, offDps: 6, onMs: 250, offMs: 700 };

/**
 * Detects left/right turns from the gyroscope, independently of how the
 * phone is mounted: the rotation rate is projected onto the "up" direction
 * (the opposite of a low-passed gravity vector), which gives the yaw rate
 * around the vertical axis. Positive yaw = counter-clockwise seen from above
 * = turning left.
 */
export class TurnDetector {
  private gravity: [number, number, number] | null = null;
  private yaw = 0;
  private candidate: Turn = null;
  private candidateSince = 0;
  private quietSince: number | null = null;
  turn: Turn = null;

  constructor(private config: TurnConfig = DEFAULT_TURN_CONFIG) {}

  /** Smoothed yaw rate in deg/s (positive = left). */
  get yawRate(): number {
    return this.yaw;
  }

  reset() {
    this.yaw = 0;
    this.turn = null;
    this.candidate = null;
    this.quietSince = null;
  }

  /** Feeds one sensor sample and returns the indicator state. */
  pushMotion(s: MotionSample, enabled = true): Turn {
    const k = 0.08;
    if (!this.gravity) this.gravity = [s.ax, s.ay, s.az];
    else {
      this.gravity[0] += k * (s.ax - this.gravity[0]);
      this.gravity[1] += k * (s.ay - this.gravity[1]);
      this.gravity[2] += k * (s.az - this.gravity[2]);
    }
    const [gx, gy, gz] = this.gravity;
    const norm = Math.hypot(gx, gy, gz) || 1;
    const rawYaw = -(s.rx * gx + s.ry * gy + s.rz * gz) / norm;
    return this.pushYawRate(rawYaw, s.t, enabled);
  }

  /** Feeds a yaw rate (deg/s, positive = left) directly. */
  pushYawRate(rawYaw: number, t: number, enabled = true): Turn {
    this.yaw += 0.3 * (rawYaw - this.yaw);
    if (!enabled) {
      this.turn = null;
      this.candidate = null;
      this.quietSince = null;
      return this.turn;
    }
    const { onDps, offDps, onMs, offMs } = this.config;
    const dir: Turn = this.yaw > onDps ? 'left' : this.yaw < -onDps ? 'right' : null;

    if (this.turn === null) {
      if (dir === null) {
        this.candidate = null;
      } else if (dir !== this.candidate) {
        this.candidate = dir;
        this.candidateSince = t;
      } else if (t - this.candidateSince >= onMs) {
        this.turn = dir;
        this.candidate = null;
        this.quietSince = null;
      }
      return this.turn;
    }

    const signedYaw = this.turn === 'left' ? this.yaw : -this.yaw;
    if (signedYaw < offDps) {
      if (this.quietSince === null) this.quietSince = t;
      else if (t - this.quietSince >= offMs) {
        this.turn = null;
        this.quietSince = null;
      }
    } else {
      this.quietSince = null;
    }
    return this.turn;
  }
}
