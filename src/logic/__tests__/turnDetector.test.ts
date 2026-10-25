import { TurnDetector, type MotionSample } from '../turnDetector';

const DT = 20;

/** Phone upright in landscape on the handlebar: gravity along the device -X axis. */
function uprightLandscape(yawLeftDps: number, t: number): MotionSample {
  // Up is +X, so a left (counter-clockwise from above) turn is a positive rotation around X.
  return { rx: yawLeftDps, ry: 0, rz: 0, ax: -9.81, ay: 0, az: 0, t };
}

/** Phone lying flat, screen up: gravity along the device -Z axis. */
function flat(yawLeftDps: number, t: number): MotionSample {
  return { rx: 0, ry: 0, rz: yawLeftDps, ax: 0, ay: 0, az: -9.81, t };
}

function run(d: TurnDetector, sample: (yaw: number, t: number) => MotionSample, yaw: number, ms: number, t0: number) {
  let t = t0;
  for (; t < t0 + ms; t += DT) d.pushMotion(sample(yaw, t));
  return t;
}

describe('TurnDetector', () => {
  it('indicates left on a sustained counter-clockwise turn', () => {
    const d = new TurnDetector();
    run(d, uprightLandscape, 30, 600, 0);
    expect(d.turn).toBe('left');
    expect(d.yawRate).toBeGreaterThan(25);
  });

  it('indicates right on a clockwise turn, whatever the mounting', () => {
    const d = new TurnDetector();
    run(d, flat, -30, 600, 0);
    expect(d.turn).toBe('right');
  });

  it('ignores short wobbles', () => {
    const d = new TurnDetector();
    let t = run(d, uprightLandscape, 40, 120, 0);
    t = run(d, uprightLandscape, -40, 120, t);
    run(d, uprightLandscape, 0, 400, t);
    expect(d.turn).toBeNull();
  });

  it('ignores rotation around a horizontal axis (bumps, pitching)', () => {
    const d = new TurnDetector();
    const pitch = (_: number, t: number): MotionSample => ({ rx: 0, ry: 0, rz: 60, ax: -9.81, ay: 0, az: 0, t });
    run(d, pitch, 0, 1000, 0);
    expect(d.turn).toBeNull();
  });

  it('switches off after the turn ends', () => {
    const d = new TurnDetector();
    let t = run(d, uprightLandscape, 30, 600, 0);
    expect(d.turn).toBe('left');
    t = run(d, uprightLandscape, 0, 300, t);
    expect(d.turn).toBe('left');
    run(d, uprightLandscape, 0, 1000, t);
    expect(d.turn).toBeNull();
  });

  it('stays off while disabled (e.g. standing still)', () => {
    const d = new TurnDetector();
    for (let t = 0; t < 1000; t += DT) d.pushMotion(uprightLandscape(40, t), false);
    expect(d.turn).toBeNull();
  });
});
