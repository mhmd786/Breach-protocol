import React, { useState } from 'react';
import { Shield, Zap, Crosshair, Check, X, MapPin, Users } from 'lucide-react';
import { OPERATORS, WEAPONS, OperatorDef, getRecommendedWeaponIndex, getWeaponsForOperator } from '../game/BreachProtocol';

interface InGameLoadoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOp: OperatorDef;
  onSelectOp: (op: OperatorDef) => void;
  selectedWeaponIdx: number;
  onSelectWeaponIdx: (idx: number) => void;
  currentRoundSide: 'atk' | 'def';
  roundNumber: number;
  mapName?: string;
  onConfirmAndSpawn: () => void;
}

export const InGameLoadoutModal: React.FC<InGameLoadoutModalProps> = ({
  isOpen,
  onClose,
  selectedOp,
  onSelectOp,
  selectedWeaponIdx,
  onSelectWeaponIdx,
  currentRoundSide,
  roundNumber,
  mapName = 'Suburban House (2-Story Tactical Infiltration)',
  onConfirmAndSpawn,
}) => {
  const [opSideFilter, setOpSideFilter] = useState<'all' | 'atk' | 'def'>(currentRoundSide);

  if (!isOpen) return null;

  // Strictly show operators on the player's team side for the current round
  const filteredOps = OPERATORS.filter((op) => op.side === currentRoundSide);

  const handleOpClick = (op: OperatorDef) => {
    onSelectOp(op);
    onSelectWeaponIdx(getRecommendedWeaponIndex(op));
  };

  const handleConfirm = () => {
    onConfirmAndSpawn();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none animate-fadeIn">
      <div className="bg-[#0b141d]/95 border-2 border-[#7fd6ff]/50 rounded-xl p-5 w-full max-w-4xl shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col gap-3 max-h-[92vh] overflow-y-auto">
        
        {/* Header Bar */}
        <div className="flex flex-wrap justify-between items-center bg-[#060e17] border border-[#23455a] rounded-lg p-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h2 className="font-mono text-base font-black text-[#7fd6ff] tracking-widest uppercase">
                IN-GAME OPERATOR & LOADOUT SELECTION
              </h2>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#ffe27a]" />
              <span>{mapName}</span>
              <span className="text-gray-600">|</span>
              <span className="text-emerald-400 font-bold">ROUND {roundNumber}</span>
              <span className="text-gray-600">|</span>
              <span className={currentRoundSide === 'atk' ? 'text-[#4ac8ff] font-bold' : 'text-[#ff6b4a] font-bold'}>
                YOU ARE {currentRoundSide === 'atk' ? 'ATTACKING (BLUE)' : 'DEFENDING (ORANGE)'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 font-mono bg-black/60 px-2 py-1 rounded border border-gray-700">
              Press <kbd className="text-[#ffe27a] font-bold">[N]</kbd> or <kbd className="text-[#ffe27a] font-bold">[M]</kbd> anytime
            </span>
            <button
              onClick={onClose}
              className="p-1.5 bg-[#172e3d] hover:bg-red-900/60 text-gray-300 hover:text-white rounded transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Operator Selection Header */}
        <div className="flex flex-wrap justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <label className="font-semibold text-gray-300 font-mono">YOUR TEAM OPERATORS:</label>
            <span className={`px-3 py-1 rounded font-mono font-bold uppercase tracking-wider text-xs border ${
              currentRoundSide === 'atk' ? 'bg-[#ff6b4a]/20 text-[#ff6b4a] border-[#ff6b4a]/50' : 'bg-[#4ac8ff]/20 text-[#4ac8ff] border-[#4ac8ff]/50'
            }`}>
              {currentRoundSide === 'atk' ? 'ATTACK SQUAD' : 'DEFENSE SQUAD'} ({filteredOps.length} OPERATORS)
            </span>
          </div>

          <div className="text-xs font-mono font-bold text-[#ffe27a]">
            ACTIVE: <span className="text-white uppercase">{selectedOp.name}</span> ({selectedOp.side === 'atk' ? 'ATTACKER' : 'DEFENDER'} · {selectedOp.role})
          </div>
        </div>

        {/* Operators Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-64 overflow-y-auto p-3 border border-[#2c5771]/60 rounded-xl bg-[#060d14]/90 custom-scrollbar">
          {filteredOps.map((op) => {
            const isSelected = selectedOp.id === op.id;
            return (
              <div
                key={op.id}
                onClick={() => handleOpClick(op)}
                className={`group border rounded-xl p-3 flex flex-col justify-between min-h-[85px] cursor-pointer transition-all relative overflow-hidden hover:scale-[1.02] ${
                  op.side === 'atk' ? 'border-l-4 border-l-[#ff6b4a]' : 'border-l-4 border-l-[#4ac8ff]'
                } ${
                  isSelected
                    ? 'ring-2 ring-[#ffe27a] bg-[#1e3a2c] border-[#ffe27a] shadow-[0_0_15px_rgba(255,226,122,0.2)]'
                    : 'bg-[#0f2028] border-[#2c5771] hover:bg-[#162d38] hover:border-[#38bdf8]/60'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-[#ffe27a] text-black rounded-full flex items-center justify-center font-black text-[10px] shadow">
                    ✓
                  </span>
                )}

                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      op.side === 'atk' ? 'bg-[#ff6b4a]/20 text-[#ff6b4a] border border-[#ff6b4a]/40' : 'bg-[#4ac8ff]/20 text-[#4ac8ff] border border-[#4ac8ff]/40'
                    }`}>
                      {op.side === 'atk' ? 'ATTACK' : 'DEFENSE'}
                    </span>
                  </div>

                  <b className="block text-white text-sm font-black font-mono tracking-wide group-hover:text-[#ffe27a] transition-colors">
                    {op.name}
                  </b>
                  <span className="text-xs text-gray-300 font-sans block font-semibold mt-0.5">
                    {op.role}
                  </span>
                </div>

                <div className="mt-2 pt-1 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span className="truncate text-gray-300">
                    ⚡ {op.gadgetName || 'Special'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Operator Tactical Profile */}
        <div className="bg-[#060e17] border border-[#23455a] rounded-lg p-3 text-xs flex flex-col md:flex-row gap-3 justify-between items-start">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#ffe27a]" />
              <b className="text-[#ffe27a] font-mono text-sm uppercase">
                {selectedOp.gadgetName || 'TACTICAL GADGET'}:
              </b>
              <span className="text-gray-300 font-sans font-semibold">{selectedOp.ability}</span>
            </div>
            {selectedOp.playstyle && (
              <p className="text-[11px] text-gray-400 font-sans leading-relaxed">
                {selectedOp.playstyle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 bg-[#0f1f2e] px-3 py-2 rounded border border-[#23455a] text-[11px] font-mono">
            <div>
              <span className="text-gray-400 block">ARMOR</span>
              <span className="text-emerald-400 font-bold">●●○ (MEDIUM)</span>
            </div>
            <div className="border-l border-gray-700 h-6" />
            <div>
              <span className="text-gray-400 block">SPEED</span>
              <span className="text-[#7fd6ff] font-bold">●●○ (NORMAL)</span>
            </div>
          </div>
        </div>

        {/* Primary Weapon Selection */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <label className="font-bold text-gray-300 flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-[#38bdf8]" />
              SELECT PRIMARY WEAPON LOADOUT:
            </label>
            <span className="text-gray-400 text-[11px]">
              Selected: <b className="text-[#38bdf8]">{WEAPONS[selectedWeaponIdx]?.name || 'Standard AR'}</b>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {getWeaponsForOperator(selectedOp).map((w) => {
              const globalIdx = WEAPONS.findIndex(item => item.id === w.id);
              const isSelected = selectedWeaponIdx === globalIdx;
              return (
                <div
                  key={w.id}
                  onClick={() => onSelectWeaponIdx(globalIdx)}
                  className={`border rounded-lg p-2.5 text-center text-xs cursor-pointer transition-all flex flex-col justify-between hover:border-[#38bdf8] ${
                    isSelected
                      ? 'ring-2 ring-[#ffe27a] bg-[#1e3a2c] border-[#ffe27a] shadow-md'
                      : 'bg-[#0f2028] border-[#2c5771] hover:bg-[#162d38]'
                  }`}
                >
                  <b className="block text-[#7fd6ff] text-xs font-bold font-mono whitespace-normal leading-snug">
                    {w.name}
                  </b>
                  <div className="flex justify-center gap-2 text-[10px] text-gray-300 mt-1.5 font-mono bg-black/40 py-1 px-1 rounded">
                    <span>DMG: <b className="text-white">{w.dmg}</b></span>
                    <span>MAG: <b className="text-white">{w.mag}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirm & Spawn Button */}
        <div className="mt-2 flex items-center justify-between border-t border-[#23455a] pt-3">
          <div className="text-xs text-gray-400 font-mono">
            Equipping <b className="text-white">{selectedOp.name}</b> with <b className="text-[#38bdf8]">{WEAPONS[selectedWeaponIdx]?.name}</b>
          </div>

          <button
            onClick={handleConfirm}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:brightness-110 text-white font-mono font-black text-sm tracking-wider uppercase rounded-lg shadow-xl cursor-pointer transition-all active:scale-95"
          >
            <Check className="w-5 h-5" />
            CONFIRM LOADOUT & DEPLOY OPERATOR
          </button>
        </div>

      </div>
    </div>
  );
};
