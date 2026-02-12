
import { type ReactNode } from 'react';

type GameButtonProps = {
  onClick: () => void;
  children: ReactNode;
  selected?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
};

export function GameButton({
  onClick,
  children,
  selected = false,
  className = '',
  type = 'button'
}: GameButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`
        p-3 border-2 transition-all relative group
        ${selected
          ? 'border-[#8b4513] bg-[#8b4513]/10'
          : 'border-[#8b4513]/20 hover:border-[#8b4513]/40'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}
