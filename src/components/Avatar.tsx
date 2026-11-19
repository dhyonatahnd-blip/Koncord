import React from 'react';
import { PresenceStatus } from '../types';
import { getInitials } from '../lib/validation';

export function presenceLabel(status: PresenceStatus): string {
  switch (status) {
    case 'online':
      return 'Disponível';
    case 'idle':
      return 'Ausente';
    case 'dnd':
      return 'Ocupado';
    case 'invisible':
      return 'Invisível';
  }
}

export function presenceDotClass(status: PresenceStatus): string {
  switch (status) {
    case 'online':
      return 'bg-emerald-400';
    case 'idle':
      return 'bg-amber-400';
    case 'dnd':
      return 'bg-rose-500';
    case 'invisible':
      return 'bg-zinc-500';
  }
}

export const Avatar: React.FC<{
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  presence?: PresenceStatus;
  speaking?: boolean;
  className?: string;
}> = ({ name, src, size = 'md', presence, speaking = false, className = '' }) => {
  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  };

  const dotSizeMap = {
    xs: 'w-2 h-2 border',
    sm: 'w-2.5 h-2.5 border-[1.5px]',
    md: 'w-3 h-3 border-2',
    lg: 'w-4 h-4 border-2',
    xl: 'w-5 h-5 border-2',
  };

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeMap[size]} rounded-full overflow-hidden flex items-center justify-center font-semibold bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-100 select-none transition-shadow duration-150 ${
          speaking ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#111216]' : 'ring-1 ring-white/10'
        }`}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>
      {presence && (
        <span
          title={presenceLabel(presence)}
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-[#111216] ${dotSizeMap[size]} ${presenceDotClass(
            presence
          )}`}
        />
      )}
    </div>
  );
};
