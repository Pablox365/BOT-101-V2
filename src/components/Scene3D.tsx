import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

/**
 * three.js (r163+) rejects any context that is `instanceof WebGLRenderingContext`.
 * expo-gl makes its WebGL2 context inherit from WebGLRenderingContext, so the
 * check misfires on a real WebGL2 context. Hide the global while the renderer
 * is constructed (the check only runs there).
 */
function createRenderer(canvas: HTMLCanvasElement, gl: ExpoWebGLRenderingContext) {
  const g = globalThis as { WebGLRenderingContext?: unknown };
  const saved = g.WebGLRenderingContext;
  g.WebGLRenderingContext = undefined;
  try {
    return new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext });
  } finally {
    g.WebGLRenderingContext = saved;
  }
}

export function Scene3D({ live, actors, palette }: Props) {
  const world = useRef<World | null>(null);
  const frame = useRef<number | null>(null);
  const paletteRef = useRef(palette);
  const [error, setError] = useState<string | null>(null);

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
    try {
      startRendering(gl);
    } catch (e) {
      // Keep the rest of the dashboard usable and show why the 3D view is missing.
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startRendering = (gl: ExpoWebGLRenderingContext) => {
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
    const renderer = createRenderer(canvas, gl);
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
      try {
        w.update(dt, live.current, actors.current, now);
        renderer.render(w.scene, w.camera);
        gl.endFrameEXP();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
      frame.current = requestAnimationFrame(render);
    };
    render();
  };

  return (
    <>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      {error && (
        <View style={styles.error}>
          <Text style={[styles.errorText, { color: palette.text }]}>Vista 3D no disponible: {error}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  error: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 13, textAlign: 'center' },
});
