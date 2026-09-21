import React, { useState, useEffect } from 'react';
import { Shield, Zap, Crosshair, Check, Users, ArrowLeft, Clock, Lock, CheckCircle2 } from 'lucide-react';
import { OPERATORS, WEAPONS, OperatorDef, getRecommendedWeaponIndex, getWeaponsForOperator } from '../game/BreachProtocol';

export interface PlayerReadyState {
  id: string;
  name: string;
  side: 'atk' | 'def';
  opId: string;
  opName: string;
  isReady: boolean;
}

interface OperatorDraftScreenProps {
  roomId: string;
  playerName: string;
  playerSide: 'atk' | 'def';
  selectedOp: OperatorDef;
  onSelectOp: (op: OperatorDef) => void;
  selectedWeaponIdx: number;
  onSelectWeaponIdx: (idx: number) => void;
  connectedRealPlayers: PlayerReadyState[];
  isLocalReady: boolean;
  onLockInReady: () => void;
  onCancelReady: () => void;
  onBackToMenu: () => void;
  onMatchStart: () => void;
}

export const OperatorDraftScreen: React.FC<OperatorDraftScreenProps> = ({
  roomId,
  playerName,
  playerSide,
  selectedOp,
  onSelectOp,
  selectedWeaponIdx,
  onSelectWeaponIdx,
  connectedRealPlayers,
  isLocalReady,
  onLockInReady,
  onCancelReady,
  onBackToMenu,
  onMatchStart
}) => {
  const [opSideFilter, setOpSideFilter] = useState<'all' | 'atk' | 'def'>(playerSide);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Check if all connected real human players are ready
  const humanCount = connectedRealPlayers.length;
  const readyCount = connectedRealPlayers.filter(p => p.isReady).length;
  const allReady = (humanCount > 0 && readyCount === humanCount) || (humanCount <= 1 && isLocalReady);

  useEffect(() => {
    let timer: any = null;
    if (allReady) {
      if (countdown === null) {
        setCountdown(3);
      } else if (countdown > 0) {
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else if (countdown === 0) {
        onMatchStart();
      }
    } else {
      setCountdown(null);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [allReady, countdown, onMatchStart]);

  // Strictly show operators on the player's team side
  const filteredOps = OPERATORS.filter((op) => op.side === playerSide);

  const handleOpClick = (op: OperatorDef) => {
    if (isLocalReady) return; // Locked in
    onSelectOp(op);
    onSelectWeaponIdx(getRecommendedWeaponIndex(op));
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060e17] text-white flex flex-col justify-between p-4 md:p-6 font-sans select-none overflow-y-auto">
      
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a1420] border border-[#23455a] rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMenu}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#122434] hover:bg-[#1a344a] text-gray-300 hover:text-white rounded-lg font-mono text-xs font-bold border border-[#23455a] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            LOBBY MENU
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="font-mono text-base md:text-lg font-black text-[#7fd6ff] tracking-widest uppercase">
                TACTICAL OPERATOR DRAFT & LOADOUT
              </h1>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              MATCH ROOM: <b className="text-[#ffe27a]">{roomId.toUpperCase()}</b> · ASSIGNED TEAM: <b className={playerSide === 'atk' ? 'text-[#38bdf8]' : 'text-[#fbbf24]'}>{playerSide === 'atk' ? 'ATTACK (BLUE)' : 'DEFENSE (ORANGE)'}</b>
            </span>
          </div>
        </div>

        {/* Readiness Status Banner */}
        <div className="flex items-center gap-3">
          {countdown !== null ? (
            <div className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 border-2 border-emerald-400 rounded-lg text-white font-mono font-black text-sm flex items-center gap-2 animate-bounce shadow-xl">
              <Clock className="w-5 h-5 animate-spin" />
              ALL READY! INFILTRATING IN {countdown}s...
            </div>
          ) : (
            <div className="px-4 py-2 bg-[#0e1f2e] border border-[#38bdf8]/40 rounded-lg font-mono text-xs flex items-center gap-2">
              <Users className="w-4 h-4 text-[#38bdf8]" />
              <span className="text-gray-300">PLAYERS READY:</span>
              <b className="text-white text-sm">{readyCount} / {Math.max(1, humanCount)}</b>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 my-4 flex-1">
        
        {/* Left Column: Connected Real Players Roster */}
        <div className="lg:col-span-1 bg-[#09121c] border border-[#1d374a] rounded-xl p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1d374a] pb-2">
            <h3 className="font-mono text-xs font-bold text-[#7fd6ff] uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#38bdf8]" />
              CONNECTED SQUAD HUMANS ({humanCount})
            </h3>
            <span className="text-[10px] font-mono text-gray-400">AUTOMATED BOTS FILL SLOTS</span>
          </div>

          <div className="flex flex-col gap-2 max-h-72 lg:max-h-none overflow-y-auto">
            {connectedRealPlayers.length === 0 ? (
              <div className="p-3 bg-[#0d1b28] border border-gray-800 rounded-lg text-xs font-mono text-gray-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <b className="text-white">{playerName} (YOU)</b>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isLocalReady ? 'bg-emerald-950 text-emerald-400 border border-emerald-500' : 'bg-amber-950 text-amber-400 border border-amber-500'}`}>
                  {isLocalReady ? 'READY' : 'CHOOSING'}
                </span>
              </div>
            ) : (
              connectedRealPlayers.map((p) => {
                const isMe = p.id === playerName || p.name === playerName;
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-all ${
                      p.isReady
                        ? 'bg-[#102a20] border-emerald-500/60 text-emerald-200'
                        : 'bg-[#0d1c2a] border-[#22425a] text-gray-300'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span>{p.name}</span>
                        {isMe && <span className="text-[9px] bg-[#38bdf8]/30 text-[#38bdf8] px-1 rounded">(YOU)</span>}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {p.opName} · {p.side === 'atk' ? 'ATTACK' : 'DEFENSE'}
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${
                      p.isReady
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/80'
                        : 'bg-amber-950 text-amber-400 border border-amber-500/80 animate-pulse'
                    }`}>
                      {p.isReady ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {p.isReady ? 'LOCKED IN' : 'CHOOSING'}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-auto bg-[#070f18] p-2.5 rounded-lg border border-gray-800/80 text-[11px] text-gray-400 font-sans leading-snug">
            💡 <b>Match Rule:</b> All real connected human players must select their operator and click <b>LOCK IN OPERATOR & READY</b> to begin the 3D match deployment!
          </div>
        </div>

        {/* Right 3 Columns: Operator & Weapon Selector */}
        <div className="lg:col-span-3 bg-[#09121c] border border-[#1d374a] rounded-xl p-4 flex flex-col gap-3">
          
          {/* Squad Header */}
          <div className="flex flex-wrap justify-between items-center text-xs gap-2">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-gray-300 font-mono">YOUR TEAM OPERATORS:</label>
              <span className={`px-3 py-1 rounded font-mono font-bold uppercase tracking-wider text-xs border ${
                playerSide === 'atk' ? 'bg-[#ff6b4a]/20 text-[#ff6b4a] border-[#ff6b4a]/50' : 'bg-[#4ac8ff]/20 text-[#4ac8ff] border-[#4ac8ff]/50'
              }`}>
                {playerSide === 'atk' ? 'ATTACK SQUAD' : 'DEFENSE SQUAD'} ({filteredOps.length} OPERATORS)
              </span>
            </div>

            <div className="text-xs font-mono font-bold text-[#ffe27a]">
              SELECTED: <span className="text-white uppercase">{selectedOp.name}</span> ({selectedOp.side === 'atk' ? 'ATTACKER' : 'DEFENDER'} · {selectedOp.role})
            </div>
          </div>

          {/* Operator Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 max-h-72 overflow-y-auto p-3 border border-[#1d374a] rounded-xl bg-[#050b12] custom-scrollbar">
            {filteredOps.map((op) => {
              const isSelected = selectedOp.id === op.id;
              return (
                <div
                  key={op.id}
                  onClick={() => handleOpClick(op)}
                  className={`group border rounded-xl p-3 flex flex-col justify-between min-h-[90px] transition-all relative overflow-hidden ${
                    isLocalReady ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'
                  } ${
                    op.side === 'atk' ? 'border-l-4 border-l-[#ff6b4a]' : 'border-l-4 border-l-[#4ac8ff]'
                  } ${
                    isSelected
                      ? 'ring-2 ring-[#ffe27a] bg-[#112a20] border-[#ffe27a] shadow-[0_0_15px_rgba(255,226,122,0.25)]'
                      : 'bg-[#0a1824] border-[#1d374a] hover:bg-[#102434] hover:border-[#38bdf8]/60'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-[#ffe27a] text-black rounded-full flex items-center justify-center font-black text-xs shadow-md">
                      ✓
                    </span>
                  )}

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
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

                  <div className="mt-2 pt-1.5 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                    <span className="truncate text-gray-300">
                      ⚡ {op.gadgetName || 'Special'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Operator Info */}
          <div className="bg-[#050b12] border border-[#1d374a] rounded-lg p-3 text-xs flex flex-col md:flex-row gap-3 justify-between items-start">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#ffe27a]" />
                <b className="text-[#ffe27a] font-mono text-sm uppercase">
                  {selectedOp.gadgetName || 'SPECIAL ABILITY'}:
                </b>
                <span className="text-gray-200 font-sans font-semibold">{selectedOp.ability}</span>
              </div>
              {selectedOp.playstyle && (
                <p className="text-[11px] text-gray-400 font-sans leading-relaxed">
                  {selectedOp.playstyle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0 bg-[#0e1f2e] px-3 py-2 rounded border border-[#23455a] text-[11px] font-mono">
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

          {/* Weapon Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="font-bold text-gray-300 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#38bdf8]" />
                SELECT PRIMARY WEAPON:
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
                    onClick={() => {
                      if (!isLocalReady) onSelectWeaponIdx(globalIdx);
                    }}
                    className={`border rounded-lg p-2.5 text-center text-xs transition-all flex flex-col justify-between ${
                      isLocalReady ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-[#38bdf8]'
                    } ${
                      isSelected
                        ? 'ring-2 ring-[#ffe27a] bg-[#1a382c] border-[#ffe27a] shadow-md'
                        : 'bg-[#0a1824] border-[#1d374a] hover:bg-[#102434]'
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

          {/* Lock In & Ready Action Bar */}
          <div className="mt-auto border-t border-[#1d374a] pt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-400 font-mono">
              Equipping <b className="text-white">{selectedOp.name}</b> with <b className="text-[#38bdf8]">{WEAPONS[selectedWeaponIdx]?.name}</b>
            </div>

            <div className="flex items-center gap-2">
              {isLocalReady ? (
                <button
                  onClick={onCancelReady}
                  className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono text-xs font-bold rounded-lg border border-gray-600 transition-all cursor-pointer"
                >
                  UNLOCK SELECTION
                </button>
              ) : null}

              <button
                onClick={onLockInReady}
                disabled={isLocalReady}
                className={`flex items-center gap-2 px-8 py-3.5 font-mono font-black text-sm tracking-wider uppercase rounded-lg shadow-xl transition-all cursor-pointer ${
                  isLocalReady
                    ? 'bg-emerald-800 text-emerald-200 border border-emerald-500/80 cursor-default animate-pulse'
                    : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:brightness-110 text-white active:scale-95'
                }`}
              >
                {isLocalReady ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                    LOCKED IN & READY - WAITING FOR SQUAD...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    LOCK IN OPERATOR & READY
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
