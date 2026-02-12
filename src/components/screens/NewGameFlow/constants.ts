import { type GameDifficulty } from '@/game/SeedSystem';

export interface GameConfigOption {
  id: string;
  label: string;
  description: string;
}

export const DIFFICULTIES: Record<GameDifficulty, { label: string; description: string }> = {
  comrade: {
    label: 'Comrade (Easy)',
    description: 'Abundant resources, high morale, faster production. Ideal for new planners.',
  },
  officer: {
    label: 'Officer (Normal)',
    description: 'Standard quotas, balanced resources. The true Soviet experience.',
  },
  partizan: {
    label: 'Partizan (Hard)',
    description: 'Scarce resources, harsh weather, demanding quotas. Only for the dedicated.',
  },
  hero: {
    label: 'Hero (Expert)',
    description: 'Near impossible odds. History will remember your sacrifice.',
  },
};

export const MAP_SIZES = {
  32: { label: 'Small (32x32)', description: 'Intimate settlement.' },
  64: { label: 'Medium (64x64)', description: 'Standard region.' },
  128: { label: 'Large (128x128)', description: 'Expansive territory.' },
  256: { label: 'Huge (256x256)', description: 'Massive continent.' },
} as const;

export const CONSEQUENCES = {
  none: { label: 'None', description: 'Standard simulation rules apply.' },
  famine: { label: 'Famine', description: 'Crops yield 50% less. Food consumption +20%.' },
  purge: { label: 'Great Purge', description: 'Random citizens disappear nightly. Morale -20%.' },
  war: { label: 'War Economy', description: 'Production +50%, but all resources drain 2x faster.' },
  winter: { label: 'Eternal Winter', description: 'Temperature locked to -20°C. Heating needs 3x.' },
} as const;

export const TABS = [
  { id: 'assignment', label: 'Assignment' },
  { id: 'parameters', label: 'Parameters' },
  { id: 'consequences', label: 'Consequences' },
] as const;
