export interface LinkHotspot {
  type: 'link';
  yaw: number; // grados
  pitch: number;
  target: string;
  label: string;
}
export interface InfoHotspot {
  type: 'info';
  yaw: number;
  pitch: number;
  title: string;
  text: string;
}
export type Hotspot = LinkHotspot | InfoHotspot;

/** Zona con imagen real (grados) en panorámicas parciales; fuera de ella el visor no deja mirar. */
export interface Coverage {
  yawMin: number;
  yawMax: number;
  pitchMin: number;
  pitchMax: number;
}

export interface Scene {
  id: string;
  name: string;
  pano: string;
  thumb: string;
  description?: string;
  audio?: string;
  coverage?: Coverage; // omitir si la panorámica es 360° completa
  map: { x: number; y: number }; // % sobre el plano
  initialView: { yaw: number; pitch: number; fov: number };
  hotspots: Hotspot[];
}
export interface Venue {
  id: string;
  name: string;
  tagline: string;
  description: string;
  startScene: string;
  scenes: Scene[];
}
export interface TourData {
  venues: Venue[];
}
