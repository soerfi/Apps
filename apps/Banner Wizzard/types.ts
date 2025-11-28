
export interface Preset {
  name: string;
  width: number;
  height: number;
}

export interface PresetCategory {
  name: string;
  presets: Preset[];
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number; // in degrees
}

export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export interface ExportOptions {
  format: ExportFormat;
  quality: number; // 0 to 1
}

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface StyleToggle {
  enabled: boolean;
}

export interface DropShadowStyle extends StyleToggle {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface OuterGlowStyle extends StyleToggle {
    color: string;
    blur: number;
    opacity: number;
    strength: number;
}

export interface LayerStyles {
    dropShadow: DropShadowStyle;
    outerGlow: OuterGlowStyle;
}

export interface Layer {
  id: string;
  name: string;
  transform: Transform;
  visible: boolean;
  opacity: number; // 0 to 1
  blendMode: BlendMode;
  image?: HTMLImageElement;
  hasTransparency?: boolean;
  color?: string; // e.g. '#000000'
  frame?: {
    width: number; // in pixels
    color: string;
  };
  styles?: LayerStyles;
}