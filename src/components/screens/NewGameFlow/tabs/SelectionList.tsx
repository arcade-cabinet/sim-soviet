
import { Check, type LucideIcon } from 'lucide-react';
import { GameButton } from '../../ui/GameButton';
import { cn } from '@/utils/utils';

export type SelectionOption<T extends string> = {
  id: T;
  label: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  size?: number;
};

type SelectionListProps<T extends string> = {
  options: SelectionOption<T>[];
  selectedId: T;
  onChange: (id: T) => void;
  layout?: 'list' | 'grid';
};

export function SelectionList<T extends string>({
  options,
  selectedId,
  onChange,
  layout = 'list'
}: SelectionListProps<T>) {
  return (
    <div className={layout === 'grid' ? "grid grid-cols-3 gap-3" : "space-y-3"}>
      {options.map((option) => {
        const selected = selectedId === option.id;
        const Icon = option.icon;

        return (
          <GameButton
            key={option.id}
            onClick={() => onChange(option.id)}
            selected={selected}
            className={layout === 'grid' ? "text-center w-full" : "text-left w-full p-4"}
          >
            <div
              className={cn(
                "font-bold uppercase tracking-wider text-sm mb-1",
                Icon && "flex items-center gap-2",
                option.iconColor
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {option.label}
            </div>

            {option.description && (
              <div className="text-xs opacity-70 leading-relaxed mb-2">
                {option.description}
              </div>
            )}

            {option.size && (
              <span className="block text-[10px] font-normal opacity-60 mt-0.5">
                {option.size}x{option.size}
              </span>
            )}

            {selected && (
              <div className={layout === 'grid' ? "absolute top-1 right-1 text-[#8b4513]" : "absolute top-4 right-4 text-[#8b4513]"}>
                <Check className={layout === 'grid' ? "w-3 h-3" : "w-5 h-5"} />
              </div>
            )}
          </GameButton>
        );
      })}
    </div>
  );
}
