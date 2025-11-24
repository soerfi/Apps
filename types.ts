export interface Frame {
  id: string;
  file: File;
  previewUrl: string;
  durationMultiplier: number; // 1.0 = standard frame duration
  crop: CropSettings;
}

export interface TextOverlay {
  enabled: boolean;
  content: string;
  font: string;
  color: string;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  startFrame: number;
  endFrame: number;
  hasOutline: boolean;
  outlineColor: string;
  outlineWidth: number;
  hasShadow: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

export interface CropSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  isCustom: boolean; // If true, use these coords. If false, auto-center.
}

export interface AnimationSettings {
  width: number; // Output width
  height: number; // Output height
  
  // Timing
  frameDuration: number; // in milliseconds
  
  // Transition
  transitionType: 'none' | 'crossfade';
  transitionDuration: number; // in milliseconds

  // Export
  quality: number; // 1 to 100
  maxFileSize: number; // in bytes, 0 = unlimited
  loop: boolean;
  autoStart: boolean;
  
  // Dimensions & Crop
  maxWidth: number;
  maxHeight: number;
  aspectRatio: string;
  maintainAspectRatio: boolean; 
  backgroundColor: string;
  
  // Effects
  crossfade: boolean;
  
  // Overlays
  textOverlay: TextOverlay;
}

export const FONTS = [
  'Inter', 'Arial', 'Impact', 'Roboto', 'Open Sans', 'Lato', 
  'Montserrat', 'Oswald', 'Raleway', 'Courier New', 'Times New Roman', 'Verdana'
];

export const getDefaultSettings = (): AnimationSettings => ({
    width: 600,
    height: 600,
    maxWidth: 800,
    maxHeight: 800,
    frameDuration: 1300,
    transitionType: 'none',
    transitionDuration: 500,
    quality: 85,
    maxFileSize: 0,
    loop: true,
    autoStart: true,
    aspectRatio: 'original',
    maintainAspectRatio: true,
    backgroundColor: '#000000',
    crossfade: false,
    textOverlay: {
      enabled: false,
      content: "Sample Text",
      font: "Impact",
      color: "#ffffff",
      fontSize: 48,
      letterSpacing: 0,
      lineHeight: 1.2,
      x: 0.5,
      y: 0.5,
      startFrame: 1,
      endFrame: 100,
      hasOutline: true,
      outlineColor: "#000000",
      outlineWidth: 2,
      hasShadow: true,
      shadowColor: "#000000",
      shadowOpacity: 0.5,
      shadowBlur: 5,
      shadowOffsetX: 5,
      shadowOffsetY: 5
    }
});