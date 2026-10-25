import { ActorTracker } from '../tracker';

describe('ActorTracker', () => {
  it('keeps the same id for an object moving between frames', () => {
    const tr = new ActorTracker();
    const [a] = tr.update([{ kind: 'person', x: 1, z: 10, score: 0.9 }], 0);
    const [b] = tr.update([{ kind: 'person', x: 1.2, z: 9.5, score: 0.9 }], 100);
    expect(b.id).toBe(a.id);
    expect(b.z).toBeLessThan(10);
    expect(b.z).toBeGreaterThan(9.5);
  });

  it('does not mix up different kinds', () => {
    const tr = new ActorTracker();
    tr.update([{ kind: 'person', x: 0, z: 10, score: 0.9 }], 0);
    const actors = tr.update([{ kind: 'car', x: 0, z: 10, score: 0.9 }], 100);
    expect(new Set(actors.map((a) => a.id)).size).toBe(2);
  });

  it('forgets objects that disappear', () => {
    const tr = new ActorTracker();
    tr.update([{ kind: 'car', x: 0, z: 10, score: 0.9 }], 0);
    expect(tr.update([], 500)).toHaveLength(1);
    expect(tr.update([], 1000)).toHaveLength(0);
  });
});
