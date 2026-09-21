import React, { useState } from 'react';
import { OPERATORS, getOperator } from '../data/operators';
import { ALL_MAPS } from '../maps/mapData';
import { WEAPONS } from '../data/weapons';
import { Team } from '../types/game';
import { 
  Shield, 
  Zap, 
  Target, 
  Crosshair, 
  Radio, 
  Flame, 
  Eye, 
  Play, 
  Layers,
  MapPin,
  CheckCircle2
} from 'lucide-react';

interface OperatorSelectProps {
  onStartMatch: (team: Team, operatorId: string, mapId: string) => void;
}

export const OperatorSelect: React.FC<OperatorSelectProps> = ({ onStartMatch }) => {
  const [selectedTeam, setSelectedTeam] = useState<Team>('attackers');
  const [selectedOpId, setSelectedOpId] = useState<string>('att_aces');
  const [selectedMapId, setSelectedMapId] = useState<string>('copper_yard');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentOp = getOperator(selectedOpId);
  const currentMap = ALL_MAPS.find(m => m.id === selectedMapId) || ALL_MAPS[0];

  // Filter operators by team, role, and search
  const teamOperators = OPERATORS.filter(op => {
    if (op.team !== selectedTeam) return false;
    if (selectedRoleFilter !== 'all' && !op.role.toLowerCase().includes(selectedRoleFilter.toLowerCase())) return false;
    if (searchQuery.trim() && !op.callsign.toLowerCase().includes(searchQuery.toLowerCase()) && !op.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const roles = ['all', 'Breach', 'Intel', 'Shield', 'Support', 'Denial', 'Trapper', 'Entry', 'Mobility'];

  return (
    <div id="operator-select-screen" className="absolute inset-0 bg-zinc-950 text-white flex flex-col font-mono select-none overflow-hidden z-20">
      
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-900/60 px-8 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-4">
          <span className="text-xl font-black tracking-widest text-amber-500">BREACH PROTOCOL</span>
          <span className="text-xs text-zinc-500 uppercase">TACTICAL 5V5 OPERATION SUITE</span>
        </div>

        {/* Team Selector Tabs */}
        <div className="flex bg-black/60 p-1 rounded-xl border border-zinc-800">
          <button
            id="team-attackers-btn"
            onClick={() => {
              setSelectedTeam('attackers');
              setSelectedOpId('att_aces');
            }}
            className={`flex items-center gap-2 px-6 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
              selectedTeam === 'attackers' 
                ? 'bg-amber-500 text-black shadow-lg' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Flame size={14} /> ATTACK SQUAD ({OPERATORS.filter(o => o.team === 'attackers').length})
          </button>
          <button
            id="team-defenders-btn"
            onClick={() => {
              setSelectedTeam('defenders');
              setSelectedOpId('def_castle');
            }}
            className={`flex items-center gap-2 px-6 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
              selectedTeam === 'defenders' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Shield size={14} /> DEFENSE SQUAD ({OPERATORS.filter(o => o.team === 'defenders').length})
          </button>
        </div>

        {/* Map Selection Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <MapPin size={14} className="text-zinc-400" />
          <span className="text-zinc-400">OPERATION:</span>
          <select 
            id="map-selector"
            value={selectedMapId}
            onChange={(e) => setSelectedMapId(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 px-3 py-1 rounded text-amber-400 font-bold cursor-pointer outline-none"
          >
            {ALL_MAPS.map(m => (
              <option key={m.id} value={m.id}>{m.name.toUpperCase()} ({m.theme.toUpperCase()})</option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Grid: Left Roster Selection + Right Operator Dossier */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: SPECIALIST ROSTER */}
        <div className="w-1/2 border-r border-zinc-800/80 p-6 flex flex-col overflow-hidden">
          
          {/* Filters & Search */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              {roles.map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRoleFilter(r)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-md uppercase transition cursor-pointer ${
                    selectedRoleFilter === r 
                      ? (selectedTeam === 'attackers' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-blue-500/20 text-blue-400 border border-blue-500/50')
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="SEARCH CALLSIGN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded text-xs text-zinc-200 outline-none w-44"
            />
          </div>

          {/* Roster Grid */}
          <div className="flex-1 grid grid-cols-5 gap-2.5 overflow-y-auto pr-2 pb-6">
            {teamOperators.map(op => {
              const isSelected = op.id === selectedOpId;
              return (
                <button
                  key={op.id}
                  id={`operator-card-${op.id}`}
                  onClick={() => setSelectedOpId(op.id)}
                  className={`h-24 rounded-xl border flex flex-col items-center justify-center p-2 transition cursor-pointer relative group ${
                    isSelected 
                      ? (selectedTeam === 'attackers' ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/30' : 'bg-blue-950/40 border-blue-400 ring-2 ring-blue-400/30')
                      : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80'
                  }`}
                >
                  {/* Callsign Badge */}
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs mb-1 shadow"
                    style={{ backgroundColor: op.color, color: '#ffffff' }}
                  >
                    {op.callsign.slice(0, 2).toUpperCase()}
                  </div>

                  <span className="text-xs font-black tracking-wide truncate w-full text-center">{op.callsign}</span>
                  <span className="text-[9px] text-zinc-400 truncate w-full text-center">{op.role.split(' ')[0]}</span>

                  {isSelected && (
                    <CheckCircle2 size={12} className={`absolute top-1.5 right-1.5 ${selectedTeam === 'attackers' ? 'text-amber-400' : 'text-blue-400'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: SPECIALIST DOSSIER & LOADOUT */}
        <div className="w-1/2 p-8 flex flex-col justify-between overflow-y-auto bg-gradient-to-b from-zinc-950 to-zinc-900">
          <div>
            {/* Operator Title & Badge */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <span 
                    className="text-3xl font-black tracking-wider"
                    style={{ color: currentOp.color }}
                  >
                    {currentOp.callsign.toUpperCase()}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 font-bold uppercase">
                    {currentOp.nationality || 'GLOBAL'}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  REAL NAME: <span className="text-zinc-200">{currentOp.realName || currentOp.name}</span> | ROLE: <span className="text-amber-400 font-bold">{currentOp.role.toUpperCase()}</span>
                </div>
              </div>

              {/* Speed & Armor Ratings */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-zinc-400">SPEED</span>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3].map(v => (
                      <div key={v} className={`w-2.5 h-4 rounded-sm ${v <= currentOp.speed ? 'bg-amber-400' : 'bg-zinc-800'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-zinc-400">ARMOR</span>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3].map(v => (
                      <div key={v} className={`w-2.5 h-4 rounded-sm ${v <= currentOp.armor ? 'bg-blue-400' : 'bg-zinc-800'}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Tactical Ability Card */}
            <div className="mt-6 bg-black/60 border border-zinc-800 p-5 rounded-2xl">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-extrabold mb-1">
                <Flame size={16} />
                <span>SIGNATURE ABILITY: {currentOp.abilityName.toUpperCase()}</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">{currentOp.abilityDesc}</p>
              <div className="text-[10px] text-zinc-500 mt-2">CHARGES PER ROUND: {currentOp.abilityCharges}</div>
            </div>

            {/* Loadout Section */}
            <div className="mt-6">
              <span className="text-xs font-bold text-zinc-400 tracking-wider block mb-3">TACTICAL LOADOUT</span>
              <div className="grid grid-cols-2 gap-4">
                
                {/* Primary Weapon */}
                <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
                  <span className="text-[10px] text-zinc-500 uppercase block">PRIMARY WEAPON</span>
                  <span className="text-sm font-black text-white mt-1 block">
                    {WEAPONS[currentOp.primaryWeapons[0]]?.name || currentOp.primaryWeapons[0]}
                  </span>
                  <div className="flex gap-3 text-[11px] text-zinc-400 mt-2">
                    <span>DMG: {WEAPONS[currentOp.primaryWeapons[0]]?.damage || 38}</span>
                    <span>RPM: {WEAPONS[currentOp.primaryWeapons[0]]?.rpm || 750}</span>
                    <span>MAG: {WEAPONS[currentOp.primaryWeapons[0]]?.magSize || 30}</span>
                  </div>
                </div>

                {/* Secondary Weapon */}
                <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
                  <span className="text-[10px] text-zinc-500 uppercase block">SIDEARM</span>
                  <span className="text-sm font-black text-white mt-1 block">
                    {WEAPONS[currentOp.secondaryWeapons[0]]?.name || currentOp.secondaryWeapons[0]}
                  </span>
                  <div className="flex gap-3 text-[11px] text-zinc-400 mt-2">
                    <span>DMG: {WEAPONS[currentOp.secondaryWeapons[0]]?.damage || 45}</span>
                    <span>MAG: {WEAPONS[currentOp.secondaryWeapons[0]]?.magSize || 15}</span>
                  </div>
                </div>
              </div>

              {/* Tactical Gadgets */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">TACTICAL GADGETS:</span>
                <div className="flex gap-2">
                  {currentOp.tacticalGadgets.map((gadget, idx) => (
                    <span key={idx} className="text-[11px] px-2.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-300 font-semibold">
                      {gadget}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Background Dossier */}
            <div className="mt-6">
              <span className="text-[10px] text-zinc-500 uppercase block mb-1">OPERATIONAL PROFILE</span>
              <p className="text-xs text-zinc-400 italic leading-relaxed">"{currentOp.background || currentOp.biography}"</p>
            </div>
          </div>

          {/* Bottom Deployment Bar */}
          <div className="mt-8 pt-6 border-t border-zinc-800 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-zinc-400">SELECTED OPERATION:</span>
              <span className="text-sm font-bold text-amber-400">{currentMap.name.toUpperCase()}</span>
            </div>

            <button
              id="deploy-operator-btn"
              onClick={() => onStartMatch(selectedTeam, currentOp.id, selectedMapId)}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-xl font-black text-sm uppercase tracking-wider shadow-2xl transition cursor-pointer ${
                selectedTeam === 'attackers'
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
              }`}
            >
              <Play size={18} fill="currentColor" /> DEPLOY TO OPERATION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
