
import { AlertTriangle, type LucideIcon } from 'lucide-react';
import type { GameDifficulty, MapSize, GameConsequence } from '@/components/GameWorld';

export type SelectionOption<T extends string> = {
  id: T;
  label: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  size?: number;
};

export const DIFFICULTY_OPTIONS: SelectionOption<GameDifficulty>[] = [
  {
    id: 'comrade',
    label: 'Comrade (Normal)',
    description: 'Standard quotas. The Party is watching, but you have some breathing room. Ideal for new administrators.'
  },
  {
    id: 'officer',
    label: 'Officer (Hard)',
    description: 'Increased quotas. Resources are tighter. The weather is colder. Only for experienced administrators.'
  },
  {
    id: 'hero',
    label: 'Hero of Labor (Extreme)',
    description: 'Impossible quotas. Starvation rations. Constant blizzards. Survival is unlikely. Glory is eternal.'
  }
];

export const MAP_SIZE_OPTIONS: SelectionOption<MapSize>[] = [
  { id: 'small', label: 'Oblast (Small)', size: 64 },
  { id: 'medium', label: 'Republic (Medium)', size: 128 },
  { id: 'large', label: 'Union (Large)', size: 256 },
];

export const CONSEQUENCE_OPTIONS: SelectionOption<GameConsequence>[] = [
  {
    id: 'exile',
    label: 'Exile',
    description: 'You are stripped of rank and sent to manage a remote settlement. Resources are scarce, but expectations are low. Failure means a quiet disappearance.',
    icon: AlertTriangle,
    iconColor: 'text-red-700'
  },
  {
    id: 'gulag',
    label: 'Gulag',
    description: 'Convicted of crimes against the state. You must build a settlement to prove your rehabilitation. Conditions are brutal. Productivity quotas are mandatory.',
    icon: AlertTriangle,
    iconColor: 'text-orange-700'
  },
  {
    id: 'death',
    label: 'Execution',
    description: 'Your predecessor was executed for incompetence. You have taken their place. The Party is watching. Any sign of failure will be met with the same fate.',
    icon: AlertTriangle,
    iconColor: 'text-[#8b4513]'
  }
];
