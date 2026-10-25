export type Palette = {
  background: string;
  panel: string;
  text: string;
  textDim: string;
  accent: string;
  blinker: string;
  danger: string;
  chip: string;
  // 3D scene
  sky: string;
  ground: string;
  road: string;
  lines: string;
  bikeFrame: string;
  bikeTyre: string;
  actor: string;
  actorNear: string;
};

export const LIGHT: Palette = {
  background: '#f2f3f5',
  panel: '#ffffff',
  text: '#171a20',
  textDim: '#8e9095',
  accent: '#3e6ae1',
  blinker: '#22b14c',
  danger: '#e82127',
  chip: 'rgba(23,26,32,0.06)',
  sky: '#eceef1',
  ground: '#e2e4e8',
  road: '#d2d5da',
  lines: '#ffffff',
  bikeFrame: '#2b2f36',
  bikeTyre: '#1a1b1e',
  actor: '#a3a8b0',
  actorNear: '#f0a020',
};

export const DARK: Palette = {
  background: '#000000',
  panel: '#121316',
  text: '#f4f4f5',
  textDim: '#7b7e85',
  accent: '#5b86ff',
  blinker: '#2fd15d',
  danger: '#ff3b3f',
  chip: 'rgba(255,255,255,0.08)',
  sky: '#0d0e11',
  ground: '#15171b',
  road: '#22252a',
  lines: '#5d626b',
  bikeFrame: '#d7dbe0',
  bikeTyre: '#3a3d43',
  actor: '#6b7280',
  actorNear: '#f0a020',
};
