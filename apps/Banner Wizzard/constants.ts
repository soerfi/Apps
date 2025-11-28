import { PresetCategory } from './types';

export const PRESET_CATEGORIES: PresetCategory[] = [
  {
    name: 'Social Media',
    presets: [
      { name: 'Insta Post', width: 1080, height: 1080 },
      { name: 'Insta Story', width: 1080, height: 1920 },
      { name: 'Facebook Feed', width: 1200, height: 1200 },
      { name: 'Youtube Preview', width: 1280, height: 720 },
    ],
  },
  {
    name: 'SKATE.CH',
    presets: [
      { name: 'Top-Wide', width: 3000, height: 750 },
      { name: 'Full', width: 2400, height: 800 },
      { name: '1/2', width: 1600, height: 800 },
      { name: '2/3', width: 1200, height: 800 },
      { name: 'Square', width: 800, height: 800 },
    ],
  },
  {
    name: 'illUMATE',
    presets: [
      { name: 'Feature', width: 800, height: 450 },
      { name: 'Banner', width: 1280, height: 340 },
    ],
  },
];
