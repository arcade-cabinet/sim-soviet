
import type { GameConfig } from '@/components/GameWorld';
import { SelectionList } from './SelectionList';
import { CONSEQUENCE_OPTIONS } from '../constants';

type ConsequencesTabProps = {
  config: GameConfig;
  onChange: (config: GameConfig) => void;
};

export function ConsequencesTab({ config, onChange }: ConsequencesTabProps) {
  return (
    <div className="space-y-4">
      <div className="text-sm opacity-80 italic mb-4">
        "Comrade, be aware of the consequences of failure. The Party does not tolerate incompetence."
      </div>

      <SelectionList
        options={CONSEQUENCE_OPTIONS}
        selectedId={config.consequence || 'exile'}
        onChange={(id) => onChange({ ...config, consequence: id as any })}
      />
    </div>
  );
}
