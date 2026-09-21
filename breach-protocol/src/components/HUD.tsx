import React from 'react';
import { GameEngine } from '../engine/GameEngine';
import { getOperator } from '../data/operators';
import { WEAPONS } from '../data/weapons';
import { 
  Shield, 
  Crosshair, 
  Camera, 
  Send, 
  Radio, 
  Flame, 
  RotateCcw,
  Eye,
  Video,
  ChevronLeft,
  ChevronRight,
  Skull
} from 'lucide-react';

interface HUDProps {
  engine: GameEngine;
}

export const HUD: React.FC<HUDProps> = ({ engine }) => {
  const localPlayer = engine.getLocalPlayer();
  const operator = localPlayer ? getOperator(localPlayer.specialistId) : null;
  const currentWeapon = localPlayer ? (WEAPONS[localPlayer.primaryWeaponId] || WEAPONS['ar_commando']) : null;

  const attackers = engine.players.filter(p => p.team === 'attackers');
  const defenders = engine.players.filter(p => p.team === 'defenders');

  // Format round timer
  const minutes = Math.floor(Math.max(0, engine.phaseTimer) / 60);
  const seconds = Math.floor(Math.max(0, engine.phaseTimer) % 60);
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  // Compass Heading calculation
  const yawDegrees = localPlayer ? Math.floor(((localPlayer.rot.yaw * 180 / Math.PI) % 360 + 360) % 360) : 0;
  const cardinalDirections = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const headingLabel = cardinalDirections[Math.round(yawDegrees / 45) % 8];

  return (
    <div id="tactical-hud" className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono text-white">
      
      {/* 1. CCTV SURVEILLANCE OVERLAY */}
      {engine.isViewingCCTV && (
        <div id="cctv-overlay" className="absolute inset-0 border-8 border-black/40 pointer-events-auto bg-blue-950/10">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
          
          {/* Top Camera Bar */}
          <div className="absolute top-4 left-6 flex items-center gap-3 text-emerald-400 font-bold tracking-widest text-sm bg-black/60 px-4 py-2 rounded border border-emerald-500/30">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping inline-block" />
            <span className="text-red-500">REC</span>
            <span>{engine.cameras[engine.activeCCTVIndex]?.name || 'CCTV FEED'}</span>
            <span className="text-zinc-400">| 1080P 60FPS ENCRYPTED</span>
          </div>

          {/* Camera Navigation Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 px-6 py-3 rounded-lg border border-zinc-700">
            <button 
              id="cctv-prev-btn"
              onClick={() => engine.cycleCCTV(-1)}
              className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded text-xs text-emerald-400 cursor-pointer"
            >
              <ChevronLeft size={16} /> PREV CAM [A]
            </button>
            <span className="text-sm font-semibold">FEED {engine.activeCCTVIndex + 1} / {engine.cameras.length}</span>
            <button 
              id="cctv-next-btn"
              onClick={() => engine.cycleCCTV(1)}
              className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded text-xs text-emerald-400 cursor-pointer"
            >
              NEXT CAM [D] <ChevronRight size={16} />
            </button>
            <button 
              id="cctv-exit-btn"
              onClick={() => engine.toggleCCTV(false)}
              className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-1.5 rounded text-xs cursor-pointer ml-4"
            >
              EXIT FEED [ESC]
            </button>
          </div>
        </div>
      )}

      {/* 2. RECON DRONE INTERFACE */}
      {engine.isControllingDrone && engine.localDrone && (
        <div id="drone-hud" className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 left-6 flex items-center gap-3 bg-black/70 px-4 py-2 rounded border border-cyan-500/40 text-cyan-400 text-sm">
            <Send size={18} className="animate-pulse" />
            <span className="font-bold">RECON DRONE ACTIVE</span>
            <span className="text-zinc-300">BATTERY: {Math.floor(engine.localDrone.battery)}%</span>
            <span className="text-xs bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded">WASD DRIVE | SPACE HOP</span>
          </div>

          {/* Drone Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border border-cyan-400/50 rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
          </div>

          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded text-xs text-cyan-200 border border-cyan-500/20">
            DRIVE DRONE TO LOCATE OBJECTIVE BOMBS & TAG DEFENDERS
          </div>
        </div>
      )}

      {/* 3. TOP MATCH BAR & 5v5 TEAM ROSTER */}
      <div id="match-header" className="absolute top-2 left-0 right-0 flex flex-col items-center">
        
        {/* Tactical Compass Bar */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-black/60 px-4 py-1 rounded-full border border-zinc-800 mb-2">
          <span className="text-amber-400 font-bold">{yawDegrees}° {headingLabel}</span>
          <span className="text-zinc-600">|</span>
          <span className="text-amber-400">SITE A: 14m</span>
          <span className="text-zinc-600">|</span>
          <span className="text-blue-400">SITE B: 22m</span>
        </div>

        {/* 5v5 Score & Phase Timer */}
        <div className="flex items-center gap-6 bg-zinc-950/90 border border-zinc-800 px-8 py-2 rounded-xl shadow-2xl backdrop-blur-md">
          
          {/* Attackers Lineup */}
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-extrabold text-sm mr-2">ATK</span>
            <div className="flex gap-1.5">
              {attackers.map((atk) => (
                <div 
                  key={atk.id} 
                  className={`w-7 h-8 rounded border flex flex-col items-center justify-center text-[10px] font-bold ${
                    atk.isAlive 
                      ? 'bg-amber-950/60 border-amber-500/60 text-amber-300' 
                      : 'bg-zinc-900 border-zinc-700 text-zinc-600 line-through'
                  }`}
                  title={`${atk.name} (${atk.isAlive ? 'Alive' : 'KIA'})`}
                >
                  {atk.isAlive ? getOperator(atk.specialistId).callsign.slice(0, 3) : <Skull size={12} />}
                </div>
              ))}
            </div>
            <span className="text-2xl font-black text-amber-400 ml-3">{engine.attackerScore}</span>
          </div>

          {/* Phase Status & Countdown */}
          <div className="flex flex-col items-center px-4 border-x border-zinc-800">
            <span className="text-[10px] tracking-widest text-zinc-400 uppercase">
              {engine.matchPhase === 'drone_prep' ? 'PREPARATION PHASE' : `ROUND ${engine.roundNumber}`}
            </span>
            <span className={`text-2xl font-black tracking-tight ${engine.phaseTimer <= 15 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {timeFormatted}
            </span>
            {engine.matchPhase === 'drone_prep' && (
              <button 
                id="skip-prep-btn"
                onClick={() => engine.advanceToActionPhase()}
                className="mt-1 pointer-events-auto bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] px-2.5 py-0.5 rounded cursor-pointer transition shadow"
              >
                START ACTION PHASE &gt;&gt;
              </button>
            )}
          </div>

          {/* Defenders Lineup */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-blue-400 mr-3">{engine.defenderScore}</span>
            <div className="flex gap-1.5">
              {defenders.map((def) => (
                <div 
                  key={def.id} 
                  className={`w-7 h-8 rounded border flex flex-col items-center justify-center text-[10px] font-bold ${
                    def.isAlive 
                      ? 'bg-blue-950/60 border-blue-500/60 text-blue-300' 
                      : 'bg-zinc-900 border-zinc-700 text-zinc-600 line-through'
                  }`}
                  title={`${def.name} (${def.isAlive ? 'Alive' : 'KIA'})`}
                >
                  {def.isAlive ? getOperator(def.specialistId).callsign.slice(0, 3) : <Skull size={12} />}
                </div>
              ))}
            </div>
            <span className="text-blue-400 font-extrabold text-sm ml-2">DEF</span>
          </div>
        </div>
      </div>

      {/* 4. TACTICAL KILLFEED (Top Right) */}
      <div id="killfeed" className="absolute top-4 right-4 flex flex-col gap-1.5 items-end">
        {engine.killFeed.map((entry) => (
          <div 
            key={entry.id} 
            className="flex items-center gap-2 bg-black/80 px-3 py-1 rounded text-xs border border-zinc-800 shadow animate-fade-in"
          >
            <span className={entry.killerTeam === 'attackers' ? 'text-amber-400 font-bold' : 'text-blue-400 font-bold'}>
              {entry.killerName}
            </span>
            <span className="text-zinc-400 text-[10px]">[{entry.weaponName}]</span>
            {entry.isHeadshot && <span className="text-red-400 text-[10px] font-bold">🎯 HEADSHOT</span>}
            <span className={entry.victimTeam === 'attackers' ? 'text-amber-400' : 'text-blue-400'}>
              {entry.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* 5. RETICLE / CROSSHAIR (Center) */}
      {localPlayer && localPlayer.isAlive && !localPlayer.isAiming && !engine.isControllingDrone && !engine.isViewingCCTV && (
        <div id="hipfire-crosshair" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-1.5 h-1.5 bg-white/80 rounded-full" />
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-white/60" />
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-white/60" />
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-0.5 bg-white/60" />
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-2 h-0.5 bg-white/60" />
        </div>
      )}

      {/* 6. CONTEXTUAL INTERACTION PROMPT */}
      {localPlayer && localPlayer.isAlive && engine.playerController?.activeInteractionPrompt && (
        <div id="interaction-prompt" className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-black/85 border border-amber-500/80 text-amber-300 font-bold px-5 py-2.5 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
          <span className="bg-amber-500 text-black px-2 py-0.5 rounded text-xs">ACTION</span>
          <span className="text-sm tracking-wide">{engine.playerController.activeInteractionPrompt}</span>
        </div>
      )}

      {/* 7. DEFUSER / OBJECTIVE PLANTING PROGRESS BAR */}
      {(engine.isPlantingDefuser || engine.isDisarmingDefuser) && (
        <div id="objective-progress" className="absolute bottom-48 left-1/2 -translate-x-1/2 w-72 bg-black/90 p-4 rounded-xl border border-amber-500 flex flex-col items-center">
          <span className="text-xs font-bold text-amber-400 mb-2">
            {engine.isPlantingDefuser ? 'ARMING DEFUSER CONTAINER...' : 'DISARMING DEFUSER...'}
          </span>
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-500 transition-all duration-75"
              style={{ width: `${engine.defuserInteractionProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 8. ACTIVE DEFUSER ALARM BANNER (if planted) */}
      {engine.activeDefuserZone && engine.activeDefuserZone.state === 'armed' && (
        <div id="defuser-alarm" className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-600/90 text-white font-black px-6 py-1.5 rounded-full border border-red-300 shadow-xl flex items-center gap-3 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
          <span>DEFUSER ARMED AT {engine.activeDefuserZone.name.toUpperCase()} ({Math.ceil(engine.activeDefuserZone.armedTimeRemaining)}s)</span>
        </div>
      )}

      {/* 9. BOTTOM LEFT: HEALTH, ARMOR, OPERATOR ICON & LEAN */}
      {localPlayer && localPlayer.isAlive && (
        <div id="hud-vitals" className="absolute bottom-6 left-6 flex items-center gap-4 bg-zinc-950/85 p-4 rounded-xl border border-zinc-800/90 backdrop-blur-md">
          {/* Operator Avatar */}
          <div 
            className="w-14 h-14 rounded-lg flex flex-col items-center justify-center border-2 shadow-inner"
            style={{ borderColor: operator?.color || '#3b82f6', backgroundColor: '#09090b' }}
          >
            <span className="text-xs font-extrabold" style={{ color: operator?.color }}>{operator?.callsign.toUpperCase()}</span>
            <span className="text-[10px] text-zinc-400 uppercase">{operator?.role.split(' ')[0]}</span>
          </div>

          {/* Health & Armor Bars */}
          <div className="flex flex-col gap-1.5 w-36">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-zinc-300">HP</span>
              <span className="font-black text-emerald-400">{Math.ceil(localPlayer.health)}</span>
            </div>
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${(localPlayer.health / localPlayer.maxHealth) * 100}%` }}
              />
            </div>

            {/* Armor */}
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1"><Shield size={11} /> ARMOR</span>
              <span>{Math.ceil(localPlayer.armor)}</span>
            </div>
          </div>

          {/* Lean & Stance Indicator */}
          <div className="flex flex-col items-center justify-center px-3 border-l border-zinc-800 text-[11px] text-zinc-400">
            <span>{localPlayer.isCrouched ? 'CROUCH' : 'STAND'}</span>
            <div className="flex gap-1 mt-1">
              <span className={`px-1 rounded ${localPlayer.leanAngle < -0.3 ? 'bg-amber-500 text-black font-bold' : 'text-zinc-600'}`}>Q</span>
              <span className={`px-1 rounded ${localPlayer.leanAngle > 0.3 ? 'bg-amber-500 text-black font-bold' : 'text-zinc-600'}`}>E</span>
            </div>
          </div>
        </div>
      )}

      {/* 10. BOTTOM RIGHT: WEAPON, AMMO & SPECIALIST ABILITY GAUGE */}
      {localPlayer && localPlayer.isAlive && (
        <div id="hud-weapon" className="absolute bottom-6 right-6 flex items-center gap-5 bg-zinc-950/85 p-4 rounded-xl border border-zinc-800/90 backdrop-blur-md">
          
          {/* Specialist Ability Button */}
          <div className="flex flex-col items-center pr-4 border-r border-zinc-800">
            <button
              id="ability-trigger-btn"
              onClick={() => engine.triggerSpecialistAbility()}
              className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center pointer-events-auto transition cursor-pointer ${
                localPlayer.abilityCharges > 0 
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-black' 
                  : 'bg-zinc-900 border-zinc-700 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <Flame size={20} />
              <span className="text-[10px] font-black">{localPlayer.abilityCharges}</span>
            </button>
            <span className="text-[10px] text-zinc-400 mt-1">[F / ABILITY]</span>
          </div>

          {/* Tactical Gadgets (Reinforcements / Barricades / Drone / Camera) */}
          <div className="flex flex-col gap-1 text-xs text-zinc-300">
            {localPlayer.team === 'defenders' ? (
              <>
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-zinc-400" />
                  <span>REINFORCE: {localPlayer.reinforcedWallsRemaining}</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw size={14} className="text-zinc-400" />
                  <span>BARRICADES: {localPlayer.barricadesRemaining}</span>
                </div>
                <button 
                  id="cctv-toggle-btn"
                  onClick={() => engine.toggleCCTV()}
                  className="pointer-events-auto bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-[11px] text-emerald-400 flex items-center gap-1 cursor-pointer mt-1"
                >
                  <Video size={13} /> CCTV FEED [5]
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Flame size={14} className="text-amber-400" />
                  <span>BREACH CHARGES: 2</span>
                </div>
                <button 
                  id="drone-toggle-btn"
                  onClick={() => engine.toggleDrone()}
                  className="pointer-events-auto bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-[11px] text-cyan-400 flex items-center gap-1 cursor-pointer mt-1"
                >
                  <Send size={13} /> RECON DRONE [5]
                </button>
              </>
            )}
          </div>

          {/* Ammo & Current Weapon */}
          <div className="flex flex-col items-end pl-4 border-l border-zinc-800">
            <span className="text-xs text-zinc-400 font-semibold uppercase">{currentWeapon?.name}</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl font-black text-white">{localPlayer.currentAmmo}</span>
              <span className="text-sm font-bold text-zinc-500">/ {localPlayer.reserveAmmo}</span>
            </div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">[R] RELOAD</span>
          </div>
        </div>
      )}

      {/* 11. SPECTATOR MODE OVERLAY (Upon Death) */}
      {localPlayer && !localPlayer.isAlive && (
        <div id="spectator-overlay" className="absolute inset-0 bg-black/40 flex flex-col justify-between p-8 pointer-events-auto">
          <div className="bg-red-950/80 border border-red-500/60 p-4 rounded-xl text-center self-center shadow-2xl">
            <span className="text-red-400 font-black text-lg tracking-widest block">K.I.A. - SPECTATING LIVING OPERATORS</span>
            <span className="text-zinc-300 text-xs mt-1 block">Awaiting next round deployment. Support your squad with callouts.</span>
          </div>

          {/* Cycle Teammates */}
          <div className="self-center flex items-center gap-4 bg-zinc-950/90 border border-zinc-700 px-6 py-3 rounded-lg shadow-xl">
            <button 
              onClick={() => engine.cycleSpectator(-1)}
              className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded text-xs cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft size={16} /> PREV SQUADMATE
            </button>
            <span className="text-xs font-bold text-zinc-300">CYCLE SPECTATOR</span>
            <button 
              onClick={() => engine.cycleSpectator(1)}
              className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded text-xs cursor-pointer flex items-center gap-1"
            >
              NEXT SQUADMATE <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 12. ROUND END RESULT OVERLAY */}
      {engine.matchPhase === 'round_end' && (
        <div id="round-result-modal" className="absolute inset-0 bg-black/75 flex items-center justify-center p-6 pointer-events-auto">
          <div className="bg-zinc-950 border-2 border-zinc-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl animate-fade-in">
            <span className={`text-3xl font-black uppercase tracking-widest block ${engine.roundWinner === 'attackers' ? 'text-amber-400' : 'text-blue-400'}`}>
              {engine.roundWinner?.toUpperCase()} WIN ROUND!
            </span>
            <p className="text-zinc-300 text-sm mt-3">{engine.winReason}</p>
            <div className="mt-6 flex justify-center items-center gap-8 text-2xl font-black">
              <span className="text-amber-400">ATK {engine.attackerScore}</span>
              <span className="text-zinc-600">:</span>
              <span className="text-blue-400">{engine.defenderScore} DEF</span>
            </div>
            <span className="text-xs text-zinc-500 mt-6 block">DEPLOYING NEXT ROUND IN {Math.ceil(engine.phaseTimer)}s...</span>
          </div>
        </div>
      )}
    </div>
  );
};
