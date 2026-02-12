
import type { GameConfig, MapSize } from '@/components/GameWorld';
import { SelectionList } from './SelectionList';
import { MAP_SIZE_OPTIONS } from '../constants';

type ParametersTabProps = {
  config: GameConfig;
  onChange: (config: GameConfig) => void;
};

export function ParametersTab({ config, onChange }: ParametersTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-widest opacity-70">
          Territory Size
        </label>
        <SelectionList<MapSize>
          options={MAP_SIZE_OPTIONS}
          selectedId={config.mapSize || 'medium'}
          onChange={(id) => onChange({ ...config, mapSize: id })}
          layout="grid"
        />
      </div>
    </div>
  );
}
