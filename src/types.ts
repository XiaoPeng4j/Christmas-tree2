
export enum TreeState {
  CLOSED = 'CLOSED',
  SCATTERED = 'SCATTERED',
  FOCUS = 'FOCUS',
  ROMANTIC = 'ROMANTIC',
  ROMANTIC_ENDING = 'ROMANTIC_ENDING'
}

export interface PhotoData {
  id: string;
  url: string;
  text: string;
  texture?: any;
  textTexture?: any;
}

export interface MusicTrack {
  name: string;
  url: string;
}

export interface HandGesture {
  type: 'FIST' | 'PALM' | 'GRAB' | 'VSIGN' | 'HEART' | 'NONE';
  secondaryType?: 'FIST' | 'PALM' | 'GRAB' | 'VSIGN' | 'HEART' | 'NONE';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

export const COLORS = {
  TREE_GREEN: '#2E5E40', // Fresh, vibrant Pine Green
  GOLD: '#FFCC00', // Deep, rich Gold
  RED: '#FF1A1A', // Bright, glowing Red
  GLOW_GOLD: '#FFF5CC', // Pale Gold for halos
  LIGHT_WARM: '#FFEB99', // Bright Fairy Light
  HEART_PINK: '#FFB6C1', // Light Pink
  HEART_RED: '#FF69B4',  // Hot Pink
};
