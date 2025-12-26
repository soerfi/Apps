
export interface Asset {
  id: string;
  name: string;
  url: string;
  category: 'Shared' | 'User';
}

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

export type LayerType = 'image' | 'color' | 'mask';

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  transform: Transform;
  visible: boolean;
  opacity: number; // 0 to 1
  blendMode: BlendMode;
  image?: HTMLImageElement;
  maskImage?: HTMLImageElement;
  maskCanvas?: HTMLCanvasElement; // For drawn masks
  hasTransparency?: boolean;
  color?: string; // e.g. '#000000'
  isClippingMask?: boolean; // If true, clips the layer(s) below it
  isInverted?: boolean; // If true, inverts the clipping mask (hides instead of reveals)
  isLocked?: boolean; // If true, prevents movement/transform
  isMaskChild?: boolean; // If true, this layer is part of the mask/clipping block above it
  thumbnailUrl?: string; // Cache for mask preview to avoid toDataURL per render
  frame?: {
    width: number; // in pixels
    color: string;
  };
  styles?: LayerStyles;
}

export type BrushTool = 'pencil' | 'rect' | 'circle' | 'move';

// Moved from useImageEditorState.ts to avoid circular dependency
export interface EditorState {
  layers: Layer[];
  activeLayerId: string | null;
  history: {
    past: Layer[][];
    present: Layer[];
    future: Layer[][];
  };
  preset: Preset;
  brushSettings: {
    size: number;
    tool: BrushTool;
    opacity: number;
    blur: number;
  };
}

export type EditorAction =
  | { type: 'ADD_IMAGE_LAYERS'; payload: { files: File[] } }
  | { type: 'ADD_IMAGE_FROM_URL'; payload: { url: string; name: string } }
  | { type: 'ADD_COLOR_LAYER'; payload: { color: string; name: string } }
  | { type: 'ADD_MASK'; payload: { layerId: string; maskImage?: HTMLImageElement } }
  | { type: 'ADD_MASK_FILE'; payload: { layerId: string; file: File } }
  | { type: 'UPDATE_MASK_CANVAS'; payload: { layerId: string; canvas: HTMLCanvasElement } }
  | { type: 'INVERT_MASK'; payload: { layerId: string } }
  | { type: 'DELETE_LAYER'; payload: string }
  | { type: 'SET_ACTIVE_LAYER'; payload: string | null }
  | { type: 'TOGGLE_LAYER_VISIBILITY'; payload: string }
  | { type: 'TOGGLE_CLIPPING_MASK'; payload: string }
  | { type: 'REORDER_LAYER'; payload: { draggedId: string; targetId: string; position: 'above' | 'below' } }
  | { type: 'MOVE_LAYER'; payload: { layerId: string; direction: 'up' | 'down' } }
  | { type: 'UPDATE_LAYER_PROPERTY'; payload: { layerId: string; prop: string; value: any } }
  | { type: 'UPDATE_BRUSH_SETTINGS'; payload: Partial<EditorState['brushSettings']> }
  | { type: 'SET_LAYER_MASK'; payload: { layerId: string; maskImage: HTMLImageElement | null } }
  | { type: 'SET_LAYER_MASK_FILE'; payload: { layerId: string; file: File | null } }
  | { type: 'UPDATE_LAYER_TRANSFORM_RELATIVE', payload: { layerId: string; delta: { dx: number, dy: number, dScale: number, dRotation: number }, options: { isSnapping: boolean } } }
  | { type: 'UPDATE_LAYER_SCALE_FROM_POINT', payload: { layerId: string; point: { x: number, y: number }, dScale: number, options: { isSnapping: boolean } } }
  | { type: 'MOVE_ACTIVE_LAYER_WITH_KEYBOARD', payload: { key: string, shiftKey: boolean, metaKey: boolean, ctrlKey: boolean } }
  | { type: 'RESET_ACTIVE_LAYER' }
  | { type: 'INTERACTION_START' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET_STATE' }
  | { type: 'TOGGLE_MASK_CHILD'; payload: string }
  | { type: 'TOGGLE_MASK_INVERSION'; payload: string }
  | { type: 'TOGGLE_LAYER_LOCK'; payload: string }
  | { type: 'UPDATE_PRESET'; payload: Preset }
  | { type: '_SET_LAYERS'; payload: Layer[] };