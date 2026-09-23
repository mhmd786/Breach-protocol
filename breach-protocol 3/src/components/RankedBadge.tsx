import React from 'react';
import { RankInfo } from '../game/RankedSystem';
import { Shield, Sparkles } from 'lucide-react';

interface RankedBadgeProps {
  rankInfo: RankInfo;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const RankedBadge: React.FC<RankedBadgeProps> = ({
  rankInfo,
  showProgress = true,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-2',
    lg: 'text-base px-4 py-2 gap-3'
  }[size];

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  }[size];

  return (
    <div className="flex flex-col gap-1 select-none">
      <div
        className={`inline-flex items-center rounded-lg border shadow-lg backdrop-blur-md font-mono font-bold tracking-wider ${sizeClasses}`}
        style={{
          borderColor: `${rankInfo.color}66`,
          background: `linear-gradient(135deg, ${rankInfo.color}22 0%, #060e17cc 100%)`,
          boxShadow: `0 0 15px ${rankInfo.color}22`
        }}
      >
        <span className={iconSizes}>{rankInfo.icon}</span>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span style={{ color: rankInfo.color }} className="font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
              {rankInfo.name}
            </span>
            {rankInfo.tier === 'Champion' && (
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
            )}
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            {rankInfo.totalRP} RP {rankInfo.tier !== 'Champion' ? `(${rankInfo.rp} / 100)` : ''}
          </span>
        </div>
      </div>

      {showProgress && rankInfo.tier !== 'Champion' && (
        <div className="w-full bg-[#0a121c] border border-gray-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(4, Math.min(100, rankInfo.rp))}%`,
              backgroundColor: rankInfo.color,
              boxShadow: `0 0 8px ${rankInfo.color}`
            }}
          />
        </div>
      )}
    </div>
  );
};
