import React from 'react';
import { cn } from '@/lib/utils'; // Assuming this exists, based on usage in original file
import { parchment } from '@/lib/theme'; // Assuming this exists

interface SelectionListProps<T extends string | number> {
  options: { id: T; label: string; description: string }[];
  selectedId: T;
  onSelect: (id: T) => void;
}

export function SelectionList<T extends string | number>({ options, selectedId, onSelect }: SelectionListProps<T>) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        return (
          <button
            type="button"
            key={option.id}
            onClick={() => onSelect(option.id)}
            className={cn(
              "w-full text-left p-3 border-2 transition-all relative group",
              isSelected
                ? "bg-[#8b4513]/10 border-[#8b4513]"
                : "border-transparent hover:border-[#8b4513]/30 hover:bg-[#8b4513]/5"
            )}
          >
            <div className="font-bold uppercase tracking-wider text-sm mb-1">
              {option.label}
            </div>
            <div className="text-xs opacity-70 leading-relaxed">
              {option.description}
            </div>

            {isSelected && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-2 h-2 bg-[#8b4513] rounded-full" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
