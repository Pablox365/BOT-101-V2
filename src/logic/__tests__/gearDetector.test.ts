import { GearDetector } from '../gearDetector';
import { wrap360 } from '../geo';

/** Phone mounted so its compass reads 90° off from where the bike points. */
const MOUNT_OFFSET = 90;

function ride(g: GearDetector, opts: { course: number; speed: number; reverse?: boolean; seconds: number; t0: number }) {
  let t = opts.t0;
  const bikeNose = opts.reverse ? wrap360(opts.course + 180) : opts.course;
  for (let i = 0; i < opts.seconds; i++, t += 1000) {
    g.update({ speed: opts.speed, course: opts.course, compass: wrap360(bikeNose - MOUNT_OFFSET), t });
  }
  return t;
}

describe('GearDetector', () => {
  it('starts parked and drives forward', () => {
    const g = new GearDetector();
    expect(g.gear).toBe('P');
    ride(g, { course: 10, speed: 5, seconds: 3, t0: 0 });
    expect(g.gear).toBe('D');
  });

  it('learns the mounting offset while riding forward', () => {
    const g = new GearDetector();
    ride(g, { course: 200, speed: 5, seconds: 15, t0: 0 });
    expect(g.calibrated).toBe(true);
    expect(g.offset).toBeCloseTo(MOUNT_OFFSET, 0);
    expect(g.forwardHeading(110)).toBeCloseTo(200, 0);
  });

  it('detects rolling backwards once calibrated', () => {
    const g = new GearDetector();
    let t = ride(g, { course: 45, speed: 5, seconds: 15, t0: 0 });
    t = ride(g, { course: 300, speed: 1, reverse: true, seconds: 3, t0: t });
    expect(g.gear).toBe('R');
    ride(g, { course: 300, speed: 3, seconds: 2, t0: t });
    expect(g.gear).toBe('D');
  });

  it('needs two readings in a row before showing reverse', () => {
    const g = new GearDetector();
    const t = ride(g, { course: 45, speed: 5, seconds: 15, t0: 0 });
    ride(g, { course: 300, speed: 1, reverse: true, seconds: 1, t0: t });
    expect(g.gear).toBe('D');
  });

  it('parks after standing still for a few seconds', () => {
    const g = new GearDetector();
    let t = ride(g, { course: 45, speed: 5, seconds: 5, t0: 0 });
    t = ride(g, { course: 45, speed: 0, seconds: 2, t0: t });
    expect(g.gear).toBe('D');
    ride(g, { course: 45, speed: 0, seconds: 3, t0: t });
    expect(g.gear).toBe('P');
  });

  it('assumes forward without a compass', () => {
    const g = new GearDetector();
    g.update({ speed: 4, course: 10, compass: -1, t: 0 });
    expect(g.gear).toBe('D');
  });
});
