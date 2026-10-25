import * as THREE from 'three';

import type { Actor } from '../logic/tracker';
import type { RideState } from '../ride/types';
import type { Palette } from '../theme';
import { buildActor, buildBike, INDICATOR_OFF, INDICATOR_ON, wheelSpin, type BikeModel } from './models';

const SLICE = 2;
const SLICES_BEHIND = 6;
const SLICES = 46;
const MAX_CURVATURE = 0.035;
const ROAD_WIDTH = 7;
const BLINK_MS = 340;

type ActorView = { group: THREE.Group; material: THREE.MeshLambertMaterial };

export type SceneInput = Pick<RideState, 'speed' | 'gear' | 'turn' | 'yawRate' | 'lean'>;

/**
 * The Tesla-style visualisation: the bike seen from behind, the road
 * scrolling and bending with the real speed and yaw rate, and low-poly
 * figures for everything the camera detects.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
  private bike: BikeModel;
  private shadow: THREE.Mesh;
  private ground: THREE.Mesh;
  private slices: THREE.Group[] = [];
  private roadMat = new THREE.MeshLambertMaterial();
  private lineMat = new THREE.MeshBasicMaterial();
  private actorMat = new THREE.MeshLambertMaterial();
  private actorNearMat = new THREE.MeshLambertMaterial();
  private actors = new Map<number, ActorView>();
  private scroll = 0;
  private curvature = 0;
  private steer = 0;
  private lean = 0;

  constructor(palette: Palette) {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a8f99', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(-4, 10, 6);
    this.scene.add(sun);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial());
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.02;
    this.scene.add(this.ground);

    const roadGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.02, SLICE + 0.05);
    const edgeGeo = new THREE.BoxGeometry(0.12, 0.025, SLICE + 0.05);
    const dashGeo = new THREE.BoxGeometry(0.12, 0.025, SLICE);
    for (let i = 0; i < SLICES; i++) {
      const group = new THREE.Group();
      const road = new THREE.Mesh(roadGeo, this.roadMat);
      const left = new THREE.Mesh(edgeGeo, this.lineMat);
      const right = new THREE.Mesh(edgeGeo, this.lineMat);
      const dash = new THREE.Mesh(dashGeo, this.lineMat);
      left.position.x = -ROAD_WIDTH / 2 + 0.25;
      right.position.x = ROAD_WIDTH / 2 - 0.25;
      // The bike rides in the right-hand lane, so the centre line sits to its left.
      dash.position.x = -1.75;
      dash.visible = i % 2 === 0;
      group.add(road, left, right, dash);
      group.position.x = 1.75;
      this.scene.add(group);
      this.slices.push(group);
    }

    this.bike = buildBike('#000', '#000');
    this.scene.add(this.bike.root);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 24),
      new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.set(0.45, 1.6, 1);
    this.shadow.position.y = 0.012;
    this.scene.add(this.shadow);

    // Three-quarter view from behind and above, so the bike reads as a bike and not a line.
    this.camera.position.set(-2.1, 2.5, 4.4);
    this.camera.lookAt(0.4, 0.5, -5);
    this.setPalette(palette);
  }

  setPalette(p: Palette) {
    this.scene.background = new THREE.Color(p.sky);
    this.scene.fog = new THREE.Fog(p.sky, 28, 80);
    (this.ground.material as THREE.MeshLambertMaterial).color.set(p.ground);
    this.roadMat.color.set(p.road);
    this.lineMat.color.set(p.lines);
    this.bike.frameMaterial.color.set(p.bikeFrame);
    this.bike.tyreMaterial.color.set(p.bikeTyre);
    this.actorMat.color.set(p.actor);
    this.actorNearMat.color.set(p.actorNear);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(height, 1);
    // Keep the bike a similar size on wide and narrow panels.
    this.camera.fov = this.camera.aspect > 1.4 ? 46 : 56;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, ride: SceneInput, actors: Actor[], timeMs: number) {
    const signedSpeed = ride.gear === 'R' ? -ride.speed : ride.speed;

    // Road: scroll with the speed, bend with the turn (curvature = yaw rate / speed).
    const targetCurvature = ride.speed > 0.5 ? (ride.yawRate * Math.PI) / 180 / Math.max(ride.speed, 2) : 0;
    this.curvature += (Math.max(-MAX_CURVATURE, Math.min(MAX_CURVATURE, targetCurvature)) - this.curvature) * Math.min(1, dt * 3);
    // Wraps every two slices so the dashed centre line stays in phase.
    const period = 2 * SLICE;
    this.scroll = (((this.scroll + signedSpeed * dt) % period) + period) % period;
    this.slices.forEach((group, i) => {
      const z = (SLICES_BEHIND - i) * SLICE + this.scroll;
      const ahead = -z;
      group.position.z = z;
      group.position.x = 1.75 - (this.curvature * ahead * ahead) / 2;
      group.rotation.y = Math.atan(this.curvature * ahead);
    });

    // Bike: wheels spin, bars steer into the turn, the whole bike leans.
    for (const w of this.bike.wheels) w.rotation.x -= wheelSpin(signedSpeed, dt);
    const targetSteer = Math.max(-0.35, Math.min(0.35, ride.yawRate * 0.01));
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 6);
    this.bike.steering.rotation.y = this.steer;
    this.lean += (ride.lean - this.lean) * Math.min(1, dt * 5);
    this.bike.root.rotation.z = this.lean;

    const blinkOn = Math.floor(timeMs / BLINK_MS) % 2 === 0;
    for (const side of ['left', 'right'] as const) {
      const on = ride.turn === side && blinkOn;
      for (const m of this.bike.indicators[side]) m.color.copy(on ? INDICATOR_ON : INDICATOR_OFF);
    }

    this.syncActors(actors, dt);
  }

  private syncActors(actors: Actor[], dt: number) {
    const seen = new Set<number>();
    for (const a of actors) {
      seen.add(a.id);
      let view = this.actors.get(a.id);
      if (!view) {
        const material = this.actorMat;
        view = { group: buildActor(a.kind, material), material };
        view.group.position.set(a.x, 0, -a.z);
        this.scene.add(view.group);
        this.actors.set(a.id, view);
      }
      const near = a.z < 7 && Math.abs(a.x) < 2.5;
      const material = near ? this.actorNearMat : this.actorMat;
      if (material !== view.material) {
        view.material = material;
        view.group.traverse((o) => {
          if (o instanceof THREE.Mesh) o.material = material;
        });
      }
      const k = Math.min(1, dt * 8);
      view.group.position.x += (a.x - view.group.position.x) * k;
      view.group.position.z += (-a.z - view.group.position.z) * k;
    }
    for (const [id, view] of this.actors) {
      if (seen.has(id)) continue;
      this.scene.remove(view.group);
      view.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      this.actors.delete(id);
    }
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}
