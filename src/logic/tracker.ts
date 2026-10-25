export type ActorKind = 'person' | 'bicycle' | 'car' | 'motorcycle' | 'bus' | 'truck' | 'dog';

/** One object seen by the camera, in metres relative to the bike. */
export type Detection = {
  kind: ActorKind;
  /** Lateral offset, positive = to the right. */
  x: number;
  /** Distance ahead. */
  z: number;
  score: number;
};

export type Actor = Detection & { id: number; lastSeen: number };

const MATCH_RADIUS = 3;
const FORGET_MS = 700;
const SMOOTHING = 0.35;

/**
 * Gives detections a stable identity between frames (nearest neighbour of
 * the same kind) and smooths their positions, so the 3D scene can animate
 * them instead of teleporting.
 */
export class ActorTracker {
  private nextId = 1;
  actors: Actor[] = [];

  update(detections: Detection[], t: number): Actor[] {
    const free = new Set(this.actors);
    for (const d of detections) {
      let best: Actor | null = null;
      let bestDist = MATCH_RADIUS;
      for (const a of free) {
        if (a.kind !== d.kind) continue;
        const dist = Math.hypot(a.x - d.x, a.z - d.z);
        if (dist < bestDist) {
          best = a;
          bestDist = dist;
        }
      }
      if (best) {
        free.delete(best);
        best.x += SMOOTHING * (d.x - best.x);
        best.z += SMOOTHING * (d.z - best.z);
        best.score = d.score;
        best.lastSeen = t;
      } else {
        this.actors.push({ ...d, id: this.nextId++, lastSeen: t });
      }
    }
    this.actors = this.actors.filter((a) => t - a.lastSeen <= FORGET_MS);
    return this.actors;
  }

  clear() {
    this.actors = [];
  }
}
