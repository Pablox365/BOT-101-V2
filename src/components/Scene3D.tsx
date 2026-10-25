import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, type RefObject } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';

import type { Actor } from '../logic/tracker';
import type { RideState } from '../ride/types';
import { World } from '../scene/world';
import type { Palette } from '../theme';

type Props = {
  live: RefObject<RideState>;
  actors: RefObject<Actor[]>;
  palette: Palette;
};

export function Scene3D({ live, actors, palette }: Props) {
  const world = useRef<World | null>(null);
  const frame = useRef<number | null>(null);
  const paletteRef = useRef(palette);

  useEffect(() => {
    paletteRef.current = palette;
    world.current?.setPalette(palette);
  }, [palette]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      world.current?.dispose();
      world.current = null;
    },
    [],
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    // three.js expects a canvas; expo-gl only gives a context, so hand it a minimal stand-in.
    const canvas = {
      width,
      height,
      clientWidth: width,
      clientHeight: height,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);

    const w = new World(paletteRef.current);
    w.resize(width, height);
    world.current = w;

    let last = Date.now();
    const render = () => {
      if (!world.current) return;
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      w.update(dt, live.current, actors.current, now);
      renderer.render(w.scene, w.camera);
      gl.endFrameEXP();
      frame.current = requestAnimationFrame(render);
    };
    render();
  };

  return <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />;
}
