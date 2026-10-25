import * as THREE from 'three';

import type { ActorKind } from '../logic/tracker';

// Units are metres. The bike looks towards -Z, +Y is up, +X is the rider's right.

const WHEEL_RADIUS = 0.34;

function tube(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 8), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function wheel(tyre: THREE.Material, spokeMaterial: THREE.Material) {
  const group = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_RADIUS, 0.04, 10, 36), tyre);
  rim.rotation.y = Math.PI / 2;
  group.add(rim);
  // A few spokes make the spin visible.
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.012, WHEEL_RADIUS * 2, 0.025), spokeMaterial);
    spoke.rotation.x = (i * Math.PI) / 3;
    group.add(spoke);
  }
  return group;
}

export type BikeModel = {
  root: THREE.Group;
  /** Rotated around Y to steer. */
  steering: THREE.Group;
  wheels: THREE.Group[];
  indicators: { left: THREE.MeshBasicMaterial[]; right: THREE.MeshBasicMaterial[] };
  frameMaterial: THREE.MeshLambertMaterial;
  tyreMaterial: THREE.MeshLambertMaterial;
};

export const INDICATOR_ON = new THREE.Color('#ffb020');
export const INDICATOR_OFF = new THREE.Color('#5a4a30');

export function buildBike(frameColor: string, tyreColor: string, withIndicators = true): BikeModel {
  const frame = new THREE.MeshLambertMaterial({ color: frameColor });
  const tyre = new THREE.MeshLambertMaterial({ color: tyreColor });
  const root = new THREE.Group();

  const rearAxle = new THREE.Vector3(0, WHEEL_RADIUS, 0.52);
  const frontAxle = new THREE.Vector3(0, WHEEL_RADIUS, -0.52);
  const bottomBracket = new THREE.Vector3(0, 0.3, 0);
  const seatTop = new THREE.Vector3(0, 0.86, 0.13);
  const headTop = new THREE.Vector3(0, 0.88, -0.42);
  const headBottom = new THREE.Vector3(0, 0.7, -0.46);

  root.add(
    tube(bottomBracket, seatTop, 0.028, frame),
    tube(seatTop, headTop, 0.025, frame),
    tube(bottomBracket, headBottom, 0.032, frame),
    tube(rearAxle, bottomBracket, 0.018, frame),
    tube(rearAxle, seatTop, 0.016, frame),
    tube(headTop, headBottom, 0.034, frame),
  );

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.26), tyre);
  seat.position.set(0, 0.92, 0.15);
  root.add(seat);

  const rear = wheel(tyre, frame);
  rear.position.copy(rearAxle);
  root.add(rear);

  // Everything that turns with the handlebar pivots around the head tube.
  const steering = new THREE.Group();
  steering.position.set(0, 0, -0.46);
  const local = (v: THREE.Vector3) => v.clone().sub(steering.position);
  const front = wheel(tyre, frame);
  front.position.copy(local(frontAxle));
  steering.add(front, tube(local(headBottom), local(frontAxle), 0.02, frame));
  const barCenter = local(headTop).add(new THREE.Vector3(0, 0.07, 0.03));
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 8), tyre);
  bar.rotation.z = Math.PI / 2;
  bar.position.copy(barCenter);
  steering.add(bar, tube(local(headTop), barCenter, 0.02, frame));
  root.add(steering);

  const indicators = { left: [] as THREE.MeshBasicMaterial[], right: [] as THREE.MeshBasicMaterial[] };
  if (withIndicators) {
    for (const side of [-1, 1] as const) {
      const list = side < 0 ? indicators.left : indicators.right;
      const frontMat = new THREE.MeshBasicMaterial({ color: INDICATOR_OFF });
      const frontLight = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), frontMat);
      frontLight.position.copy(barCenter).add(new THREE.Vector3(side * 0.33, 0, 0));
      steering.add(frontLight);
      const rearMat = new THREE.MeshBasicMaterial({ color: INDICATOR_OFF });
      const rearLight = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), rearMat);
      rearLight.position.set(side * 0.11, 0.74, 0.5);
      root.add(rearLight);
      list.push(frontMat, rearMat);
    }
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.02),
      new THREE.MeshBasicMaterial({ color: '#ff2a2a' }),
    );
    tail.position.set(0, 0.74, 0.52);
    root.add(tail, tube(seatTop, new THREE.Vector3(0, 0.74, 0.5), 0.012, frame));
  }

  return { root, steering, wheels: [front, rear], indicators, frameMaterial: frame, tyreMaterial: tyre };
}

export function wheelSpin(speed: number, dt: number) {
  return (speed / WHEEL_RADIUS) * dt;
}

/** A simple low-poly figure for something detected around the bike. */
export function buildActor(kind: ActorKind, material: THREE.MeshLambertMaterial): THREE.Group {
  const g = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const person = (y: number, scale = 1) => {
    add(new THREE.CapsuleGeometry(0.2 * scale, 0.75 * scale, 4, 10), 0, y + 0.6 * scale, 0);
    add(new THREE.SphereGeometry(0.13 * scale, 14, 10), 0, y + 1.22 * scale, 0);
  };

  switch (kind) {
    case 'person':
      person(0.15);
      break;
    case 'bicycle':
    case 'motorcycle': {
      const bike = buildBike('#000', '#000', false).root;
      bike.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material = material;
      });
      if (kind === 'motorcycle') bike.scale.setScalar(1.25);
      g.add(bike);
      person(0.75, 0.9);
      break;
    }
    case 'car':
      add(new THREE.BoxGeometry(1.8, 0.7, 4.3), 0, 0.6, 0);
      add(new THREE.BoxGeometry(1.55, 0.55, 2.2), 0, 1.2, 0.25);
      for (const [x, z] of [[-0.85, -1.4], [0.85, -1.4], [-0.85, 1.4], [0.85, 1.4]]) {
        const w = add(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 14), x, 0.33, z);
        w.rotation.z = Math.PI / 2;
      }
      break;
    case 'bus':
    case 'truck':
      add(new THREE.BoxGeometry(2.5, kind === 'bus' ? 2.8 : 3, kind === 'bus' ? 10 : 8), 0, 1.75, 0);
      break;
    case 'dog':
      add(new THREE.BoxGeometry(0.25, 0.3, 0.7), 0, 0.4, 0);
      add(new THREE.BoxGeometry(0.2, 0.22, 0.25), 0, 0.62, -0.38);
      break;
  }
  return g;
}
