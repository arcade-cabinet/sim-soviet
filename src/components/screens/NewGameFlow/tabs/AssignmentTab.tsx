
import type { GameConfig } from '@/components/GameWorld';
import { SelectionList } from './SelectionList';
import { DIFFICULTY_OPTIONS } from '../constants';

type AssignmentTabProps = {
  config: GameConfig;
  onChange: (config: GameConfig) => void;
};

export function AssignmentTab({ config, onChange }: AssignmentTabProps) {
  return (
    <div className="space-y-4">
      <div className="text-sm opacity-80 italic mb-4">
        "Administrator, your assignment has been selected based on your file. Review the parameters carefully."
      </div>

      <SelectionList
        options={DIFFICULTY_OPTIONS}
        selectedId={config.difficulty || 'comrade'}
        onChange={(id) => onChange({ ...config, difficulty: id })}
      />
    </div>
  );
}
